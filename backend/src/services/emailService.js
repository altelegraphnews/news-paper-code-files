'use strict';

const nodemailer = require('nodemailer');
const config = require('../config/env');
const logger = require('../utils/logger');

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: { user: config.email.user, pass: config.email.pass },
    });
  }
  return transporter;
};

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const t = getTransporter();
    await t.sendMail({
      from: `"${config.email.fromName}" <${config.email.fromAddress}>`,
      to,
      subject,
      html,
      text,
    });
    logger.info(`Email sent to ${to}: ${subject}`);
  } catch (err) {
    logger.error('Email send error:', err.message);
    throw err;
  }
};

const sendPasswordReset = async ({ to, name, resetUrl }) => {
  await sendEmail({
    to,
    subject: 'إعادة تعيين كلمة المرور - الود',
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a2744;">إعادة تعيين كلمة المرور</h2>
        <p>مرحباً ${name}،</p>
        <p>تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بك. اضغط على الزر أدناه لإتمام العملية:</p>
        <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#1a2744;color:#fff;text-decoration:none;border-radius:4px;margin:16px 0;">
          إعادة تعيين كلمة المرور
        </a>
        <p>ينتهي هذا الرابط خلال ساعة واحدة.</p>
        <p>إذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذه الرسالة.</p>
        <hr />
        <p style="color:#666;font-size:12px;">الود للأخبار العربية</p>
      </div>
    `,
  });
};

const sendPasswordChanged = async ({ to, name }) => {
  await sendEmail({
    to,
    subject: 'تم تغيير كلمة المرور - الود',
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a2744;">تم تغيير كلمة المرور</h2>
        <p>مرحباً ${name}،</p>
        <p>تم تغيير كلمة المرور الخاصة بحسابك بنجاح.</p>
        <p>إذا لم تقم بهذا التغيير، يرجى التواصل مع الدعم الفني فوراً.</p>
        <hr />
        <p style="color:#666;font-size:12px;">الود للأخبار العربية</p>
      </div>
    `,
  });
};

const sendInvite = async ({ to, name, role, loginUrl, tempPassword }) => {
  await sendEmail({
    to,
    subject: 'دعوة للانضمام إلى فريق الود',
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a2744;">مرحباً بك في فريق الود</h2>
        <p>مرحباً ${name}،</p>
        <p>تمت دعوتك للانضمام إلى منصة الود الإخبارية بصلاحية: <strong>${role}</strong></p>
        <p>بيانات الدخول المؤقتة:</p>
        <ul>
          <li>البريد الإلكتروني: ${to}</li>
          <li>كلمة المرور المؤقتة: <strong>${tempPassword}</strong></li>
        </ul>
        <a href="${loginUrl}" style="display:inline-block;padding:12px 24px;background:#1a2744;color:#fff;text-decoration:none;border-radius:4px;margin:16px 0;">
          تسجيل الدخول الآن
        </a>
        <p>يرجى تغيير كلمة المرور فور تسجيل الدخول.</p>
        <hr />
        <p style="color:#666;font-size:12px;">الود للأخبار العربية</p>
      </div>
    `,
  });
};

module.exports = { sendEmail, sendPasswordReset, sendPasswordChanged, sendInvite };
