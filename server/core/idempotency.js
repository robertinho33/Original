'use strict';

const { AppError } = require('./app-error');

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

  // Reutilização de respostas deve ocorrer dentro da rota, após autorização,
  // usando tentativa persistida e comparação do corpo. Nunca no cache global.
  req.idempotencyKey = key;

  next();
}

module.exports = {
  idempotencyMiddleware
};
