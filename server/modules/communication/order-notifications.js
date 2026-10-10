'use strict';

const { sendOrderWhatsApp, getConfiguration, singleLine, normalizePhone } = require('./whatsapp-order-service');
const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function messageDetails(order, role) {
  const coupon = order.coupon || {};
  if (role === 'influencer') {
    // Não divulgar endereço, telefone ou link privado do comprador ao parceiro.
    return singleLine(`Pedido ${order.orderNumber}. Cupom ${coupon.code}. Desconto ${money(order.totals?.discount)}. Total ${money(order.totals?.total)}. Pagamento aguardando confirmação; comissão sujeita à confirmação e às regras da parceria.`, 1024);
  }
  const items = (order.items || []).map(item => `${item.quantity}x ${item.name || item.sku}`).join('; ');
  const address = order.address || order.customer?.address || {};
  const logistics = order.deliveryMethod === 'pickup' ? 'Retirada, sem frete' : `Entrega: ${[address.street, address.number, address.complement, address.neighborhood, address.city, address.state, address.cep || address.zipCode].filter(Boolean).join(', ')}; frete ${money(order.totals?.shipping)}`;
  return singleLine(`Pedido ${order.orderNumber}. Cliente ${order.customer?.name || ''}; telefone ${order.customer?.phone || ''}. Itens: ${items}. Total ${money(order.totals?.total)}; desconto ${money(order.totals?.discount)}. Meio ${order.payment?.method || ''}; pagamento aguardando confirmação. ${logistics}. Observações: ${order.notes || ''}`, 1024);
}

async function notifyOrder(order) {
  if (order.payment?.mode === 'test') return { skipped: 'test_order' };
  const candidates = [{ role: 'customer', phone: order.customer?.phone || order.customer?.whatsapp, name: order.customer?.name }];
  candidates.push({ role: 'admin', phone: process.env.NEFER_WHATSAPP_ADMIN_PHONE || '+5511986215473', name: 'Administrador', details: messageDetails(order, 'admin') });
  const configured = candidates.some(item => getConfiguration(item.role));
  if (!configured && !getConfiguration('influencer')) return { skipped: 'not_configured' };
  const db = require('../../infrastructure/firebase/firebase-admin').getFirestore();
  if (getConfiguration('customer') && /^[a-f0-9]{64}$/i.test(order.publicTrackingToken || '')) {
    const url = new URL('/pages/rastrear-pedido.html', getConfiguration('customer').storeUrl);
    url.hash = 'token=' + order.publicTrackingToken;
    const summary = `Pedido ${order.orderNumber}. Total ${money(order.totals?.total)}. ${order.deliveryMethod === 'pickup' ? 'Retirada, sem frete.' : `Entrega; frete ${money(order.totals?.shipping)}.`} Pagamento aguardando confirmação. Acompanhe: ${url.href}`;
    candidates[0].details = summary;
  }
  if (order.coupon?.influencerId && Number(order.totals?.discount) > 0 && getConfiguration('influencer')) {
    try {
      const snapshot = await db.collection('influencers').doc(order.coupon.influencerId).get();
      const partner = snapshot.exists ? snapshot.data() : null;
      if (partner && partner.active !== false) candidates.push({ role: 'influencer', phone: partner.phone, name: partner.name, details: messageDetails(order, 'influencer') });
    } catch { console.warn('[WHATSAPP] Destinatário do cupom precisa ser conferido:', order.orderNumber); }
  }
  const results = {};
  await Promise.all(candidates.map(async item => {
    if (!getConfiguration(item.role)) { results[item.role] = { sent: false, reason: 'not_configured' }; return; }
    if (item.role === 'customer' && order.customer?.whatsappOptIn !== true) { results.customer = { sent: false, reason: 'customer_opt_out' }; return; }
    if (!normalizePhone(item.phone)) { results[item.role] = { sent: false, reason: 'invalid_phone' }; return; }
    const ref = db.collection('orderNotifications').doc(`${order.orderNumber}_${item.role}`);
    try {
      const claimed = await db.runTransaction(async tx => {
        if ((await tx.get(ref)).exists) return false;
        tx.create(ref, { orderNumber: order.orderNumber, role: item.role, status: 'sending', createdAt: new Date().toISOString() });
        return true;
      });
      if (!claimed) { results[item.role] = { sent: false, reason: 'already_attempted' }; return; }
      const result = await sendOrderWhatsApp({ ...order, id: order.id || order.orderNumber }, item);
      results[item.role] = result;
      await ref.update({ ...result, status: result.sent ? 'accepted' : 'needs_review', updatedAt: new Date().toISOString() });
    } catch {
      // Não repetir após resultado incerto: evitar mensagens duplicadas.
      results[item.role] = { sent: false, reason: 'needs_review' };
    }
  }));
  return results;
}

module.exports = { notifyOrder, messageDetails };
