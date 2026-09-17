'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

function ensureDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(ORDERS_FILE)) {
    fs.writeFileSync(
      ORDERS_FILE,
      JSON.stringify({ orders: [] }, null, 2),
      'utf8'
    );
  }
}

function readDatabase() {
  ensureDatabase();

  const raw = fs.readFileSync(ORDERS_FILE, 'utf8');

  if (!raw.trim()) {
    return { orders: [] };
  }

  const data = JSON.parse(raw);

  if (!Array.isArray(data.orders)) {
    data.orders = [];
  }

  return data;
}

function writeDatabase(data) {
  ensureDatabase();

  const temporaryFile = `${ORDERS_FILE}.tmp`;

  fs.writeFileSync(
    temporaryFile,
    JSON.stringify(data, null, 2),
    'utf8'
  );

  fs.renameSync(temporaryFile, ORDERS_FILE);
}

module.exports = {
  DATA_DIR,
  ORDERS_FILE,
  ensureDatabase,
  readDatabase,
  writeDatabase
};
