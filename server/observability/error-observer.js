'use strict';

const logger =
  require('./structured-logger');

function observeError(error, context = {}) {
  return logger.error(
    error?.message ||
      'Erro desconhecido.',
    {
      name:
        error?.name || 'Error',

      code:
        error?.code || null,

      stack:
        error?.stack || null,

      ...context
    }
  );
}

module.exports = {
  observeError
};
