'use strict';

const orderService = require('./order-persistence');

function createOrderController(req, res, next) {
  try {
    const order = orderService.createOrder(req.body || {});

    res.status(201).json({
      success: true,
      data: order,
      requestId: req.requestId
    });
  } catch (error) {
    next(error);
  }
}

function getOrderController(req, res, next) {
  try {
    const order = orderService.getOrder(
      String(req.params.orderNumber || '').trim()
    );

    res.status(200).json({
      success: true,
      data: order,
      requestId: req.requestId
    });
  } catch (error) {
    next(error);
  }
}

function listOrdersController(req, res, next) {
  try {
    const limit = Math.min(
      Math.max(Number(req.query.limit) || 100, 1),
      100
    );

    const offset = Math.max(
      Number(req.query.offset) || 0,
      0
    );

    const orders = orderService.listOrders({
      limit,
      offset
    });

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        limit,
        offset,
        count: orders.length
      },
      requestId: req.requestId
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createOrderController,
  getOrderController,
  listOrdersController
};
