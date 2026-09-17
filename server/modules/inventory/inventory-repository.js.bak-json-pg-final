'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.resolve(
  process.cwd(),
  'server',
  'data',
  'inventory',
  'inventory.json'
);

function ensureFile() {
  const directory =
    path.dirname(FILE);

  fs.mkdirSync(directory, {
    recursive: true
  });

  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(
      FILE,
      JSON.stringify({
        items: {},
        reservations: {},
        updatedAt: null
      }, null, 2),
      'utf8'
    );
  }
}

function readDatabase() {
  ensureFile();

  const raw =
    fs.readFileSync(
      FILE,
      'utf8'
    );

  if (!raw.trim()) {
    return {
      items: {},
      reservations: {},
      updatedAt: null
    };
  }

  const database =
    JSON.parse(raw);

  database.items ||= {};
  database.reservations ||= {};

  return database;
}

function writeDatabase(database) {
  database.updatedAt =
    new Date().toISOString();

  const temporary =
    `${FILE}.tmp`;

  fs.writeFileSync(
    temporary,
    JSON.stringify(
      database,
      null,
      2
    ),
    'utf8'
  );

  fs.renameSync(
    temporary,
    FILE
  );
}

function getItem(sku) {
  const database =
    readDatabase();

  return database.items[sku] || null;
}

function getAllItems() {
  const database =
    readDatabase();

  return Object.values(
    database.items
  );
}

function saveItem(item) {
  if (!item?.sku) {
    throw new Error(
      'SKU obrigatória para estoque.'
    );
  }

  const database =
    readDatabase();

  database.items[item.sku] = {
    ...item,
    sku: String(item.sku)
  };

  writeDatabase(database);

  return database.items[item.sku];
}

function saveReservation(reservation) {
  if (!reservation?.id) {
    throw new Error(
      'Reserva inválida.'
    );
  }

  const database =
    readDatabase();

  database.reservations[
    reservation.id
  ] = reservation;

  writeDatabase(database);

  return reservation;
}

function getReservation(id) {
  const database =
    readDatabase();

  return database.reservations[id] || null;
}

function deleteReservation(id) {
  const database =
    readDatabase();

  delete database.reservations[id];

  writeDatabase(database);
}

function getAllReservations() {
  const database =
    readDatabase();

  return Object.values(
    database.reservations
  );
}

function updateItem(sku, patch) {
  const database =
    readDatabase();

  const current =
    database.items[sku];

  if (!current) {
    return null;
  }

  database.items[sku] = {
    ...current,
    ...patch,
    sku
  };

  writeDatabase(database);

  return database.items[sku];
}

module.exports = {
  readDatabase,
  writeDatabase,
  getItem,
  getAllItems,
  saveItem,
  updateItem,
  saveReservation,
  getReservation,
  deleteReservation,
  getAllReservations
};
