'use strict';

const Article = require('../models/Article');
const Category = require('../models/Category');
const { success, created, paginated, errors } = require('../utils/responseHelper');
const { generateUniqueSlug } = require('../utils/slugGenerator');
const { calculateReadingTime, sanitizeExcerpt } = require('../utils/readingTime');
const { sanitizeHtml } = require('../utils/sanitizer');
const { logAction } = require('../middleware/auditLogger');
const { getSitemapQueue, getNotificationQueue } = require('../jobs/queue');
const searchService = require('../services/searchService');
const logger = require('../utils/logger');

/**
 * GET /articles
 * Paginated list with filters
 */
const getArticles = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      category,
      author,
      search,
      tag,
      isFeatured,
      isBreaking,
      sort = '-publishedAt',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const filter = { isDeleted: { $ne: true } };

    // Permission-based status filtering
    const canEditAll = req.user?.can?.('articles.editAll');

    if (status) {
      filter.status = status;
    } else if (!canEditAll) {
      filter.status = 'published';
    }

    if (category) filter.category = category;
    if (author) filter.author = author;
    if (tag) filter.tags = { $in: [tag] };
    if (isFeatured === 'true') filter.isFeatured = true;
    if (isBreaking === 'true') filter.isBreaking = true;

    // "mine" — writer dashboard listing of own articles in any status
    if (req.query.mine === 'true' && req.user) {
      filter.author = req.user._id;
      if (!status) delete filter.status;
    }

    // Writers can only see their own non-published articles
    if (req.user && !canEditAll) {
      if (filter.status && filter.status !== 'published') {
        filter.author = req.user._id;
      }
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    const allowedSorts = ['-publishedAt', '-createdAt', '-views.total', '-popularityScore', 'publishedAt', 'createdAt'];
    const safeSort = allowedSorts.includes(sort) ? sort : '-publishedAt';

    const [articles, total] = await Promise.all([
      Article.find(filter)
        .sort(safeSort)
        .skip(skip)
        .limit(limitNum)
        .populate('category', 'name slug color')
        .populate('author', 'name avatar')
        .select('-content -revisions')
        .lean(),
      Article.countDocuments(filter),
    ]);

    return paginated(res, articles, { page: pageNum, limit: limitNum, total });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /articles/:slug
 * Get article by slug — or by Mongo id (the admin editor and dashboard
 * fetch by id; slug-only lookup 404'd every admin "edit" click)
 */
const getArticle = async (req, res, next) => {
  try {
    const { slug } = req.params;

    const byId = require('mongoose').isValidObjectId(slug);
    const baseQuery = byId
      ? Article.findOne({ _id: slug, isDeleted: { $ne: true } })
      : Article.findBySlug(slug);

    const article = await baseQuery
      .populate('category', 'name slug color icon')
      .populate('subcategory', 'name slug')
      .populate('author', 'name nameEn avatar bio socialLinks')
      .populate('coAuthors', 'name avatar')
      .populate('relatedArticles', 'title slug ogImage category publishedAt readingTimeMin')
      .lean();

    if (!article) {
      return errors.notFound(res, 'المقال');
    }

    // Check status for users without editorial access
    const isAdmin = req.user?.can?.('articles.editAll');
    const isOwner = req.user && article.author?._id?.toString() === req.user._id?.toString();

    if (article.status !== 'published' && !isAdmin && !isOwner) {
      return errors.notFound(res, 'المقال');
    }

    // Redirect to canonical slug if accessed via an old slug. Arabic slugs
    // must be percent-encoded — HTTP headers reject non-ASCII (was a 500).
    if (!byId && article.slug !== slug) {
      res.set('X-Canonical-Slug', encodeURIComponent(article.slug));
    }

    // View counting happens via the client-side beacon (POST /analytics/event,
    // type article_view) — NOT here. This fetch is ISR-cached by Next.js, so it
    // fires once per revalidation window, not once per reader.
    return success(res, article);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /articles
 * Create new article
 */
const createArticle = async (req, res, next) => {
  try {
    const {
      title, subtitle, content, excerpt, category, subcategory,
      tags, status, isFeatured, isBreaking, isSponsored, sponsorName,
      publishAt, expireAt, seo, ogImage, relatedArticles, source,
      commentsEnabled, scheduledNotification, coAuthors, author,
    } = req.body;

    const canPublish = req.user.can('articles.publish');
    const canFeature = req.user.can('articles.feature');
    const canEditAll = req.user.can('articles.editAll');

    // Writers without publish rights can only save drafts or submit for review
    let effectiveStatus = status || 'draft';
    if (!canPublish && !['draft', 'pending'].includes(effectiveStatus)) {
      effectiveStatus = 'draft';
    }

    // Generate unique slug
    const slug = await generateUniqueSlug(title, async (s) => {
      const exists = await Article.findOne({ $or: [{ slug: s }, { slugHistory: s }] });
      return !!exists;
    });

    // Sanitize HTML content
    const sanitizedContent = content ? sanitizeHtml(content) : '';

    // Auto-generate excerpt if not provided
    const autoExcerpt = excerpt || (sanitizedContent ? sanitizeExcerpt(sanitizedContent, 300) : '');

    // Calculate reading time
    const readingTimeMin = calculateReadingTime(sanitizedContent);

    const articleData = {
      title: title.trim(),
      subtitle,
      slug,
      content: sanitizedContent,
      excerpt: autoExcerpt,
      category,
      subcategory: subcategory || null,
      tags: tags || [],
      // Editors may assign another author; writers always publish under their own name
      author: (canEditAll && author) ? author : req.user._id,
      coAuthors: coAuthors || [],
      status: effectiveStatus,
      isFeatured: canFeature ? (isFeatured || false) : false,
      isBreaking: canFeature ? (isBreaking || false) : false,
      isSponsored: canFeature ? (isSponsored || false) : false,
      sponsorName,
      publishAt,
      expireAt,
      seo: seo || {},
      ogImage: ogImage || {},
      relatedArticles: relatedArticles || [],
      source,
      commentsEnabled: commentsEnabled !== false,
      scheduledNotification: scheduledNotification || false,
      readingTimeMin,
    };

    // If published immediately, set publishedAt
    if (articleData.status === 'published') {
      articleData.publishedAt = new Date();
    }

    // Submitted straight for review
    if (articleData.status === 'pending') {
      articleData.review = { submittedAt: new Date() };
    }

    const article = await Article.create(articleData);

    // Update category article count
    await Category.incrementArticleCount(category);

    // Index in Elasticsearch
    if (article.status === 'published') {
      try {
        await searchService.indexArticle(article);
      } catch (esErr) {
        logger.error('Elasticsearch indexing error:', esErr.message);
      }

      // Queue sitemap regeneration
      try {
        const sitemapQueue = getSitemapQueue();
        await sitemapQueue.add('regenerate', { trigger: 'article.create', articleId: article._id });
      } catch (queueErr) {
        logger.error('Sitemap queue error:', queueErr.message);
      }

      // Send push notification if breaking news
      if (article.isBreaking && article.scheduledNotification) {
        try {
          const notifQueue = getNotificationQueue();
          await notifQueue.add('push-breaking', {
            articleId: article._id,
            title: article.title,
            excerpt: article.excerpt,
            url: `/articles/${article.slug}`,
          });
        } catch (queueErr) {
          logger.error('Notification queue error:', queueErr.message);
        }
      }
    }

    await logAction({
      req,
      action: 'article.create',
      resourceType: 'article',
      resourceId: article._id,
      resourceTitle: article.title,
      severity: 'low',
    });

    const populated = await Article.findById(article._id)
      .populate('category', 'name slug')
      .populate('author', 'name avatar')
      .lean();

    return created(res, populated, 'تم إنشاء المقال بنجاح');
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /articles/:id
 * Update article
 */
const updateArticle = async (req, res, next) => {
  try {
    const { id } = req.params;

    const article = await Article.findOne({ _id: id, isDeleted: { $ne: true } })
      .select('+revisions');

    if (!article) return errors.notFound(res, 'المقال');

    // Authorization check
    const canEditAll = req.user.can('articles.editAll');
    const canPublish = req.user.can('articles.publish');
    const canFeature = req.user.can('articles.feature');
    const isOwner = article.author.toString() === req.user._id.toString();

    if (!canEditAll && !(isOwner && req.user.can('articles.editOwn'))) {
      return errors.forbidden(res, 'لا يمكنك تعديل هذا المقال');
    }

    // Writers cannot silently change live content
    if (article.status === 'published' && !canPublish) {
      return errors.forbidden(res, 'لا يمكن تعديل مقال منشور — تواصل مع المحرر');
    }

    const {
      title, subtitle, content, excerpt, category, subcategory,
      tags, status, isFeatured, isBreaking, isSponsored, sponsorName,
      publishAt, expireAt, seo, ogImage, relatedArticles, source,
      commentsEnabled, scheduledNotification, coAuthors, changeNote, author,
    } = req.body;

    // Save revision if content or title changed
    if (
      (content !== undefined && content !== article.content) ||
      (title !== undefined && title !== article.title)
    ) {
      article.revisions.push({
        content: article.content,
        title: article.title,
        subtitle: article.subtitle,
        editedBy: req.user._id,
        editedAt: new Date(),
        changeNote: changeNote || '',
      });

      // Keep only last 20 revisions
      if (article.revisions.length > 20) {
        article.revisions = article.revisions.slice(-20);
      }
    }

    // Handle slug change
    if (title && title !== article.title) {
      const newSlug = await generateUniqueSlug(title, async (s, excludeId) => {
        const exists = await Article.findOne({
          $or: [{ slug: s }, { slugHistory: s }],
          _id: { $ne: id },
        });
        return !!exists;
      }, id);

      if (newSlug !== article.slug) {
        if (!article.slugHistory.includes(article.slug)) {
          article.slugHistory.push(article.slug);
        }
        article.slug = newSlug;
      }

      article.title = title.trim();
    }

    // Update fields
    if (subtitle !== undefined) article.subtitle = subtitle;
    if (content !== undefined) {
      article.content = sanitizeHtml(content);
      article.readingTimeMin = calculateReadingTime(article.content);
    }
    if (excerpt !== undefined) article.excerpt = excerpt;
    if (category !== undefined) article.category = category;
    if (subcategory !== undefined) article.subcategory = subcategory;
    if (tags !== undefined) article.tags = tags;
    if (isFeatured !== undefined && canFeature) article.isFeatured = isFeatured;
    if (isBreaking !== undefined && canFeature) article.isBreaking = isBreaking;
    if (isSponsored !== undefined && canFeature) article.isSponsored = isSponsored;
    if (author !== undefined && canEditAll) article.author = author;
    if (sponsorName !== undefined) article.sponsorName = sponsorName;
    if (publishAt !== undefined) article.publishAt = publishAt;
    if (expireAt !== undefined) article.expireAt = expireAt;
    if (seo !== undefined) article.seo = { ...article.seo, ...seo };
    if (ogImage !== undefined) article.ogImage = ogImage;
    if (relatedArticles !== undefined) article.relatedArticles = relatedArticles;
    if (source !== undefined) article.source = source;
    if (commentsEnabled !== undefined) article.commentsEnabled = commentsEnabled;
    if (scheduledNotification !== undefined) article.scheduledNotification = scheduledNotification;
    if (coAuthors !== undefined) article.coAuthors = coAuthors;

    // Handle status change
    if (status !== undefined && status !== article.status) {
      // Without publish rights only draft↔pending transitions are allowed
      if (!canPublish && !['draft', 'pending'].includes(status)) {
        return errors.forbidden(res, 'ليس لديك صلاحية تغيير حالة المقال إلى هذه الحالة');
      }
      if (status === 'published' && !article.publishedAt) {
        article.publishedAt = new Date();
      }
      if (status === 'archived') {
        article.archivedAt = new Date();
      }
      if (status === 'pending') {
        article.review = { ...(article.review?.toObject?.() || article.review || {}), submittedAt: new Date() };
      }
      article.status = status;
    }

    // Auto-generate excerpt if missing
    if (!article.excerpt && article.content) {
      article.excerpt = sanitizeExcerpt(article.content, 300);
    }

    await article.save();

    // Re-index in Elasticsearch
    if (article.status === 'published') {
      try {
        await searchService.indexArticle(article);
      } catch (esErr) {
        logger.error('Elasticsearch re-index error:', esErr.message);
      }
    }

    await logAction({
      req,
      action: 'article.update',
      resourceType: 'article',
      resourceId: article._id,
      resourceTitle: article.title,
    });

    const updated = await Article.findById(article._id)
      .populate('category', 'name slug')
      .populate('author', 'name avatar')
      .select('-revisions')
      .lean();

    return success(res, updated, 'تم تحديث المقال بنجاح');
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /articles/:id
 * Soft delete (archive) or hard delete for super_admin
 */
const deleteArticle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { hard = false } = req.query;

    const article = await Article.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!article) return errors.notFound(res, 'المقال');

    // Hard delete only for super_admin
    if (hard === 'true' && req.user.role === 'super_admin') {
      // Remove from Elasticsearch
      try {
        await searchService.deleteArticle(id);
      } catch { /* non-critical */ }

      await Article.findByIdAndDelete(id);

      await logAction({
        req,
        action: 'article.delete.hard',
        resourceType: 'article',
        resourceId: id,
        resourceTitle: article.title,
        severity: 'critical',
      });

      return success(res, null, 'تم حذف المقال نهائيًا');
    }

    // Soft delete
    article.isDeleted = true;
    article.deletedAt = new Date();
    article.deletedBy = req.user._id;
    article.status = 'archived';
    article.archivedAt = new Date();
    await article.save();

    // Remove from search index
    try {
      await searchService.deleteArticle(id);
    } catch { /* non-critical */ }

    await logAction({
      req,
      action: 'article.delete',
      resourceType: 'article',
      resourceId: id,
      resourceTitle: article.title,
      severity: 'medium',
    });

    return success(res, null, 'تم حذف المقال بنجاح');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /articles/:id/publish
 * Publish an article
 */
const publishArticle = async (req, res, next) => {
  try {
    const { id } = req.params;

    const article = await Article.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!article) return errors.notFound(res, 'المقال');

    if (article.status === 'published') {
      return errors.badRequest(res, 'المقال منشور بالفعل');
    }

    const previousStatus = article.status;
    article.status = 'published';
    article.publishedAt = new Date();

    // Publishing a pending submission counts as its review
    if (previousStatus === 'pending') {
      article.review = {
        ...(article.review?.toObject?.() || article.review || {}),
        reviewedBy: req.user._id,
        reviewedAt: new Date(),
      };
    }

    await article.save();

    // Index in Elasticsearch
    try {
      await searchService.indexArticle(article);
    } catch (esErr) {
      logger.error('Elasticsearch index on publish error:', esErr.message);
    }

    // Trigger sitemap regeneration
    try {
      const sitemapQueue = getSitemapQueue();
      await sitemapQueue.add('regenerate', { trigger: 'article.publish', articleId: article._id });
    } catch { /* non-critical */ }

    // Send push notification for breaking news
    if (article.isBreaking && article.scheduledNotification && !article.notificationSent) {
      try {
        const notifQueue = getNotificationQueue();
        await notifQueue.add('push-breaking', {
          articleId: article._id,
          title: article.title,
          excerpt: article.excerpt,
          url: `/articles/${article.slug}`,
          image: article.ogImage?.url,
        });
        article.notificationSent = true;
        await article.save();
      } catch (queueErr) {
        logger.error('Push notification queue error:', queueErr.message);
      }
    }

    await logAction({
      req,
      action: 'article.publish',
      resourceType: 'article',
      resourceId: article._id,
      resourceTitle: article.title,
      severity: 'medium',
      changes: { before: { status: previousStatus }, after: { status: 'published' } },
    });

    return success(res, { id: article._id, slug: article.slug, publishedAt: article.publishedAt }, 'تم نشر المقال بنجاح');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /articles/:id/archive
 */
const archiveArticle = async (req, res, next) => {
  try {
    const { id } = req.params;

    const article = await Article.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!article) return errors.notFound(res, 'المقال');

    article.status = 'archived';
    article.archivedAt = new Date();
    await article.save();

    // Remove from search index
    try {
      await searchService.deleteArticle(id);
    } catch { /* non-critical */ }

    return success(res, null, 'تم أرشفة المقال');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /articles/:id/submit
 * Writer submits a draft (or rejected article) for editorial review
 */
const submitForReview = async (req, res, next) => {
  try {
    const { id } = req.params;

    const article = await Article.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!article) return errors.notFound(res, 'المقال');

    const isOwner = article.author.toString() === req.user._id.toString();
    if (!isOwner && !req.user.can('articles.editAll')) {
      return errors.forbidden(res, 'لا يمكنك إرسال مقال لا تملكه');
    }

    if (!['draft', 'rejected'].includes(article.status)) {
      return errors.badRequest(res, 'يمكن إرسال المسودات أو المقالات المرفوضة فقط للمراجعة');
    }

    if (!article.content || !article.title) {
      return errors.badRequest(res, 'أكمل العنوان والمحتوى قبل الإرسال للمراجعة');
    }

    article.status = 'pending';
    article.review = { submittedAt: new Date() };
    await article.save();

    await logAction({
      req, action: 'article.submit', resourceType: 'article',
      resourceId: article._id, resourceTitle: article.title,
    });

    return success(res, { id: article._id, status: 'pending' }, 'تم إرسال المقال للمراجعة');
  } catch (error) { next(error); }
};

/**
 * POST /articles/:id/approve
 * Editor approves a pending article → published
 */
const approveArticle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const article = await Article.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!article) return errors.notFound(res, 'المقال');

    if (article.status !== 'pending') {
      return errors.badRequest(res, 'المقال ليس بانتظار المراجعة');
    }

    article.status = 'published';
    article.publishedAt = article.publishedAt || new Date();
    article.review = {
      ...(article.review?.toObject?.() || article.review || {}),
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
      note: note || '',
    };
    await article.save();

    try {
      await searchService.indexArticle(article);
    } catch (esErr) {
      logger.error('Elasticsearch index on approve error:', esErr.message);
    }

    try {
      const sitemapQueue = getSitemapQueue();
      await sitemapQueue.add('regenerate', { trigger: 'article.approve', articleId: article._id });
    } catch { /* non-critical */ }

    await logAction({
      req, action: 'article.approve', resourceType: 'article',
      resourceId: article._id, resourceTitle: article.title, severity: 'medium',
    });

    return success(res, { id: article._id, status: 'published', publishedAt: article.publishedAt }, 'تمت الموافقة على المقال ونشره');
  } catch (error) { next(error); }
};

/**
 * POST /articles/:id/reject
 * Editor rejects a pending article with a note for the writer
 */
const rejectArticle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const article = await Article.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!article) return errors.notFound(res, 'المقال');

    if (article.status !== 'pending') {
      return errors.badRequest(res, 'المقال ليس بانتظار المراجعة');
    }

    article.status = 'rejected';
    article.review = {
      ...(article.review?.toObject?.() || article.review || {}),
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
      note,
    };
    await article.save();

    await logAction({
      req, action: 'article.reject', resourceType: 'article',
      resourceId: article._id, resourceTitle: article.title, severity: 'medium',
    });

    return success(res, { id: article._id, status: 'rejected' }, 'تم إرجاع المقال إلى الكاتب');
  } catch (error) { next(error); }
};

/**
 * GET /articles/pending-count
 * Badge counter for the review queue
 */
const getPendingCount = async (req, res, next) => {
  try {
    const count = await Article.countDocuments({ status: 'pending', isDeleted: { $ne: true } });
    return success(res, { count });
  } catch (error) { next(error); }
};

/**
 * GET /articles/:id/revisions
 */
const getRevisions = async (req, res, next) => {
  try {
    const { id } = req.params;

    const article = await Article.findOne({ _id: id, isDeleted: { $ne: true } })
      .select('revisions title author')
      .populate('revisions.editedBy', 'name email');

    if (!article) return errors.notFound(res, 'المقال');

    const isOwner = article.author.toString() === req.user._id.toString();
    if (!isOwner && !req.user.can('articles.editAll')) {
      return errors.forbidden(res);
    }

    return success(res, article.revisions || []);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /articles/featured
 */
const getFeaturedArticles = async (req, res, next) => {
  try {
    const { limit = 5 } = req.query;

    const articles = await Article.find({
      status: 'published',
      isFeatured: true,
      isDeleted: { $ne: true },
    })
      .sort('-publishedAt')
      .limit(parseInt(limit))
      .populate('category', 'name slug color')
      .populate('author', 'name avatar')
      .select('-content -revisions')
      .lean();

    return success(res, articles);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /articles/breaking
 */
const getBreakingArticles = async (req, res, next) => {
  try {
    const { limit = 3 } = req.query;

    const articles = await Article.find({
      status: 'published',
      isBreaking: true,
      isDeleted: { $ne: true },
    })
      .sort('-publishedAt')
      .limit(parseInt(limit))
      .populate('category', 'name slug color')
      .select('-content -revisions')
      .lean();

    return success(res, articles);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /articles/:id/toggle-featured
 */
const toggleFeatured = async (req, res, next) => {
  try {
    const { id } = req.params;

    const article = await Article.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!article) return errors.notFound(res, 'المقال');

    article.isFeatured = !article.isFeatured;
    await article.save();

    return success(res, { isFeatured: article.isFeatured }, `تم ${article.isFeatured ? 'تمييز' : 'إلغاء تمييز'} المقال`);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /articles/:id/unpublish
 */
const unpublishArticle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const article = await Article.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!article) return errors.notFound(res, 'المقال');

    if (article.status !== 'published') {
      return errors.badRequest(res, 'المقال ليس منشورًا');
    }

    article.status = 'draft';
    await article.save();

    try { await searchService.deleteArticle(id); } catch { /* non-critical */ }

    await logAction({
      req, action: 'article.unpublish', resourceType: 'article',
      resourceId: article._id, resourceTitle: article.title, severity: 'medium',
    });

    return success(res, { id: article._id, status: 'draft' }, 'تم إلغاء نشر المقال');
  } catch (error) { next(error); }
};

/**
 * DELETE /articles/bulk
 */
const bulkDeleteArticles = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return errors.badRequest(res, 'يجب تحديد مقالات للحذف');
    }

    await Article.updateMany(
      { _id: { $in: ids }, isDeleted: { $ne: true } },
      { $set: { isDeleted: true, deletedAt: new Date(), deletedBy: req.user._id, status: 'archived' } }
    );

    for (const id of ids) {
      try { await searchService.deleteArticle(id); } catch { /* non-critical */ }
    }

    await logAction({
      req, action: 'article.bulk_delete', resourceType: 'article',
      resourceId: ids[0], severity: 'high',
      changes: { after: { deletedIds: ids } },
    });

    return success(res, { deleted: ids.length }, `تم حذف ${ids.length} مقال`);
  } catch (error) { next(error); }
};

/**
 * PATCH /articles/bulk/status
 */
const bulkUpdateStatus = async (req, res, next) => {
  try {
    const { ids, status } = req.body;
    const allowed = ['draft', 'pending', 'published', 'archived'];
    if (!Array.isArray(ids) || ids.length === 0 || !allowed.includes(status)) {
      return errors.badRequest(res, 'بيانات غير صالحة');
    }

    const update = { status };
    if (status === 'published') update.publishedAt = new Date();
    if (status === 'archived') update.archivedAt = new Date();

    await Article.updateMany(
      { _id: { $in: ids }, isDeleted: { $ne: true } },
      { $set: update }
    );

    return success(res, { updated: ids.length }, `تم تحديث حالة ${ids.length} مقال`);
  } catch (error) { next(error); }
};

/**
 * GET /articles/check-slug
 */
const checkSlug = async (req, res, next) => {
  try {
    const { slug, excludeId } = req.query;
    if (!slug) return errors.badRequest(res, 'الرابط مطلوب');

    const query = { $or: [{ slug }, { slugHistory: slug }] };
    if (excludeId) query._id = { $ne: excludeId };

    const exists = await Article.exists(query);
    return success(res, { available: !exists, slug });
  } catch (error) { next(error); }
};

/**
 * GET /tags — distinct tags across published articles
 */
const getTags = async (req, res, next) => {
  try {
    const { q } = req.query;
    const match = { status: 'published', isDeleted: { $ne: true } };
    const tags = await Article.distinct('tags', match);
    const filtered = q ? tags.filter(t => t.includes(q)) : tags;
    return success(res, filtered.slice(0, 50));
  } catch (error) { next(error); }
};

/**
 * POST /articles/:id/revisions/:revisionId/restore
 */
const restoreRevision = async (req, res, next) => {
  try {
    const { id, revisionId } = req.params;

    const article = await Article.findOne({ _id: id, isDeleted: { $ne: true } })
      .select('+revisions');
    if (!article) return errors.notFound(res, 'المقال');

    const isOwner = article.author.toString() === req.user._id.toString();
    if (!isOwner && !req.user.can('articles.editAll')) {
      return errors.forbidden(res);
    }

    const revision = article.revisions.id(revisionId);
    if (!revision) return errors.notFound(res, 'المراجعة');

    // Save current state as new revision before restoring
    article.revisions.push({
      content: article.content,
      title: article.title,
      subtitle: article.subtitle,
      editedBy: req.user._id,
      editedAt: new Date(),
      changeNote: 'حالة قبل الاستعادة',
    });

    article.title = revision.title || article.title;
    article.subtitle = revision.subtitle || article.subtitle;
    article.content = revision.content;
    article.readingTimeMin = calculateReadingTime(article.content);

    if (article.revisions.length > 20) {
      article.revisions = article.revisions.slice(-20);
    }

    await article.save();

    await logAction({
      req, action: 'article.restore_revision', resourceType: 'article',
      resourceId: article._id, resourceTitle: article.title, severity: 'medium',
    });

    return success(res, { id: article._id }, 'تم استعادة المراجعة بنجاح');
  } catch (error) { next(error); }
};

module.exports = {
  getArticles,
  getArticle,
  createArticle,
  updateArticle,
  deleteArticle,
  publishArticle,
  unpublishArticle,
  archiveArticle,
  submitForReview,
  approveArticle,
  rejectArticle,
  getPendingCount,
  getRevisions,
  restoreRevision,
  getFeaturedArticles,
  getBreakingArticles,
  toggleFeatured,
  bulkDeleteArticles,
  bulkUpdateStatus,
  checkSlug,
  getTags,
};
