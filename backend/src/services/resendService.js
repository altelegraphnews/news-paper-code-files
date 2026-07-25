'use strict';

/**
 * Thin client for Resend's inbound (receiving) email API.
 *
 * The webhook only delivers metadata, so we call these endpoints to pull the
 * full body and download attachment files.
 *   - GET /emails/receiving/{id}              → from, subject, text, html, attachments[]
 *   - GET /emails/receiving/{id}/attachments  → same list + signed download_url per file
 * Docs: https://resend.com/docs/dashboard/receiving/introduction
 */

const config = require('../config/env');
const logger = require('../utils/logger');

const API_BASE = 'https://api.resend.com';

const authHeaders = () => ({
  Authorization: `Bearer ${config.submissions.resendApiKey}`,
  Accept: 'application/json',
});

const request = async (path) => {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend ${path} → ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json();
};

// Full inbound email: from, to, subject, text, html, headers, attachments[]
const getReceivedEmail = (id) => request(`/emails/receiving/${encodeURIComponent(id)}`);

// Attachment list carries the signed download_url we need to fetch bytes
const getReceivedAttachments = async (id) => {
  const data = await request(`/emails/receiving/${encodeURIComponent(id)}/attachments`);
  // Resend returns either { data: [...] } or a bare array depending on endpoint
  return Array.isArray(data) ? data : (data.data || data.attachments || []);
};

// Download an attachment's bytes from its signed URL
const downloadAttachment = async (url, maxBytes = config.submissions.maxAttachmentBytes) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`attachment download → ${res.status}`);
  const len = parseInt(res.headers.get('content-length') || '0', 10);
  if (len && len > maxBytes) {
    logger.warn(`Skipping oversized attachment (${len} bytes > ${maxBytes})`);
    return null;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) return null;
  return buf;
};

module.exports = { getReceivedEmail, getReceivedAttachments, downloadAttachment };
