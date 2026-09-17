'use strict';

const {
  AppError
} = require('./app-error');

const attempts = new Map();

const WINDOW_MS =
  15 * 60 * 1000;

const MAX_REQUESTS =
  120;

function getClientKey(req) {
  return (
    req.get('x-forwarded-for') ||
    req.ip ||
    req.socket?.remoteAddress ||
    'unknown'
  )
    .split(',')[0]
    .trim();
}

function adminRateLimit(req, res, next) {
  const key =
    getClientKey(req);

  const now =
    Date.now();

  const current =
    attempts.get(key);

  if (
    !current ||
    now - current.startedAt >
      WINDOW_MS
  ) {
    attempts.set(key, {
      startedAt: now,
      count: 1
    });

    return next();
  }

  current.count += 1;

  if (current.count > MAX_REQUESTS) {
    return next(
      new AppError(
        'Limite de requisições administrativas excedido.',
        {
          code: 'ADMIN_RATE_LIMIT',
          status: 429
        }
      )
    );
  }

  return next();
}

setInterval(() => {
  const now =
    Date.now();

  for (
    const [key, value]
    of attempts.entries()
  ) {
    if (
      now - value.startedAt >
      WINDOW_MS
    ) {
      attempts.delete(key);
    }
  }
}, WINDOW_MS).unref();

module.exports = {
  adminRateLimit
};
