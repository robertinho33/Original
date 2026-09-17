'use strict';

const orderRepository =
  require('../orders/order-repository');

const catalogService =
  require('../catalog/catalog-service');

const {
  getAllEvents
} = require('../../infrastructure/audit-reader');

function getDashboard() {
  const orders =
    orderRepository.findAll();

  const totalOrders =
    orders.length;

  const pending =
    orders.filter(order =>
      order.status === 'pending' ||
      order.status === 'awaiting_payment'
    ).length;

  const confirmed =
    orders.filter(order =>
      order.status === 'confirmed' ||
      order.status === 'processing'
    ).length;

  const completed =
    orders.filter(order =>
      order.status === 'completed'
    ).length;

  const cancelled =
    orders.filter(order =>
      order.status === 'cancelled'
    ).length;

  const revenue =
    orders
      .filter(order =>
        order.status !== 'cancelled'
      )
      .reduce(
        (sum, order) =>
          sum + Number(order.total || 0),
        0
      );

  return {
    generatedAt:
      new Date().toISOString(),

    orders: {
      total: totalOrders,
      pending,
      confirmed,
      completed,
      cancelled
    },

    financial: {
      revenue: Number(
        revenue.toFixed(2)
      )
    }
  };
}

function listOrders(filters = {}) {
  let orders =
    orderRepository.findAll();

  if (filters.status) {
    orders = orders.filter(
      order =>
        order.status === filters.status
    );
  }

  if (filters.email) {
    const email =
      String(filters.email)
        .trim()
        .toLowerCase();

    orders = orders.filter(
      order =>
        String(
          order.customer?.email || ''
        )
        .toLowerCase() === email
    );
  }

  return orders;
}

function getOrder(orderNumber) {
  return orderRepository.findByOrderNumber(
    orderNumber
  );
}

function getAuditTrail() {
  return getAllEvents();
}

module.exports = {
  getDashboard,
  listOrders,
  getOrder,
  getAuditTrail
};
