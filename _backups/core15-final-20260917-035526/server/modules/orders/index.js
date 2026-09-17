'use strict';

const {
  prepareOrder
} = require('./order-authority');

const {
  buildCompleteOrder
} = require('./complete-order-builder');

const {
  createCompleteOrder,
  getCompleteOrder
} = require('./complete-order-service');

module.exports = {
  prepareOrder,
  buildCompleteOrder,
  createCompleteOrder,
  getCompleteOrder
};
