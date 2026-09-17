'use strict';

function timestamp() {
  return new Date().toISOString();
}

function write(level, message, meta = {}) {
  const payload = {
    time: timestamp(),
    level,
    message,
    ...meta
  };

  const output = JSON.stringify(payload);

  if (level === 'error') {
    console.error(output);
    return;
  }

  if (level === 'warn') {
    console.warn(output);
    return;
  }

  console.log(output);
}

const logger = Object.freeze({
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta)
});

module.exports = { logger };
