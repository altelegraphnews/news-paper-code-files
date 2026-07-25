'use strict';

const express = require('express');
const multer = require('multer');
const router = express.Router();

const { inboundWebhook, formSubmit, testIngest } = require('../controllers/submissionController');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { submissionLimiter } = require('../middleware/rateLimiter');

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Buffer uploads in memory; only .docx + images allowed
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 7 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === DOCX_MIME || /\.docx$/i.test(file.originalname)) {
      return cb(null, true);
    }
    cb(new Error('يُسمح بملف Word (‎.docx‎) والصور فقط'));
  },
});

const uploadFields = upload.fields([{ name: 'docx', maxCount: 1 }, { name: 'images', maxCount: 6 }]);

// Translate multer errors (size/type) into a clean 400 instead of a 500
const handleUpload = (req, res, next) =>
  uploadFields(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message || 'تعذّر رفع الملف' });
    next();
  });

// Resend inbound webhook (public — authenticated by Svix signature)
router.post('/inbound', inboundWebhook);

// Public on-site submission form
router.post('/form', submissionLimiter, handleUpload, formSubmit);

// Manual test intake (staff only)
router.post('/test-ingest', verifyToken, requirePermission('articles.publish'), testIngest);

module.exports = router;
