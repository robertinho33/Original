'use strict';

const { AppError } = require('./app-error');

const idempotency =
  require('../infrastructure/idempotency-store');

function idempotencyMiddleware(req, res, next) {
  if (req.method === 'GET') {
    return next();
  }

  const key =
    req.get('idempotency-key') ||
    req.get('x-idempotency-key');

  if (!key) {
    return next();
  }

  if (key.length < 8 || key.length > 200) {
    return next(
      new AppError(
        'Idempotency-Key inválida.',
        {
          code: 'INVALID_IDEMPOTENCY_KEY',
          status: 400
        }
      )
    );
  }

  const existing = idempotency.get(key);

  if (existing) {
    res.status(existing.status);
    return res.json(existing.body);
  }

  const originalJson = res.json.bind(res);

  res.json = body => {
    idempotency.set(key, {
      status: res.statusCode,
      body
    });

    return originalJson(body);
  };

  req.idempotencyKey = key;

  next();
}

module.exports = {
  idempotencyMiddleware
};
