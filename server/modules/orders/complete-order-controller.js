'use strict';

const { validateOrderPayload } = require('../../core/payload-validator');

const {
  createCompleteOrder,
  getCompleteOrder
} = require('./complete-order-service');

function createCompleteOrderController(req, res, next) {
  try {
    const payload = validateOrderPayload(req.body || {});

    const order = createCompleteOrder(
      payload,
      req.requestId
    );

    res.status(201).json({
      success: true,
      data: order,
      requestId: req.requestId
    });
  } catch (error) {
    next(error);
  }
}

function getCompleteOrderController(req, res, next) {
  try {
    const order = getCompleteOrder(
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

module.exports = {
  createCompleteOrderController,
  getCompleteOrderController
};

