"use strict";
const { AppError } = require('../../core/app-error');
const provider = require('./mercado-pago-provider');
const stock = require('./mercado-pago-stock');

async function resumeOrder(config, order, confirmPayment) {
  if (order.payment?.provider !== 'mercado-pago' || order.payment.mode !== config.mode ||
      !order.payment.preferenceId || !['pending', 'failed', 'cancelled'].includes(order.payment.status)) {
    throw new AppError('Consulte o status do pedido. Este pagamento não pode ser retomado.', { status: 409 });
  }
  if (config.mode === 'production') {
    stock.validatePilot(order);
    if (order.stock?.status !== 'reserved') throw new AppError('O estoque deste pedido precisa ser conferido.', { status: 409 });
  }
  const account = await provider.request(config, '/users/me');
  const testAccount = account.tags?.includes('test_user') === true;
  if (String(account.id) !== config.collectorId || testAccount !== (config.mode === 'test')) throw new Error('Conta incompatível.');
  const search = await provider.request(config, `/v1/payments/search?external_reference=${encodeURIComponent(order.orderNumber)}&limit=100&offset=0`);
  if (!Array.isArray(search.results) || !Number.isInteger(search.paging?.total) ||
      search.paging.total > search.results.length) throw new Error('Pesquisa incompleta.');
  const verified = { ...config, testAccountVerified: testAccount };
  for (const payment of search.results) {
    if (!provider.paymentMatches(payment, order, verified)) throw new Error('Pagamento incompatível.');
  }
  const settled = search.results.find(p => ['approved', 'refunded', 'charged_back'].includes(p.status));
  if (settled) {
    const paymentStatus = await confirmPayment(settled);
    return { paymentStatus, checkoutUrl: null };
  }
  if (search.results.some(p => !['rejected', 'cancelled'].includes(p.status))) {
    throw new AppError('Há um pagamento em análise. Aguarde a confirmação antes de tentar novamente.', { status: 409 });
  }
  const path = `/checkout/preferences/${encodeURIComponent(order.payment.preferenceId)}`;
  const preference = await provider.request(config, path);
  const total = (preference.items || []).reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0);
  if (String(preference.collector_id) !== config.collectorId || preference.external_reference !== order.orderNumber ||
      !preference.items?.length || preference.items.some(item => item.currency_id !== 'BRL') ||
      Math.round(total * 100) !== Math.round(Number(order.totals.total) * 100)) throw new Error('Preferência incompatível.');
  const renewed = await provider.request(config, path, {
    expires: true, expiration_date_from: new Date(Date.now() - 60000).toISOString(),
    expiration_date_to: new Date(Date.now() + 30 * 60000).toISOString()
  }, undefined, 'PUT');
  return { checkoutUrl: provider.checkoutUrl(renewed.init_point || preference.init_point), paymentStatus: 'pending' };
}
module.exports = { resumeOrder };
