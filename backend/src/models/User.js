'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { effectivePermissions } = require('../config/permissions');

const ROLES = ['reader', 'author', 'editor', 'admin', 'super_admin'];

const refreshTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true },
    userAgent: String,
    ipAddress: String,
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'الاسم مطلوب'],
      trim: true,
      maxlength: [100, 'لا يمكن أن يتجاوز الاسم 100 حرف'],
    },
    nameEn: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, 'البريد الإلكتروني مطلوب'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'البريد الإلكتروني غير صالح'],
    },
    password: {
      type: String,
      required: [true, 'كلمة المرور مطلوبة'],
      minlength: [8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'],
      select: false,
    },
    role: {
      type: String,
      enum: ROLES,
      default: 'reader',
    },
    // Admin-set per-user grants/revocations on top of role defaults
    // e.g. { 'articles.publish': true, 'media.upload': false }
    // Mixed (not Map): permission keys contain dots, which Map keys forbid
    permissionOverrides: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    jobTitle: {
      type: String,
      trim: true,
      maxlength: [100, 'المسمى الوظيفي لا يتجاوز 100 حرف'],
    },
    avatar: {
      url: String,
      publicId: String,
    },
    bio: {
      type: String,
      maxlength: [500, 'السيرة الذاتية لا تتجاوز 500 حرف'],
    },
    socialLinks: {
      twitter: String,
      linkedin: String,
      facebook: String,
      website: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    refreshTokens: {
      type: [refreshTokenSchema],
      select: false,
      default: [],
    },
    lastLoginAt: Date,
    lastLoginIp: String,
    loginCount: {
      type: Number,
      default: 0,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    pushSubscriptions: [
      {
        endpoint: String,
        keys: {
          p256dh: String,
          auth: String,
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    preferences: {
      language: { type: String, default: 'ar' },
      notifications: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        breaking: { type: Boolean, default: true },
        comments: { type: Boolean, default: true },
      },
      categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    },
    articlesCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.password;
        delete ret.refreshTokens;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.emailVerificationToken;
        delete ret.emailVerificationExpires;
        // Expose slug as authorSlug for frontend author URL generation
        ret.authorSlug = ret.slug || ret._id?.toString();
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ createdAt: -1 });

// Auto-generate slug from name on save
userSchema.pre('save', function (next) {
  if (this.isModified('name') || !this.slug) {
    this.slug = this.name
      .trim()
      .toLowerCase()
      .replace(/[؀-ۿ\s]+/g, (m) => m.trim().replace(/\s+/g, '-'))
      .replace(/[^a-z0-9؀-ۿ-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') ||
      this._id.toString();
  }
  next();
});

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Generate password reset token
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  return resetToken;
};

// Generate email verification token
userSchema.methods.createEmailVerificationToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = crypto.createHash('sha256').update(token).digest('hex');
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return token;
};

// Clean expired refresh tokens
userSchema.methods.cleanExpiredTokens = function () {
  const now = new Date();
  this.refreshTokens = this.refreshTokens.filter((rt) => rt.expiresAt > now);
};

// Effective permissions (role defaults + admin overrides)
userSchema.methods.getPermissions = function () {
  return effectivePermissions(this.role, this.permissionOverrides);
};

// Check a single permission key, e.g. user.can('articles.publish')
userSchema.methods.can = function (key) {
  if (this.role === 'super_admin') return true;
  return this.getPermissions()[key] === true;
};

// Check if user has role
userSchema.methods.hasRole = function (...roles) {
  return roles.includes(this.role);
};

// Check if user is at least [role]
userSchema.methods.isAtLeast = function (role) {
  const hierarchy = { reader: 0, author: 1, editor: 2, admin: 3, super_admin: 4 };
  return (hierarchy[this.role] || 0) >= (hierarchy[role] || 0);
};

userSchema.statics.ROLES = ROLES;

module.exports = mongoose.model('User', userSchema);
