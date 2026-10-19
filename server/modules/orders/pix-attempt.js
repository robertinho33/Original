'use strict';
const { createHash } = require('node:crypto');
const { AppError } = require('../../core/app-error');
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function attemptFor(payload) {
  const id = String(payload.checkoutAttemptId || '');
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)) throw new AppError('Atualize a página para iniciar seu pedido Pix.', { status: 400 });
  const grouped = require('../inventory/stock-reservations').aggregateItems(payload.items).sort((a, b) => a.sku.localeCompare(b.sku));
  const data = { items: grouped, customer: payload.customer || {}, delivery: payload.delivery || { method: payload.deliveryMethod || 'delivery', address: payload.address || null }, coupon: String(payload.coupon?.code || '').trim().toUpperCase(), notes: String(payload.notes || '') };
  return { documentId: 'pix-' + id.toLowerCase(), fingerprint: createHash('sha256').update(JSON.stringify(canonical(data))).digest('hex') };
}
function checkAttempt(order, attempt) {
  if (order.pixAttemptFingerprint !== attempt.fingerprint) throw new AppError('Os dados desta tentativa mudaram. Atualize sua sacola para iniciar outro pedido.', { status: 409 });
}
function responseFor(order) {
  if (!['pending', 'awaiting_payment'].includes(order.payment?.status) || ['cancelled', 'expired'].includes(order.status)) throw new AppError('Este pedido já possui uma atualização. Consulte seu acompanhamento antes de tentar pagar novamente.', { status: 409 });
  const totals = order.totals;
  return { ...order.payment.pixResponse, order: { orderNumber: order.orderNumber, publicTrackingToken: order.publicTrackingToken, subtotal: totals.subtotal, discount: totals.discount, shipping: totals.shipping, total: totals.total, coupon: order.coupon || null } };
}
module.exports = { attemptFor, checkAttempt, responseFor };
