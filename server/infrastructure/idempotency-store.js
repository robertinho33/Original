'use strict';

const crypto = require('crypto');

const store = new Map();

function createKey() {
  return `idem_${crypto.randomUUID()}`;
}

function normalizeKey(value) {
  return String(value || '').trim();
}

function get(key) {
  const normalized = normalizeKey(key);

  if (!normalized) {
    return null;
  }

  return store.get(normalized) || null;
}

function set(key, value) {
  const normalized = normalizeKey(key);

  if (!normalized) {
    return;
  }

  store.set(normalized, {
    ...value,
    storedAt: Date.now()
  });
}

function remove(key) {
  store.delete(normalizeKey(key));
}

function cleanup(maxAgeMs = 24 * 60 * 60 * 1000) {
  const now = Date.now();

  for (const [key, value] of store.entries()) {
    if (now - value.storedAt > maxAgeMs) {
      store.delete(key);
    }
  }
}

setInterval(cleanup, 60 * 60 * 1000).unref();

module.exports = {
  createKey,
  normalizeKey,
  get,
  set,
  remove,
  cleanup
};
