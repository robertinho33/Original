'use strict';

const { AppError } = require('../core/app-error');
const { logger } = require('./logger');

function errorHandler(error, req, res, next) {
  const isAppError = error instanceof AppError;

  const status = isAppError
    ? error.status
    : 500;

  const code = isAppError
    ? error.code
    : 'INTERNAL_ERROR';

  const message = isAppError
    ? error.message
    : 'Erro interno do servidor.';

  logger.error('HTTP error', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    status,
    code,
    error: error.message,
    stack: process.env.NODE_ENV === 'production'
      ? undefined
      : error.stack
  });

  if (res.headersSent) {
    return next(error);
  }

  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      requestId: req.requestId
    }
  });
}

module.exports = { errorHandler };
