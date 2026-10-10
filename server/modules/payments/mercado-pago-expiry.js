"use strict";
const { AppError } = require('../../core/app-error');
const provider = require('./mercado-pago-provider');
async function verifyExpiredOrder(config, order, confirmPayment) {
  if (order.payment?.provider !== 'mercado-pago' || order.payment.mode !== config.mode ||
      !['pending', 'failed', 'cancelled'].includes(order.payment.status) || !order.payment.preferenceId) {
    throw new AppError('Este pedido não pode ser encerrado por expiração.', { status: 409 });
  }
  const account = await provider.request(config, '/users/me');
  const testAccount = account.tags?.includes('test_user') === true;
  if (String(account.id) !== config.collectorId || testAccount !== (config.mode === 'test')) throw new Error('Conta incompatível.');
  const path = `/checkout/preferences/${encodeURIComponent(order.payment.preferenceId)}`;
  const preference = await provider.request(config, path);
  if (String(preference.collector_id) !== config.collectorId || preference.external_reference !== order.orderNumber) throw new Error('Preferência incompatível.');
  if (preference.expires !== true || !Number.isFinite(Date.parse(preference.expiration_date_to)) ||
      Date.parse(preference.expiration_date_to) + 60000 > Date.now()) {
    throw new AppError('O prazo de pagamento ainda não terminou. Aguarde antes de encerrar.', { status: 409 });
  }
  // Fechar o prazo no provedor antes de conferir pagamentos e liberar a reserva.
  await provider.request(config, path, { expires: true,
    expiration_date_from: new Date(Date.now() - 120000).toISOString(),
    expiration_date_to: new Date(Date.now() - 60000).toISOString() }, undefined, 'PUT');
  const search = await provider.request(config, `/v1/payments/search?external_reference=${encodeURIComponent(order.orderNumber)}&limit=100&offset=0`);
  if (!Array.isArray(search.results) || !Number.isInteger(search.paging?.total) || search.paging.total > search.results.length) throw new Error('Pesquisa incompleta.');
  const verified = { ...config, testAccountVerified: testAccount };
  if (search.results.some(payment => !provider.paymentMatches(payment, order, verified))) throw new Error('Pagamento incompatível.');
  const paid = search.results.find(p => ['approved', 'refunded', 'charged_back'].includes(p.status));
  if (paid) return { release: false, paymentStatus: await confirmPayment(paid) };
  if (search.results.some(p => !['rejected', 'cancelled'].includes(p.status))) {
    throw new AppError('O pagamento está em análise. O estoque permanece reservado.', { status: 409 });
  }
  return { release: true };
}
module.exports = { verifyExpiredOrder };
