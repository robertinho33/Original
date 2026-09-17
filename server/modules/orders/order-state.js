'use strict';

const transitions = Object.freeze({
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: []
});

function canTransition(from, to) {
  return Boolean(transitions[from]?.includes(to));
}

function transition(from, to) {
  if (!canTransition(from, to)) {
    throw new Error(`Transição inválida: ${from} -> ${to}`);
  }

  return to;
}

module.exports = { transitions, canTransition, transition };
