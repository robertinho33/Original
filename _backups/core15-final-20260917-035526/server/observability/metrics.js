'use strict';

const counters = new Map();

function increment(name, value = 1) {
  const current =
    Number(counters.get(name) || 0);

  counters.set(
    name,
    current + Number(value)
  );
}

function get(name) {
  return Number(
    counters.get(name) || 0
  );
}

function snapshot() {
  return Object.fromEntries(
    counters.entries()
  );
}

function reset() {
  counters.clear();
}

module.exports = {
  increment,
  get,
  snapshot,
  reset
};
