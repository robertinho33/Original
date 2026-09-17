'use strict';

const service =
  require('./inventory-service');

async function list(req, res) {
  const repository =
    require('./inventory-repository');

  res.json({
    success: true,
    data: repository.getAllItems()
  });
}

async function reservations(req, res) {
  const repository =
    require('./inventory-repository');

  res.json({
    success: true,
    data:
      repository.getAllReservations()
  });
}

module.exports = {
  list,
  reservations
};

