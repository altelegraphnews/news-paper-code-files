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

// Send an email via Resend (used to forward a copy of submissions to an inbox).
// attachments: [{ filename, buffer }]
const sendEmail = async ({ from, to, subject, html, text, replyTo, attachments = [] }) => {
  const body = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    ...(html ? { html } : {}),
    ...(text ? { text } : {}),
    ...(replyTo ? { reply_to: replyTo } : {}),
  };
  if (attachments.length) {
    body.attachments = attachments
      .filter((a) => a.buffer)
      .map((a) => ({ filename: a.filename || 'attachment', content: a.buffer.toString('base64') }));
  }
  const res = await fetch(`${API_BASE}/emails`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Resend send → ${res.status} ${t.slice(0, 200)}`);
  }
  return res.json();
};

module.exports = { getReceivedEmail, getReceivedAttachments, downloadAttachment, sendEmail };
