'use strict';

const { getEnv } =
  require('./environment');

function getAllowedOrigins() {

  const configured =
    getEnv(
      'CORS_ORIGINS',
      ''
    );

  return configured
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

function isOriginAllowed(
  origin
) {

  if (!origin) {
    return true;
  }

  const allowed =
    getAllowedOrigins();

  if (
    allowed.length === 0
  ) {
    return false;
  }

  return allowed.includes(
    origin
  );
}

module.exports = {
  getAllowedOrigins,
  isOriginAllowed
};
