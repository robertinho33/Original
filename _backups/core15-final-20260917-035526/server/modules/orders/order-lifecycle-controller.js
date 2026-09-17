'use strict';

const {
  transitionOrder
} = require('./order-lifecycle-service');

const {
  ORDER_STATES
} = require('./order-lifecycle');

function changeStatus(req, res, next) {
  try {
    const orderNumber =
      String(
        req.params.orderNumber || ''
      ).trim();

    const status =
      String(
        req.body?.status || ''
      ).trim();

    if (!status) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'STATUS_REQUIRED',
          message: 'Novo status é obrigatório.'
        }
      });
    }

    const order =
      transitionOrder(
        orderNumber,
        status,
        {
          actor:
            req.body?.actor ||
            'admin',

          requestId:
            req.id || null
        }
      );

    return res.json({
      success: true,
      data: order
    });

  } catch (error) {
    return next(error);
  }
}

function states(req, res) {
  res.json({
    success: true,
    data: {
      states: ORDER_STATES
    }
  });
}

module.exports = {
  changeStatus,
  states
};
