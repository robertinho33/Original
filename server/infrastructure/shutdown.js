'use strict';

const { logger } = require('./logger');

function registerGracefulShutdown(server) {
  let shuttingDown = false;

  async function shutdown(signal) {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    logger.info('Encerrando servidor', { signal });

    server.close(() => {
      logger.info('Servidor encerrado.');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Encerramento forçado.');
      process.exit(1);
    }, 10000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = { registerGracefulShutdown };
