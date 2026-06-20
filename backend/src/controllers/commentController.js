'use strict';

const Comment = require('../models/Comment');
const Article = require('../models/Article');
const { success, created, paginated, errors } = require('../utils/responseHelper');
const { sanitizeText } = require('../utils/sanitizer');
const { logAction } = require('../middleware/auditLogger');

/**
 * GET /comments?articleId=...
 */
const getComments = async (req, res, next) => {
  try {
    const { articleId, status, page = 1, limit = 20, sort = '-createdAt' } = req.query;

    const pageNum = parseInt(page);
    const limitNum = Math.min(50, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    const isAdmin = req.user && ['admin', 'super_admin', 'editor'].includes(req.user.role);

    // Threaded view for public
    if (articleId && !isAdmin && !status) {
      const threaded = await Comment.getThreaded(articleId, { page: pageNum, limit: limitNum });
      const total = await Comment.countDocuments({ article: articleId, status: 'approved', parent: null, isDeleted: false });
      return paginated(res, threaded, { page: pageNum, limit: limitNum, total });
    }

    const filter = { isDeleted: false };
    if (articleId) filter.article = articleId;
    if (status) filter.status = status;
    if (!isAdmin) {
      filter.status = 'approved';
    }

    const allowedSorts = ['-createdAt', 'createdAt', '-likes'];
    const safeSort = allowedSorts.includes(sort) ? sort : '-createdAt';

    const [comments, total] = await Promise.all([
      Comment.find(filter)
        .sort(safeSort)
        .skip(skip)
        .limit(limitNum)
        .populate('author', 'name avatar role')
        .populate('article', 'title slug')
        .lean(),
      Comment.countDocuments(filter),
    ]);

    return paginated(res, comments, { page: pageNum, limit: limitNum, total });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /comments
 */
const createComment = async (req, res, next) => {
  try {
    const { article: articleId, content, parent, guestName, guestEmail } = req.body;

    // Verify article exists and comments are enabled
    const article = await Article.findOne({
      _id: articleId,
      status: 'published',
      isDeleted: { $ne: true },
    });

    if (!article) return errors.notFound(res, 'المقال');

    if (!article.commentsEnabled) {
      return errors.badRequest(res, 'التعليقات معطلة لهذا المقال');
    }

    // Validate parent comment if provided
    if (parent) {
      const parentComment = await Comment.findOne({
        _id: parent,
        article: articleId,
        status: 'approved',
        isDeleted: false,
      });
      if (!parentComment) return errors.notFound(res, 'التعليق الأصلي');
      if (parentComment.depth >= 3) {
        return errors.badRequest(res, 'لا يمكن الرد على هذا المستوى من التعليقات');
      }
    }

    // Sanitize content
    const sanitizedContent = sanitizeText(content).trim();
    if (!sanitizedContent) {
      return errors.badRequest(res, 'محتوى التعليق فارغ');
    }

    const commentData = {
      article: articleId,
      content: sanitizedContent,
      parent: parent || null,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };

    if (req.user) {
      commentData.author = req.user._id;
      // Auto-approve for admins/editors
      if (['admin', 'super_admin', 'editor'].includes(req.user.role)) {
        commentData.status = 'approved';
      }
    } else {
      // Guest comment
      if (!guestName) return errors.badRequest(res, 'الاسم مطلوب للتعليق كضيف');
      commentData.guestName = sanitizeText(guestName).substring(0, 100);
      commentData.guestEmail = guestEmail;
    }

    const comment = await Comment.create(commentData);

    const populated = await Comment.findById(comment._id)
      .populate('author', 'name avatar')
      .lean();

    const message = commentData.status === 'approved'
      ? 'تم نشر تعليقك بنجاح'
      : 'تم إرسال تعليقك وسيظهر بعد المراجعة';

    return created(res, populated, message);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /comments/:id
 */
const updateComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    const comment = await Comment.findOne({ _id: id, isDeleted: false });
    if (!comment) return errors.notFound(res, 'التعليق');

    // Only author can edit (within 30 min)
    const isAuthor = comment.author?.toString() === req.user._id.toString();
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);

    if (!isAuthor && !isAdmin) return errors.forbidden(res);

    if (isAuthor && !isAdmin) {
      const ageMinutes = (Date.now() - comment.createdAt.getTime()) / 60000;
      if (ageMinutes > 30) {
        return errors.badRequest(res, 'لا يمكن تعديل التعليق بعد 30 دقيقة من نشره');
      }
    }

    comment.content = sanitizeText(content).trim();
    comment.isEdited = true;
    comment.editedAt = new Date();
    await comment.save();

    return success(res, comment, 'تم تحديث التعليق');
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /comments/:id
 */
const deleteComment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const comment = await Comment.findOne({ _id: id, isDeleted: false });
    if (!comment) return errors.notFound(res, 'التعليق');

    const isAuthor = comment.author?.toString() === req.user._id.toString();
    const isAdmin = ['admin', 'super_admin', 'editor'].includes(req.user.role);

    if (!isAuthor && !isAdmin) return errors.forbidden(res);

    comment.isDeleted = true;
    comment.deletedAt = new Date();
    comment.content = '[تم حذف هذا التعليق]';
    await comment.save();

    // Decrement article comment count
    if (comment.status === 'approved') {
      await Article.findByIdAndUpdate(comment.article, { $inc: { commentsCount: -1 } });
    }

    await logAction({
      req,
      action: 'comment.delete',
      resourceType: 'comment',
      resourceId: id,
      severity: 'medium',
    });

    return success(res, null, 'تم حذف التعليق');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /comments/:id/moderate
 * Approve / reject / mark spam
 */
const moderateComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, moderationNote } = req.body;

    const validStatuses = ['approved', 'rejected', 'spam'];
    if (!validStatuses.includes(status)) {
      return errors.badRequest(res, 'حالة الإشراف غير صالحة');
    }

    const comment = await Comment.findOne({ _id: id, isDeleted: false });
    if (!comment) return errors.notFound(res, 'التعليق');

    const wasApproved = comment.status === 'approved';
    const willBeApproved = status === 'approved';

    comment.status = status;
    comment.moderatedBy = req.user._id;
    comment.moderatedAt = new Date();
    if (moderationNote) comment.moderationNote = moderationNote;
    await comment.save();

    // Update article comment count
    if (!wasApproved && willBeApproved) {
      await Article.findByIdAndUpdate(comment.article, { $inc: { commentsCount: 1 } });
    } else if (wasApproved && !willBeApproved) {
      await Article.findByIdAndUpdate(comment.article, { $inc: { commentsCount: -1 } });
    }

    const statusMessages = {
      approved: 'تم قبول التعليق',
      rejected: 'تم رفض التعليق',
      spam: 'تم تصنيف التعليق كسبام',
    };

    await logAction({
      req,
      action: `comment.${status}`,
      resourceType: 'comment',
      resourceId: id,
    });

    return success(res, comment, statusMessages[status]);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /comments/:id/like
 */
const likeComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const comment = await Comment.findOne({ _id: id, status: 'approved', isDeleted: false });
    if (!comment) return errors.notFound(res, 'التعليق');

    const alreadyLiked = comment.likedBy.includes(userId);

    if (alreadyLiked) {
      comment.likedBy.pull(userId);
      comment.likes = Math.max(0, comment.likes - 1);
    } else {
      comment.likedBy.push(userId);
      comment.likes += 1;
    }

    await comment.save();

    return success(res, { likes: comment.likes, liked: !alreadyLiked });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /comments/pending-count
 */
const getPendingCount = async (req, res, next) => {
  try {
    const count = await Comment.countDocuments({ status: 'pending', isDeleted: false });
    return success(res, { count });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getComments,
  createComment,
  updateComment,
  deleteComment,
  moderateComment,
  likeComment,
  getPendingCount,
};
