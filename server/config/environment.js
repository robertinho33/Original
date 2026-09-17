'use strict';

function getEnv(name, fallback = undefined) {
  const value = process.env[name];

  if (value === undefined || value === '') {
    return fallback;
  }

  return value;
}

const environment = Object.freeze({
  nodeEnv: getEnv('NODE_ENV', 'development'),
  port: Number(getEnv('PORT', 3000)),
  isProduction: getEnv('NODE_ENV', 'development') === 'production'
});

module.exports = { environment, getEnv };
