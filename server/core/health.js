'use strict';

const { environment } = require('../config/environment');

function healthCheck() {
  return {
    status: 'ok',
    service: 'Fios Perfeitos',
    environment: environment.nodeEnv,
    uptime: Number(process.uptime().toFixed(2)),
    timestamp: new Date().toISOString()
  };
}

module.exports = { healthCheck };
