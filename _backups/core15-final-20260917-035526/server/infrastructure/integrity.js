'use strict';

const crypto = require('crypto');

function createIntegrityHash(data) {
  const serialized =
    JSON.stringify(data);

  return crypto
    .createHash('sha256')
    .update(serialized, 'utf8')
    .digest('hex');
}

module.exports = {
  createIntegrityHash
};
