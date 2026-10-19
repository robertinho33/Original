'use strict';
const { AppError } = require('../../core/app-error');
const fail = (message, status = 503) => new AppError(message, { status });
function configuration(env = process.env, readSecret = () => {
  try { return require('node:fs').readFileSync('/etc/secrets/INFINITEPAY_API_KEY', 'utf8').trim(); }
  catch { return ''; }
}) {
  try {
    const key = env.INFINITEPAY_API_KEY || readSecret();
    const store = new URL(env.PUBLIC_STORE_URL);
    const webhook = new URL(env.INFINITEPAY_WEBHOOK_URL);
    if (store.protocol !== 'https:' || webhook.protocol !== 'https:') throw Error();
    return { enabled: env.INFINITEPAY_ENABLED === 'true' && Boolean(key && env.INFINITEPAY_HANDLE),
      key, handle: env.INFINITEPAY_HANDLE,
      store: store.origin, webhook: webhook.href };
  } catch { return { enabled: false }; }
}
function checkoutUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'checkout.infinitepay.io' || url.username || url.password || url.port) {
    throw fail('Destino de pagamento inválido.', 502);
  }
  return url.href;
}
function cents(value) {
  const amount = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw fail('Total de pagamento inválido.', 400);
  return amount;
}
function linkBody(order, config) {
  return { handle: config.handle, order_nsu: order.orderNumber,
    items: [{ quantity: 1, price: cents(order.totals.total), description: `Pedido Fios Perfeitos ${order.orderNumber} (produtos, frete e descontos)` }],
    redirect_url: `${config.store}/pages/rastrear-pedido.html?infinitepay_return=1#token=${order.publicTrackingToken}`,
    webhook: { url: config.webhook, events: ['paid'] },
    options: { single_payment: true, valid_until: order.payment.expiresAt },
    customer: { name: order.customer.name, email: order.customer.email,
      ...(order.customer.phone ? { phone_number: '+55' + String(order.customer.phone).replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '') } : {}) } };
}
async function request(config, path, body, fetchImpl = fetch) {
  const response = await fetchImpl(`https://api.checkout.infinitepay.io${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Api-Key': config.key },
    body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw fail('Não foi possível consultar a InfinitePay.', 502);
  return response.json();
}
function verifiedPayment(payment, order) {
  return payment.success === true && payment.paid === true &&
    Number.isSafeInteger(payment.amount) && payment.amount === cents(order.totals.total) &&
    Number.isSafeInteger(payment.paid_amount) && payment.paid_amount >= payment.amount &&
    ['pix', 'credit_card'].includes(payment.capture_method);
}
module.exports = { configuration, checkoutUrl, cents, linkBody, request, verifiedPayment, fail };
