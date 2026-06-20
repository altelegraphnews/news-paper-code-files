'use strict';

const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'اسم التصنيف مطلوب'],
      trim: true,
      maxlength: [100, 'لا يمكن أن يتجاوز اسم التصنيف 100 حرف'],
    },
    nameEn: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    ancestors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],
    order: {
      type: Number,
      default: 0,
    },
    icon: {
      type: String,
      trim: true,
    },
    color: {
      type: String,
      trim: true,
      match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'رمز اللون غير صالح'],
    },
    image: {
      url: String,
      alt: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    showInNav: {
      type: Boolean,
      default: true,
    },
    showInHomepage: {
      type: Boolean,
      default: false,
    },
    articleCount: {
      type: Number,
      default: 0,
    },
    seoDefaults: {
      title: String,
      description: String,
      keywords: [String],
      ogTitle: String,
      ogDescription: String,
    },
    layoutTemplate: {
      type: String,
      enum: ['default', 'grid', 'list', 'magazine'],
      default: 'default',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for subcategories
categorySchema.virtual('subcategories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent',
  options: { sort: { order: 1 } },
});

// Index for efficient queries
categorySchema.index({ parent: 1, order: 1 });
categorySchema.index({ slug: 1 });
categorySchema.index({ isActive: 1, showInNav: 1 });

// Pre-save: build ancestors array for efficient tree traversal
categorySchema.pre('save', async function (next) {
  if (this.isModified('parent') && this.parent) {
    const parentDoc = await this.constructor.findById(this.parent).select('ancestors');
    if (parentDoc) {
      this.ancestors = [...(parentDoc.ancestors || []), this.parent];
    }
  } else if (!this.parent) {
    this.ancestors = [];
  }
  next();
});

// Static: get category tree
categorySchema.statics.getTree = async function () {
  const categories = await this.find({ isActive: true })
    .sort({ order: 1 })
    .lean();

  const map = {};
  const roots = [];

  categories.forEach((cat) => {
    map[cat._id.toString()] = { ...cat, children: [] };
  });

  categories.forEach((cat) => {
    if (cat.parent) {
      const parentId = cat.parent.toString();
      if (map[parentId]) {
        map[parentId].children.push(map[cat._id.toString()]);
      }
    } else {
      roots.push(map[cat._id.toString()]);
    }
  });

  return roots;
};

// Static: increment article count
categorySchema.statics.incrementArticleCount = async function (categoryId, amount = 1) {
  await this.findByIdAndUpdate(categoryId, { $inc: { articleCount: amount } });
};

module.exports = mongoose.model('Category', categorySchema);
