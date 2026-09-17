'use strict';

function calculateOrderTotal({ items = [], shipping = 0, discount = 0 }) {
  const subtotal = items.reduce((total, item) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Quantidade inválida.');
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error('Preço inválido.');
    }

    return total + quantity * unitPrice;
  }, 0);

  return Number(
    Math.max(
      0,
      subtotal + (Number(shipping) || 0) - (Number(discount) || 0)
    ).toFixed(2)
  );
}

module.exports = { calculateOrderTotal };
