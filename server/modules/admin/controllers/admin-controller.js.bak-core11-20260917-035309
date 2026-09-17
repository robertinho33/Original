'use strict';

const { buildOrderTimeline } = require('../../orders/order-timeline');

const adminService =
  require('../services/admin-service');

function dashboard(req, res) {
  const data =
    adminService.getDashboard();

  res.json({
    success: true,
    data
  });
}

function orders(req, res) {
  const data =
    adminService.listOrders(
      req.query || {}
    );

  res.json({
    success: true,
    data
  });
}

function order(req, res) {
  const data =
    adminService.getOrder(
      req.params.orderNumber
    );

  if (!data) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'ORDER_NOT_FOUND',
        message: 'Pedido não encontrado.'
      }
    });
  }

  return res.json({
    success: true,
    data
  });
}

function audit(req, res) {
  res.json({
    success: true,
    data: adminService.getAuditTrail()
  });
}

function orderTimeline(req, res) {
  const data =
    buildOrderTimeline(
      req.params.orderNumber
    );

  return res.json({
    success: true,
    data
  });
}

module.exports = {
  dashboard,
  orders,
  order,
  audit,
  orderTimeline
};

