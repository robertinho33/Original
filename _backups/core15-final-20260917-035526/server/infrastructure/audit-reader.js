'use strict';

const fs = require('fs');
const path = require('path');

const AUDIT_FILE = path.resolve(
  process.cwd(),
  'server',
  'data',
  'audit',
  'events.json'
);

function getAllEvents() {
  if (!fs.existsSync(AUDIT_FILE)) {
    return [];
  }

  try {
    const raw =
      fs.readFileSync(
        AUDIT_FILE,
        'utf8'
      );

    const database =
      raw.trim()
        ? JSON.parse(raw)
        : { events: [] };

    return Array.isArray(database.events)
      ? database.events
      : [];
  } catch {
    return [];
  }
}

function getEventsByOrder(orderNumber) {
  return getAllEvents().filter(
    event =>
      event.orderNumber === orderNumber
  );
}

module.exports = {
  getAllEvents,
  getEventsByOrder
};
