'use strict';

const crypto = require('crypto');

function getAdminToken() {
  return String(
    process.env.AUREA_ADMIN_TOKEN || ''
  ).trim();
}

function hasAdminToken() {
  return getAdminToken().length >= 32;
}

function safeCompare(a, b) {
  const left =
    Buffer.from(String(a), 'utf8');

  const right =
    Buffer.from(String(b), 'utf8');

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    left,
    right
  );
}

module.exports = {
  getAdminToken,
  hasAdminToken,
  safeCompare
};
