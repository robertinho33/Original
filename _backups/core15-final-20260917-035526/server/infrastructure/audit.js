'use strict';

const fs = require('fs');
const path = require('path');

const {
  createIntegrityHash
} = require('./integrity');

const AUDIT_DIR = path.resolve(
  process.cwd(),
  'server',
  'data',
  'audit'
);

const AUDIT_FILE = path.join(
  AUDIT_DIR,
  'events.json'
);

function ensureAuditStore() {
  fs.mkdirSync(AUDIT_DIR, {
    recursive: true
  });

  if (!fs.existsSync(AUDIT_FILE)) {
    fs.writeFileSync(
      AUDIT_FILE,
      JSON.stringify({
        events: []
      }, null, 2),
      'utf8'
    );
  }
}

function recordEvent({
  type,
  orderNumber = null,
  requestId = null,
  data = {}
}) {
  ensureAuditStore();

  const raw =
    fs.readFileSync(
      AUDIT_FILE,
      'utf8'
    );

  const database =
    raw.trim()
      ? JSON.parse(raw)
      : { events: [] };

  if (!Array.isArray(database.events)) {
    database.events = [];
  }

  const previous =
    database.events[
      database.events.length - 1
    ] || null;

  const event = {
    id: `evt_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`,

    type,

    orderNumber,

    requestId,

    data,

    previousHash:
      previous?.hash || null,

    createdAt:
      new Date().toISOString()
  };

  event.hash =
    createIntegrityHash(event);

  database.events.push(event);

  fs.writeFileSync(
    AUDIT_FILE,
    JSON.stringify(
      database,
      null,
      2
    ),
    'utf8'
  );

  return event;
}

module.exports = {
  ensureAuditStore,
  recordEvent
};
