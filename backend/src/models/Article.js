'use strict';

const mongoose = require('mongoose');

const revisionSchema = new mongoose.Schema(
  {
    content: { type: String },
    title: { type: String },
    subtitle: { type: String },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    editedAt: { type: Date, default: Date.now },
    changeNote: { type: String, maxlength: 200 },
  },
  { _id: true }
);

const articleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'عنوان المقال مطلوب'],
      trim: true,
      maxlength: [300, 'العنوان لا يتجاوز 300 حرف'],
    },
    subtitle: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    slugHistory: {
      type: [String],
      default: [],
    },
    content: {
      type: String, // sanitized HTML
    },
    excerpt: {
      type: String,
      maxlength: 500,
    },
    seo: {
      title: { type: String, maxlength: 70 },
      description: { type: String, maxlength: 160 },
      keywords: [{ type: String, maxlength: 50 }],
      canonical: { type: String },
      noIndex: { type: Boolean, default: false },
    },
    ogImage: {
      url: String,
      publicId: String,
      alt: String,
      caption: String,
      credit: String,
      width: Number,
      height: Number,
    },
    gallery: [
      {
        url: String,
        publicId: String,
        alt: String,
        caption: String,
        credit: String,
      },
    ],
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'التصنيف مطلوب'],
    },
    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: 50,
      },
    ],
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'الكاتب مطلوب'],
    },
    coAuthors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    status: {
      type: String,
      enum: {
        values: ['draft', 'pending', 'rejected', 'scheduled', 'published', 'archived'],
        message: 'حالة المقال غير صالحة',
      },
      default: 'draft',
    },
    // Editorial review workflow (writer submits → editor approves/rejects)
    review: {
      submittedAt: { type: Date },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reviewedAt: { type: Date },
      note: { type: String, maxlength: 1000 },
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isBreaking: {
      type: Boolean,
      default: false,
    },
    isSponsored: {
      type: Boolean,
      default: false,
    },
    sponsorName: {
      type: String,
      trim: true,
    },
    publishAt: {
      type: Date,
    },
    expireAt: {
      type: Date,
    },
    publishedAt: {
      type: Date,
    },
    archivedAt: {
      type: Date,
    },
    views: {
      total: { type: Number, default: 0 },
      last24h: { type: Number, default: 0 },
      last7d: { type: Number, default: 0 },
      lastUpdated: { type: Date },
    },
    readingTimeMin: {
      type: Number,
      min: 1,
      default: 1,
    },
    commentsEnabled: {
      type: Boolean,
      default: true,
    },
    commentsCount: {
      type: Number,
      default: 0,
    },
    relatedArticles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Article',
      },
    ],
    revisions: {
      type: [revisionSchema],
      default: [],
      select: false,
    },
    scheduledNotification: {
      type: Boolean,
      default: false,
    },
    notificationSent: {
      type: Boolean,
      default: false,
    },
    source: {
      name: String,
      url: String,
    },
    language: {
      type: String,
      default: 'ar',
    },
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },
    deletedAt: {
      type: Date,
      select: false,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      select: false,
    },
    popularityScore: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
articleSchema.index({ slug: 1 });
articleSchema.index({ status: 1, publishedAt: -1 });
articleSchema.index({ category: 1, status: 1, publishedAt: -1 });
articleSchema.index({ author: 1, status: 1 });
articleSchema.index({ tags: 1 });
articleSchema.index({ isFeatured: 1, status: 1 });
articleSchema.index({ isBreaking: 1, status: 1 });
articleSchema.index({ publishAt: 1, status: 1 });
articleSchema.index({ expireAt: 1, status: 1 });
articleSchema.index({ 'views.total': -1 });
articleSchema.index({ popularityScore: -1 });
articleSchema.index({ isDeleted: 1 });
articleSchema.index({ createdAt: -1 });
articleSchema.index({ slugHistory: 1 });

// Text index for basic search (Elasticsearch is primary search)
articleSchema.index(
  { title: 'text', content: 'text', excerpt: 'text', tags: 'text' },
  { weights: { title: 10, excerpt: 5, tags: 3, content: 1 }, name: 'article_text_index', default_language: 'none', language_override: 'lang_override' }
);

// Virtual: url
articleSchema.virtual('url').get(function () {
  return `/articles/${this.slug}`;
});

// Virtual: isExpired
articleSchema.virtual('isExpired').get(function () {
  return this.expireAt && this.expireAt < new Date();
});

// Pre-save: update popularity score
articleSchema.pre('save', function (next) {
  if (this.isModified('views.total') || this.isModified('publishedAt')) {
    this.popularityScore = this._calculatePopularityScore();
  }
  next();
});

// Calculate popularity score with recency decay (half-life 48h)
articleSchema.methods._calculatePopularityScore = function () {
  const views = this.views?.total || 0;
  const publishedAt = this.publishedAt || this.createdAt;
  if (!publishedAt) return views;

  const ageHours = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60);
  const halfLife = 48; // hours
  const decayFactor = Math.pow(0.5, ageHours / halfLife);

  return views * decayFactor;
};

// Static: find by slug including slug history
articleSchema.statics.findBySlug = function (slug) {
  return this.findOne({
    $or: [{ slug }, { slugHistory: slug }],
    isDeleted: { $ne: true },
  });
};

// Static: increment view count in DB (called from a background job)
articleSchema.statics.incrementViews = async function (articleId, amount = 1) {
  return this.findByIdAndUpdate(
    articleId,
    {
      $inc: { 'views.total': amount, 'views.last24h': amount, 'views.last7d': amount },
      $set: { 'views.lastUpdated': new Date() },
    },
    { new: true }
  );
};

// Query helper: published only
articleSchema.query.published = function () {
  return this.where({ status: 'published', isDeleted: { $ne: true } });
};

// Query helper: not deleted
articleSchema.query.notDeleted = function () {
  return this.where({ isDeleted: { $ne: true } });
};

module.exports = mongoose.model('Article', articleSchema);
