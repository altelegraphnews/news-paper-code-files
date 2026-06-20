'use strict';

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config/env');

// Ensure logs directory exists
const logDir = path.dirname(config.logging.file);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const devFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  let log = `${ts} [${level}]: ${stack || message}`;
  if (Object.keys(meta).length > 0) {
    log += `\n${JSON.stringify(meta, null, 2)}`;
  }
  return log;
});

const transports = [
  new winston.transports.Console({
    format: config.env === 'production'
      ? combine(timestamp(), errors({ stack: true }), json())
      : combine(colorize(), timestamp({ format: 'HH:mm:ss' }), errors({ stack: true }), devFormat),
  }),
];

if (config.env === 'production') {
  transports.push(
    new winston.transports.File({
      filename: config.logging.file,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
      format: combine(timestamp(), errors({ stack: true }), json()),
    }),
    new winston.transports.File({
      filename: config.logging.file.replace('.log', '.error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
      format: combine(timestamp(), errors({ stack: true }), json()),
    })
  );
}

const logger = winston.createLogger({
  level: config.logging.level,
  defaultMeta: { service: 'alwid-api' },
  transports,
  exitOnError: false,
});

module.exports = logger;
