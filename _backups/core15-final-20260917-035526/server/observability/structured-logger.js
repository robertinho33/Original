'use strict';

const fs = require('fs');
const path = require('path');

const LOG_DIR =
  path.resolve(
    process.cwd(),
    'server',
    'data',
    'logs'
  );

const LOG_FILE =
  path.join(
    LOG_DIR,
    'application.log'
  );

function ensureDirectory() {
  fs.mkdirSync(
    LOG_DIR,
    {
      recursive: true
    }
  );
}

function write(level, message, context = {}) {
  ensureDirectory();

  const entry = {
    timestamp:
      new Date().toISOString(),

    level,

    message,

    ...context
  };

  const line =
    JSON.stringify(entry);

  fs.appendFileSync(
    LOG_FILE,
    `${line}\n`,
    'utf8'
  );

  return entry;
}

function info(message, context) {
  return write(
    'info',
    message,
    context
  );
}

function warn(message, context) {
  return write(
    'warn',
    message,
    context
  );
}

function error(message, context) {
  return write(
    'error',
    message,
    context
  );
}

module.exports = {
  write,
  info,
  warn,
  error
};
