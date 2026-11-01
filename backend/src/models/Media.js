'use strict';

const mongoose = require('mongoose');

/**
 * One row per stored picture or video.
 *
 * R2 holds bytes and nothing else: it cannot say how big a picture is, who
 * uploaded it, or list the newest first. This index is what the media
 * library reads. It is also the paper's own record of every file it owns —
 * the thing that was missing when the Cloudinary account vanished on
 * 2026-10-31 and took the only list of its contents with it.
 */
const mediaSchema = new mongoose.Schema(
  {
    // The Cloudinary-era public_id for migrated files, <folder>/<random> for
    // new ones. No extension, so it matches the publicId fields and the
    // data-public-id attributes already stored in articles.
    publicId: { type: String, required: true, unique: true },
    key: { type: String, required: true }, // R2 key of the original
    url: { type: String, required: true },
    folder: String,
    format: String,
    bytes: Number,
    width: Number,
    height: Number,
    resourceType: { type: String, enum: ['image', 'video'], default: 'image' },
    variants: [String], // R2 keys of the renditions (mediaVariants)
    source: { type: String, enum: ['upload', 'cloudinary-migration'], default: 'upload' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'media' }
);

mediaSchema.index({ createdAt: -1, _id: -1 });

module.exports = mongoose.model('Media', mediaSchema);
