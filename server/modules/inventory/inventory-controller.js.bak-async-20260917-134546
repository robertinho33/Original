'use strict';

const service =
  require('./inventory-service');

function list(req, res) {
  const repository =
    require('./inventory-repository');

  res.json({
    success: true,
    data: repository.getAllItems()
  });
}

function reservations(req, res) {
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
