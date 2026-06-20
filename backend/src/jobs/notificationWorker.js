'use strict';

const { Worker } = require('bullmq');
const config = require('../config/env');
const { sendBreakingNews } = require('../services/notificationService');
const logger = require('../utils/logger');

const connection = {
  host: config.bull.redis.host,
  port: config.bull.redis.port,
  password: config.bull.redis.password,
};

const processJob = async (job) => {
  logger.info(`Processing notification job: ${job.name} (${job.id})`);

  switch (job.name) {
    case 'push-breaking':
      await sendBreakingNews(job.data);
      break;
    default:
      logger.warn(`Unknown notification job: ${job.name}`);
  }
};

let worker = null;

const startNotificationWorker = () => {
  worker = new Worker('notification', processJob, { connection, concurrency: 2 });

  worker.on('completed', (job) => logger.info(`Notification job ${job.id} completed`));
  worker.on('failed', (job, err) => logger.error(`Notification job ${job?.id} failed:`, err.message));

  logger.info('Notification worker started');
  return worker;
};

const stopNotificationWorker = async () => {
  if (worker) { await worker.close(); }
};

module.exports = { startNotificationWorker, stopNotificationWorker };
