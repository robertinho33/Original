'use strict';

class AppError extends Error {
  constructor(message, { code = 'APP_ERROR', status = 400, details = null } = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }
}

module.exports = { AppError };
