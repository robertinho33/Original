'use strict';

const { logger } = require('./logger');

function httpLogger(req, res, next) {
  const startedAt = Date.now();
  const pathname = String(req.originalUrl || '').split('?')[0];
  const logPath = pathname.endsWith('/shipping/melhor-envio/callback') ? pathname : req.originalUrl;

  res.on('finish', () => {
    logger.info('HTTP request', {
      requestId: req.requestId,
      method: req.method,
      path: logPath,
      status: res.statusCode,
      durationMs: Date.now() - startedAt
    });
  });

  next();
}

module.exports = { httpLogger };
