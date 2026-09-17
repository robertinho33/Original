'use strict';

const { logger } = require('./logger');

function httpLogger(req, res, next) {
  const startedAt = Date.now();

  res.on('finish', () => {
    logger.info('HTTP request', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startedAt
    });
  });

  next();
}

module.exports = { httpLogger };
