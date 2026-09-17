'use strict';

const crypto = require('crypto');

const repository =
  require('./inventory-repository');

const {
  AppError
} = require('../../core/app-error');

function normalizeQuantity(quantity) {
  const value =
    Number(quantity);

  if (
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new AppError(
      'Quantidade de estoque inválida.',
      {
        code: 'INVALID_STOCK_QUANTITY',
        status: 400
      }
    );
  }

  return value;
}

function ensureStockItem(sku, stock = 0) {
  const normalizedSku =
    String(sku).trim();

  const existing =
    repository.getItem(
      normalizedSku
    );

  if (existing) {
    return existing;
  }

  return repository.saveItem({
    sku: normalizedSku,
    stock: Math.max(
      0,
      Number(stock) || 0
    ),
    reserved: 0,
    updatedAt:
      new Date().toISOString()
  });
}

function getAvailableStock(sku) {
  const item =
    repository.getItem(sku);

  if (!item) {
    return 0;
  }

  return Math.max(
    0,
    Number(item.stock || 0) -
    Number(item.reserved || 0)
  );
}

function reserve(sku, quantity, orderNumber) {
  const normalizedQuantity =
    normalizeQuantity(quantity);

  const item =
    repository.getItem(sku);

  if (!item) {
    throw new AppError(
      `SKU não encontrada no estoque: ${sku}`,
      {
        code: 'STOCK_ITEM_NOT_FOUND',
        status: 404
      }
    );
  }

  const available =
    getAvailableStock(sku);

  if (available < normalizedQuantity) {
    throw new AppError(
      `Estoque insuficiente para ${sku}.`,
      {
        code: 'INSUFFICIENT_STOCK',
        status: 409,
        details: {
          sku,
          requested: normalizedQuantity,
          available
        }
      }
    );
  }

  const reservationId =
    `res_${crypto.randomUUID()}`;

  repository.updateItem(
    sku,
    {
      reserved:
        Number(item.reserved || 0) +
        normalizedQuantity
    }
  );

  const reservation = {
    id: reservationId,
    orderNumber,
    sku,
    quantity: normalizedQuantity,
    status: 'reserved',
    createdAt:
      new Date().toISOString()
  };

  repository.saveReservation(
    reservation
  );

  return reservation;
}

function release(reservationId) {
  const reservation =
    repository.getReservation(
      reservationId
    );

  if (!reservation) {
    return null;
  }

  if (
    reservation.status !==
    'reserved'
  ) {
    return reservation;
  }

  const item =
    repository.getItem(
      reservation.sku
    );

  if (item) {
    repository.updateItem(
      reservation.sku,
      {
        reserved: Math.max(
          0,
          Number(item.reserved || 0) -
          reservation.quantity
        )
      }
    );
  }

  const updated = {
    ...reservation,
    status: 'released',
    releasedAt:
      new Date().toISOString()
  };

  repository.saveReservation(
    updated
  );

  return updated;
}

function commit(reservationId) {
  const reservation =
    repository.getReservation(
      reservationId
    );

  if (!reservation) {
    return null;
  }

  if (
    reservation.status ===
    'committed'
  ) {
    return reservation;
  }

  if (
    reservation.status !==
    'reserved'
  ) {
    throw new AppError(
      'Reserva não pode ser confirmada.',
      {
        code: 'INVALID_RESERVATION_STATE',
        status: 409
      }
    );
  }

  const item =
    repository.getItem(
      reservation.sku
    );

  if (!item) {
    throw new AppError(
      'Item de estoque não encontrado.',
      {
        code: 'STOCK_ITEM_NOT_FOUND',
        status: 404
      }
    );
  }

  const newStock =
    Number(item.stock || 0) -
    reservation.quantity;

  const newReserved =
    Math.max(
      0,
      Number(item.reserved || 0) -
      reservation.quantity
    );

  if (newStock < 0) {
    throw new AppError(
      'Estoque inconsistente.',
      {
        code: 'STOCK_INCONSISTENCY',
        status: 409
      }
    );
  }

  repository.updateItem(
    reservation.sku,
    {
      stock: newStock,
      reserved: newReserved
    }
  );

  const updated = {
    ...reservation,
    status: 'committed',
    committedAt:
      new Date().toISOString()
  };

  repository.saveReservation(
    updated
  );

  return updated;
}

module.exports = {
  ensureStockItem,
  getAvailableStock,
  reserve,
  release,
  commit
};

