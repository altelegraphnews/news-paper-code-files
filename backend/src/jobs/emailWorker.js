'use strict';

const { Worker } = require('bullmq');
const config = require('../config/env');
const { sendPasswordReset, sendPasswordChanged, sendInvite } = require('../services/emailService');
const logger = require('../utils/logger');

const connection = {
  host: config.bull.redis.host,
  port: config.bull.redis.port,
  password: config.bull.redis.password,
};

const processJob = async (job) => {
  logger.info(`Processing email job: ${job.name} (${job.id})`);

  switch (job.name) {
    case 'password-reset':
      await sendPasswordReset(job.data);
      break;
    case 'password-changed':
      await sendPasswordChanged(job.data);
      break;
    case 'invite':
      await sendInvite(job.data);
      break;
    default:
      logger.warn(`Unknown email job: ${job.name}`);
  }

  logger.info(`Email job completed: ${job.name} (${job.id})`);
};

let worker = null;

const startEmailWorker = () => {
  worker = new Worker('email', processJob, {
    connection,
    concurrency: 5,
  });

  worker.on('completed', (job) => {
    logger.info(`Email job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Email job ${job?.id} failed:`, err.message);
  });

  logger.info('Email worker started');
  return worker;
};

const stopEmailWorker = async () => {
  if (worker) {
    await worker.close();
    logger.info('Email worker stopped');
  }
};

module.exports = { startEmailWorker, stopEmailWorker };
