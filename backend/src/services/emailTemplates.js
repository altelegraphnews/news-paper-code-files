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

const shell = (inner) => `
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
            هذه رسالة آليّة للإشعار بالاستلام، ولا تتطلّب ردّاً.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

/**
 * Acknowledgement sent to a writer when their submission is received.
 * Formal Arabic (فصحى), matching the magazine's editorial voice.
 */
const submissionAck = ({ senderName, title } = {}) => {
  const hasTitle = title && !/^مساهمة بريدية —/.test(title);
  const salutation = senderName ? `${senderName}،` : 'تحيّةَ التلغراف،';
  const worked = hasTitle
    ? `وصولَ مساهمتكم الموسومة بـ«${title}»، وقد أُدرِجت ضمن أعمالٍ تنتظر النظر والتقويم.`
    : `وصولَ مساهمتكم، وقد أُدرِجت ضمن أعمالٍ تنتظر النظر والتقويم.`;

  const p = (t) => `<p style="font-family:'Amiri',Georgia,serif;font-size:17px;line-height:2.05;color:${C.text};margin:0 0 18px;">${t}</p>`;

  const inner = `
    <div style="font-family:Georgia,serif;font-size:12px;letter-spacing:3px;color:${C.gold};margin-bottom:10px;">إشعار استلام</div>
    <h1 style="font-family:'Amiri',Georgia,serif;font-size:25px;font-weight:700;color:${C.ink};margin:0 0 22px;line-height:1.5;">تسلَّمنا مساهمتكم بكلّ تقدير</h1>
    ${p(salutation)}
    ${p(`يسرُّ هيئةَ تحرير مجلّة التلغراف أن تؤكّد لكم ${worked}`)}
    ${p('نقرأ ما يصلنا بعنايةٍ وأناة، ونُعلمكم بقرار النشر خلال مدّةٍ أقصاها أربعةُ أسابيع من تاريخ هذه الرسالة.')}
    ${p('نشكر لكم ثقتكم بالتلغراف، واختياركم إيّاه منبراً لكلمتكم.')}
    <div style="margin-top:26px;padding-top:18px;border-top:1px solid ${C.border};">
      <div style="font-family:'Amiri',Georgia,serif;font-size:16px;font-weight:700;color:${C.ink};">هيئة التحرير</div>
      <div style="font-family:'Amiri',Georgia,serif;font-size:14px;color:${C.textSecondary};margin-top:2px;">مجلّة التلغراف — مجلة أدبية وثقافية</div>
    </div>`;

  return {
    subject: 'إشعار استلام مساهمتكم — مجلّة التلغراف',
    html: shell(inner),
  };
};

module.exports = { submissionAck };
