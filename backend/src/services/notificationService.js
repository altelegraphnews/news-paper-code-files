'use strict';

const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');
const config = require('../config/env');
const logger = require('../utils/logger');

if (config.webPush.publicKey && config.webPush.privateKey) {
  webpush.setVapidDetails(
    config.webPush.subject,
    config.webPush.publicKey,
    config.webPush.privateKey
  );
}

/**
 * Send push notification to a single subscription
 */
const sendToSubscription = async (subscription, payload) => {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      // Subscription expired, remove it
      await PushSubscription.deleteOne({ endpoint: subscription.endpoint });
    }
    return false;
  }
};

/**
 * Broadcast to all subscribers
 */
const broadcast = async (payload) => {
  const subscriptions = await PushSubscription.find().lean();
  let sent = 0;
  let failed = 0;

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      sendToSubscription({ endpoint: sub.endpoint, keys: sub.keys }, payload)
    )
  );

  results.forEach((r) => {
    if (r.status === 'fulfilled' && r.value) sent++;
    else failed++;
  });

  logger.info(`Push notification broadcast: ${sent} sent, ${failed} failed`);
  return { sent, failed, total: subscriptions.length };
};

/**
 * Send breaking news notification
 */
const sendBreakingNews = async ({ title, excerpt, url, image }) => {
  const payload = {
    title: `🔴 عاجل: ${title}`,
    body: excerpt?.substring(0, 100) || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    image: image || undefined,
    data: { url },
    tag: 'breaking-news',
    renotify: true,
  };

  return broadcast(payload);
};

module.exports = { sendToSubscription, broadcast, sendBreakingNews };
