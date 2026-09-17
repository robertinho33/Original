'use strict';

const {
  createOrderWithPayment
} = require('./order-orchestrator');

function createOrderWithPaymentController(req, res, next) {
  try {
    const order = createOrderWithPayment(
      req.body || {},
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

module.exports = {
  createOrderWithPaymentController
};
