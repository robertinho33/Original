'use strict';

const fs = require('fs');
const path = require('path');

function checkFilesystem() {
  const dataDir =
    path.resolve(
      process.cwd(),
      'server',
      'data'
    );

  try {
    fs.mkdirSync(
      dataDir,
      {
        recursive: true
      }
    );

    fs.accessSync(
      dataDir,
      fs.constants.R_OK |
      fs.constants.W_OK
    );

    return true;

  } catch {
    return false;
  }
}

function getReadiness() {
  const filesystem =
    checkFilesystem();

  const ready =
    filesystem;

  return {
    ready,

    checks: {
      filesystem
    },

    timestamp:
      new Date().toISOString()
  };
}

module.exports = {
  getReadiness
};
