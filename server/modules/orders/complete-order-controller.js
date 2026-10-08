'use strict';

const { validateOrderPayload } = require('../../core/payload-validator');

const {
  createCompleteOrder,
  getCompleteOrder
} = require('./complete-order-service');

async function createCompleteOrderController(req, res, next) {
  try {
    const payload = validateOrderPayload(req.body || {});

    const order = await createCompleteOrder(
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

async function getCompleteOrderController(req, res, next) {
  try {
    const order = await getCompleteOrder(
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

