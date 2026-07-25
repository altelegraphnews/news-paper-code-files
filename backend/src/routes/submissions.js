'use strict';

const express = require('express');
const router = express.Router();

const { inboundWebhook, testIngest } = require('../controllers/submissionController');
const { verifyToken, requirePermission } = require('../middleware/auth');

// Resend inbound webhook (public — authenticated by Svix signature)
router.post('/inbound', inboundWebhook);

// Manual test intake (staff only) — create a pending article from text
router.post('/test-ingest', verifyToken, requirePermission('articles.publish'), testIngest);

module.exports = router;
