'use strict';

const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    article: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Article',
      required: [true, 'المقال مطلوب'],
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
    },
    ancestors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment',
      },
    ],
    depth: {
      type: Number,
      default: 0,
      max: 3, // max nesting level
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // For guest comments
    guestName: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    guestEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    content: {
      type: String,
      required: [true, 'محتوى التعليق مطلوب'],
      trim: true,
      minlength: [2, 'التعليق قصير جدًا'],
      maxlength: [2000, 'التعليق طويل جدًا (الحد الأقصى 2000 حرف)'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'approved', 'rejected', 'spam'],
        message: 'حالة التعليق غير صالحة',
      },
      default: 'pending',
    },
    likes: {
      type: Number,
      default: 0,
    },
    likedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    repliesCount: {
      type: Number,
      default: 0,
    },
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    moderatedAt: Date,
    moderationNote: String,
    ipAddress: {
      type: String,
      select: false,
    },
    userAgent: {
      type: String,
      select: false,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: Date,
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
commentSchema.index({ article: 1, status: 1, createdAt: -1 });
commentSchema.index({ parent: 1, status: 1 });
commentSchema.index({ author: 1 });
commentSchema.index({ status: 1, createdAt: -1 });
commentSchema.index({ isDeleted: 1 });

// Pre-save: build ancestors array
commentSchema.pre('save', async function (next) {
  if (this.isNew && this.parent) {
    const parentDoc = await this.constructor.findById(this.parent).select('ancestors depth');
    if (parentDoc) {
      this.ancestors = [...(parentDoc.ancestors || []), this.parent];
      this.depth = Math.min((parentDoc.depth || 0) + 1, 3);
    }
  }
  next();
});

// Post-save: update article comment count and parent reply count
commentSchema.post('save', async function (doc) {
  if (doc.isNew && doc.status === 'approved') {
    const Article = mongoose.model('Article');
    await Article.findByIdAndUpdate(doc.article, { $inc: { commentsCount: 1 } });

    if (doc.parent) {
      await doc.constructor.findByIdAndUpdate(doc.parent, { $inc: { repliesCount: 1 } });
    }
  }
});

// Virtual: display name
commentSchema.virtual('displayName').get(function () {
  if (this.author) return null; // populated elsewhere
  return this.guestName || 'زائر مجهول';
});

// Static: get threaded comments for article
commentSchema.statics.getThreaded = async function (articleId, options = {}) {
  const { page = 1, limit = 20, sort = '-createdAt' } = options;
  const skip = (page - 1) * limit;

  const topLevel = await this.find({
    article: articleId,
    parent: null,
    status: 'approved',
    isDeleted: false,
  })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate('author', 'name avatar')
    .lean();

  const topLevelIds = topLevel.map((c) => c._id);

  const replies = await this.find({
    article: articleId,
    parent: { $in: topLevelIds },
    status: 'approved',
    isDeleted: false,
    depth: { $lte: 3 },
  })
    .sort('createdAt')
    .populate('author', 'name avatar')
    .lean();

  // Nest replies
  const replyMap = {};
  replies.forEach((r) => {
    const parentId = r.parent.toString();
    if (!replyMap[parentId]) replyMap[parentId] = [];
    replyMap[parentId].push(r);
  });

  return topLevel.map((comment) => ({
    ...comment,
    replies: replyMap[comment._id.toString()] || [],
  }));
};

module.exports = mongoose.model('Comment', commentSchema);
