'use strict';
const {getConfiguration, sendOrderWhatsApp, singleLine} = require('./whatsapp-order-service');
const DISPATCH_PHONE = '5511986215473';
const money = value => Number(value || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

function paidOrderDetails(order) {
  const address = order.address || order.customer?.address || {};
  const delivery = order.deliveryMethod === 'pickup' ? 'Retirada na loja' : 'Entrega: ' +
    [address.street, address.number, address.complement, address.neighborhood, address.city, address.state, address.cep || address.zipCode].filter(Boolean).join(', ');
  const items = (order.items || []).map(item => `${item.quantity}x ${item.sku || ''} ${item.name || ''}`.trim()).join('; ');
  return singleLine(`FIOS PERFEITOS — PAGAMENTO CONFIRMADO. Pedido ${order.orderNumber}. Total ${money(order.totals?.total)}. Meio: ${order.payment?.method || ''}. Cliente: ${order.customer?.name || ''}; contato ${order.customer?.phone || ''}. Itens: ${singleLine(items, 360)}. ${singleLine(delivery, 250)}. Frete ${money(order.totals?.shipping)}; desconto ${money(order.totals?.discount)}. ${order.shippingDetails?.name || ''}. Observações: ${singleLine(order.notes, 100)}. Iniciar separação e expedição.`, 1024);
}

async function notifyPaidOrder(order, dependencies = {}) {
  if (order.payment?.mode !== 'production' || order.payment?.status !== 'paid') return {sent: false, reason: 'not_paid_production'};
  if (order.payment?.reviewRequired || order.stock?.status === 'released') return {sent: false, reason: 'order_needs_review'};
  const configured = (dependencies.configuration || getConfiguration)('admin_paid');
  const db = dependencies.db || require('../../infrastructure/firebase/firebase-admin').getFirestore();
  const ref = db.collection('orderNotifications').doc(order.orderNumber + '_admin_paid');
  const claimed = await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref), saved = snapshot.data();
    if (snapshot.exists && saved.status !== 'not_configured') return false;
    tx.set(ref, {orderNumber: order.orderNumber, role: 'admin_paid', status: configured ? 'sending' : 'not_configured',
      recipient: DISPATCH_PHONE, sent: false, createdAt: new Date().toISOString()});
    return true;
  });
  if (!claimed) return {sent: false, reason: 'already_attempted'};
  if (!configured) return {sent: false, reason: 'not_configured'};
  let result;
  try {
    result = await (dependencies.send || sendOrderWhatsApp)({...order, id: order.id || order.orderNumber},
      {role: 'admin_paid', phone: DISPATCH_PHONE, name: 'Expedição Fios Perfeitos', details: paidOrderDetails(order)});
  } catch { result = {sent: false, reason: 'provider_unavailable'}; }
  // Never automatically resend an uncertain result; accepted does not mean delivered.
  await ref.update({...result, status: result.sent ? 'accepted' : 'needs_review', updatedAt: new Date().toISOString()});
  return result;
}

module.exports = {DISPATCH_PHONE, paidOrderDetails, notifyPaidOrder};
