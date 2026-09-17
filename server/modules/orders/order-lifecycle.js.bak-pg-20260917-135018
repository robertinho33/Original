'use strict';

const ORDER_STATES = Object.freeze({
  AWAITING_PAYMENT: 'awaiting_payment',
  PAID: 'paid',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled'
});

const TRANSITIONS = Object.freeze({
  awaiting_payment: [
    'paid',
    'cancelled'
  ],

  paid: [
    'processing',
    'cancelled'
  ],

  processing: [
    'shipped',
    'cancelled'
  ],

  shipped: [
    'delivered'
  ],

  delivered: [],

  cancelled: []
});

function isValidState(state) {
  return Object.values(
    ORDER_STATES
  ).includes(state);
}

function canTransition(from, to) {
  if (!isValidState(from)) {
    return false;
  }

  if (!isValidState(to)) {
    return false;
  }

  return TRANSITIONS[from].includes(to);
}

module.exports = {
  ORDER_STATES,
  TRANSITIONS,
  isValidState,
  canTransition
};
