'use strict';

const { createHmac, timingSafeEqual } = require('node:crypto');
const { AppError } = require('../../core/app-error');

function configuration(env = process.env) {
  const mode = env.MP_MODE;
  const configured = env.MP_CHECKOUT_ENABLED === 'true' &&
    (mode !== 'production' || env.MP_PRODUCTION_VALIDATED === 'true') &&
    ['test', 'production'].includes(mode) && env.MP_ACCESS_TOKEN &&
    env.MP_WEBHOOK_SECRET && env.MP_COLLECTOR_ID;
  let storeUrl, notificationUrl;
  try {
    storeUrl = new URL(env.PUBLIC_STORE_URL);
    notificationUrl = new URL(env.MP_NOTIFICATION_URL);
    if (storeUrl.protocol !== 'https:' || notificationUrl.protocol !== 'https:') throw new Error();
  } catch { return { enabled: false }; }
  return { enabled: Boolean(configured), mode, storeUrl: storeUrl.origin,
    notificationUrl: notificationUrl.href, token: env.MP_ACCESS_TOKEN,
    webhookSecret: env.MP_WEBHOOK_SECRET, collectorId: String(env.MP_COLLECTOR_ID || '') };
}

function checkoutUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !['www.mercadopago.com.br', 'www.mercadopago.com', 'sandbox.mercadopago.com.br', 'sandbox.mercadopago.com'].includes(url.hostname)) {
    throw new AppError('Destino de pagamento inválido.', { status: 502 });
  }
  return url.href;
}

function preferenceBody(order, config) {
  const total = Number(order.totals?.total);
  if (!Number.isFinite(total) || total <= 0) throw new AppError('Total inválido.', { status: 400 });
  const tracking = `${config.storeUrl}/pages/rastrear-pedido.html${config.mode === 'test' ? '?mp_test=1' : ''}#token=${order.publicTrackingToken}`;
  // A linha representa o total autorizado, incluindo frete e cupom; não recalcular no navegador.
  return {
    items: [{ id: order.orderNumber, title: `Pedido NEFER ${order.orderNumber}`,
      quantity: 1, currency_id: 'BRL', unit_price: total }],
    external_reference: order.orderNumber,
    notification_url: config.notificationUrl,
    back_urls: { success: tracking, pending: tracking, failure: tracking },
    auto_return: 'approved',
    payment_methods: { excluded_payment_types: [
      { id: 'ticket' }, { id: 'bank_transfer' }, { id: 'atm' }
    ], installments: 1 },
    expires: true,
    expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString()
  };
}

function verifySignature(req, secret) {
  const dataId = String(req.query['data.id'] || '').toLowerCase();
  const requestId = req.get('x-request-id') || '';
  const parts = Object.fromEntries(String(req.get('x-signature') || '').split(',')
    .map(part => part.trim().split('=')));
  if (!secret || !/^\d+$/.test(dataId) || !requestId || !/^\d+$/.test(parts.ts || '') || !/^[a-f0-9]{64}$/i.test(parts.v1 || '')) return false;
  const expected = createHmac('sha256', secret)
    .update(`id:${dataId};request-id:${requestId};ts:${parts.ts};`).digest();
  return timingSafeEqual(expected, Buffer.from(parts.v1, 'hex'));
}

function paymentMatches(payment, order, config) {
  return String(payment.external_reference) === order.orderNumber &&
    String(payment.collector_id) === config.collectorId &&
    payment.currency_id === 'BRL' &&
    typeof payment.live_mode === 'boolean' &&
    (config.mode === 'production' ? payment.live_mode === true :
      payment.live_mode === false || config.testAccountVerified === true) &&
    Math.round(Number(payment.transaction_amount) * 100) === Math.round(Number(order.totals.total) * 100);
}

function paymentStatus(payment) {
  return ({ approved: 'paid', rejected: 'failed', cancelled: 'cancelled',
    refunded: 'refunded', charged_back: 'chargeback' })[payment.status] || 'pending';
}

async function request(config, path, body, fetchImpl = fetch) {
  const response = await fetchImpl(`https://api.mercadopago.com${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  if (!response.ok) throw new AppError('O Mercado Pago não respondeu à solicitação. Tente novamente.', { status: 502, code: 'MP_REQUEST_FAILED' });
  return result;
}

module.exports = { configuration, checkoutUrl, preferenceBody, verifySignature, paymentMatches, paymentStatus, request };
