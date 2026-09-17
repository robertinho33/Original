'use strict';

function buildOrderSummary(order) {
  return {
    orderNumber:
      order.orderNumber,

    status:
      order.status,

    total:
      Number(order.total || 0),

    customer: {
      name:
        order.customer?.name || null,

      email:
        order.customer?.email || null
    },

    payment: {
      method:
        order.payment?.method || null,

      status:
        order.payment?.status || null
    },

    logistics: {
      method:
        order.logistics?.method || null,

      status:
        order.logistics?.status || null
    },

    createdAt:
      order.createdAt || null,

    updatedAt:
      order.updatedAt || null
  };
}

function buildOrderList(orders) {
  return orders.map(
    buildOrderSummary
  );
}

module.exports = {
  buildOrderSummary,
  buildOrderList
};
