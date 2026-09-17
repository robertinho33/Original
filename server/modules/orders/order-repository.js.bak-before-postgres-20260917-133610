'use strict';

const {
  readDatabase,
  writeDatabase
} = require('../../infrastructure/database');

function create(order) {
  const database = readDatabase();

  const now = new Date().toISOString();

  const storedOrder = {
    ...order,
    createdAt: order.createdAt || now,
    updatedAt: now
  };

  database.orders.push(storedOrder);

  writeDatabase(database);

  return storedOrder;
}

function findByOrderNumber(orderNumber) {
  const database = readDatabase();

  return database.orders.find(
    order => order.orderNumber === orderNumber
  ) || null;
}

function findByEmail(email) {
  const database = readDatabase();

  const normalized =
    String(email || '').trim().toLowerCase();

  return database.orders.filter(order => {
    return String(
      order.customer?.email || ''
    ).toLowerCase() === normalized;
  });
}

function findAll({
  limit = 100,
  offset = 0
} = {}) {
  const database = readDatabase();

  return database.orders
    .slice()
    .reverse()
    .slice(offset, offset + limit);
}

function update(orderNumber, changes) {
  const database = readDatabase();

  const index = database.orders.findIndex(
    order => order.orderNumber === orderNumber
  );

  if (index === -1) {
    return null;
  }

  database.orders[index] = {
    ...database.orders[index],
    ...changes,
    updatedAt: new Date().toISOString()
  };

  writeDatabase(database);

  return database.orders[index];
}

module.exports = {
  create,
  findByOrderNumber,
  findByEmail,
  findAll,
  update
};
