'use strict';

/**
 * Branded HTML email templates — inline-styled and table-based for email-client
 * compatibility, matching the website's identity (ink #1c2027, gold #b8923d,
 * cream #fffcf5, serif wordmark, morse-code motif).
 */

const C = {
  ink: '#1c2027',
  inkDeep: '#10151f',
  gold: '#b8923d',
  goldLight: '#e3c988',
  cream: '#efe7d7',
  card: '#fffdf7',
  border: '#e3dac6',
  text: '#23262e',
  textSecondary: '#55596b',
  muted: '#8a8f9e',
};

// A short morse motif ("·— · —") rendered in gold, echoing the site's dividers
const morse = `<div style="font-size:13px;letter-spacing:6px;color:${C.gold};line-height:1;margin:0">· — ·&nbsp;&nbsp;— ·&nbsp;&nbsp;· —</div>`;

const ACK_NOTE = 'هذه رسالة آليّة للإشعار بالاستلام، ولا تتطلّب ردّاً.';
const REPLY_NOTE = 'يمكنكم الردّ على هذه الرسالة مباشرةً للتواصل مع هيئة التحرير.';

const shell = (inner, footerNote = ACK_NOTE) => `
<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${C.cream};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream};padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${C.card};border:1px solid ${C.border};border-radius:4px;overflow:hidden;">
        <!-- Masthead -->
        <tr><td style="background:${C.ink};padding:28px 24px 22px;text-align:center;border-bottom:3px solid ${C.gold};">
          <div style="font-family:'Amiri',Georgia,'Times New Roman',serif;font-size:34px;font-weight:700;color:${C.goldLight};letter-spacing:2px;line-height:1;">التلغراف</div>
          <div style="font-family:Georgia,serif;font-size:12px;color:#b9bfce;letter-spacing:3px;margin-top:8px;">مجلة أدبية وثقافية</div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:34px 40px 8px;text-align:right;" dir="rtl">
          ${inner}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:22px 40px 30px;text-align:center;border-top:1px solid ${C.border};">
          <div style="margin-bottom:10px;">${morse}</div>
          <a href="https://al-telegraph.com" style="color:${C.gold};text-decoration:none;font-family:Georgia,serif;font-size:13px;">al-telegraph.com</a>
          <div style="font-family:'Amiri',Georgia,serif;font-size:12px;color:${C.muted};margin-top:8px;line-height:1.7;">
            ${footerNote}
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

/* ─── Shared pieces ──────────────────────────────────────────────────────── */

// Writer names, article titles and editors' notes are written by people and end
// up inside an HTML document. Escape every one of them on the way in.
const escapeHtml = (value) =>
  String(value ?? '').replace(/[<>&"']/g, (c) => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]
  ));

const p = (t) =>
  `<p style="font-family:'Amiri',Georgia,serif;font-size:17px;line-height:2.05;color:${C.text};margin:0 0 18px;">${t}</p>`;

const eyebrow = (label) =>
  `<div style="font-family:Georgia,serif;font-size:12px;letter-spacing:3px;color:${C.gold};margin-bottom:10px;">${label}</div>`;

const heading = (text) =>
  `<h1 style="font-family:'Amiri',Georgia,serif;font-size:25px;font-weight:700;color:${C.ink};margin:0 0 22px;line-height:1.5;">${text}</h1>`;

const signature = `
    <div style="margin-top:26px;padding-top:18px;border-top:1px solid ${C.border};">
      <div style="font-family:'Amiri',Georgia,serif;font-size:16px;font-weight:700;color:${C.ink};">هيئة التحرير</div>
      <div style="font-family:'Amiri',Georgia,serif;font-size:14px;color:${C.textSecondary};margin-top:2px;">مجلّة التلغراف — مجلة أدبية وثقافية</div>
    </div>`;

const greet = (name) => (name ? `${escapeHtml(name)}،` : 'تحيّةَ التلغراف،');

const quoted = (title) => (title ? `الموسومة بـ«${escapeHtml(title)}»` : '');

// A subject line is a header: a newline in one would split it.
const subjectSafe = (title) => String(title).replace(/[\r\n]+/g, ' ').trim().slice(0, 80);

/**
 * Acknowledgement sent to a writer when their submission is received.
 * Formal Arabic (فصحى), matching the magazine's editorial voice.
 */
const submissionAck = ({ senderName, title } = {}) => {
  // A subject-less email is titled «مساهمة بريدية — <date>» by the ingester;
  // quoting that back reads like a mistake, so it is treated as no title.
  const hasTitle = title && !/^مساهمة بريدية —/.test(title);
  const worked = hasTitle
    ? `وصولَ مساهمتكم ${quoted(title)}، وقد أُدرِجت ضمن أعمالٍ تنتظر النظر والتقويم.`
    : `وصولَ مساهمتكم، وقد أُدرِجت ضمن أعمالٍ تنتظر النظر والتقويم.`;

  const inner = `
    ${eyebrow('إشعار استلام')}
    ${heading('تسلَّمنا مساهمتكم بكلّ تقدير')}
    ${p(greet(senderName))}
    ${p(`يسرُّ هيئةَ تحرير مجلّة التلغراف أن تؤكّد لكم ${worked}`)}
    ${p('نقرأ ما يصلنا بعنايةٍ وأناة، ونُعلمكم بقرار النشر خلال مدّةٍ تتراوح بين يومٍ وأربعة أيامٍ من تاريخ هذه الرسالة.')}
    ${p('نشكر لكم ثقتكم بالتلغراف، واختياركم إيّاه منبراً لكلمتكم.')}
    ${signature}`;

  return {
    subject: 'إشعار استلام مساهمتكم — مجلّة التلغراف',
    html: shell(inner),
  };
};

/* ─── Editorial decision letters ──────────────────────────────────────────
   Sent when an editor approves or returns a submission. The acknowledgement
   promises «نُعلمكم بقرار النشر», so these are the other half of a promise the
   magazine already makes to every writer — until they existed, a rejected
   writer was told nothing at all and had no way to learn why.                */

/**
 * Article returned to its writer, carrying the editor's reason.
 */
const submissionRejected = ({ senderName, title, note } = {}) => {
  const reason = String(note || '').trim();
  const inner = `
    ${eyebrow('قرار التحرير')}
    ${heading('شكراً لمساهمتكم، ولنا عليها ملاحظات')}
    ${p(greet(senderName))}
    ${p(`قرأت هيئةُ تحرير مجلّة التلغراف مساهمتَكم ${quoted(title)} بعنايةٍ وتقدير، ونعتذر عن عدم نشرها بصيغتها الحالية.`)}
    ${reason ? `
    <div style="background:${C.cream};border-right:3px solid ${C.gold};border-radius:3px;padding:16px 18px;margin:0 0 20px;">
      <div style="font-family:Georgia,serif;font-size:11px;letter-spacing:2px;color:${C.gold};margin-bottom:8px;">ملاحظات هيئة التحرير</div>
      <div style="font-family:'Amiri',Georgia,serif;font-size:16px;line-height:1.95;color:${C.text};white-space:pre-line;">${escapeHtml(reason)}</div>
    </div>` : ''}
    ${p('نرحّب بمساهمةٍ منقّحةٍ في ضوء ما تقدّم، وبكلّ ما تجودون به مستقبلاً. ولكم أن تردّوا على هذه الرسالة إن أردتم مزيدَ إيضاح.')}
    ${p('نشكر لكم ثقتكم بالتلغراف.')}
    ${signature}`;

  return {
    subject: title
      ? `بشأن مساهمتكم «${subjectSafe(title)}» — مجلّة التلغراف`
      : 'بشأن مساهمتكم — مجلّة التلغراف',
    html: shell(inner, REPLY_NOTE),
  };
};

/**
 * Article accepted and published — the other outcome the acknowledgement
 * promised to report.
 */
const submissionApproved = ({ senderName, title, url } = {}) => {
  const inner = `
    ${eyebrow('قرار التحرير')}
    ${heading('يسرّنا أن نُعلمكم بنشر مساهمتكم')}
    ${p(greet(senderName))}
    ${p(`بعد قراءةٍ وتقويم، قرّرت هيئةُ تحرير مجلّة التلغراف نشرَ مساهمتِكم ${quoted(title)}، وقد صارت متاحةً لقرّاء المجلّة.`)}
    ${url ? `
    <div style="margin:0 0 22px;">
      <a href="${escapeHtml(url)}" style="display:inline-block;background:${C.ink};color:${C.goldLight};font-family:'Amiri',Georgia,serif;font-size:16px;text-decoration:none;padding:12px 26px;border-radius:3px;">قراءة المقال المنشور</a>
    </div>` : ''}
    ${p('نشكر لكم ثقتكم بالتلغراف، واختياركم إيّاه منبراً لكلمتكم، ونتطلّع إلى المزيد.')}
    ${signature}`;

  return {
    subject: title
      ? `نُشرت مساهمتكم «${subjectSafe(title)}» — مجلّة التلغراف`
      : 'نُشرت مساهمتكم — مجلّة التلغراف',
    html: shell(inner, REPLY_NOTE),
  };
};

module.exports = { submissionAck, submissionRejected, submissionApproved };
