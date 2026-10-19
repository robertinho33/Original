'use strict';
const {AppError} = require('../../core/app-error');
const provider = require('./mercado-pago-provider');

async function verifyExpiredPix(config, order, confirmPayment) {
  const pix = order.payment?.pix;
  if (!pix || !/^\d{1,24}$/.test(pix.paymentId || '') || order.payment.experience !== 'embedded_pix' ||
      order.payment.provider !== 'mercado-pago' || order.payment.mode !== config.mode ||
      !['pending', 'failed', 'cancelled'].includes(order.payment.status)) throw new AppError('Este PIX precisa ser conferido antes de encerrar.', {status: 409});
  const account = await provider.request(config, '/users/me');
  const testAccount = account.tags?.includes('test_user') === true;
  if (String(account.id) !== config.collectorId || testAccount !== (config.mode === 'test')) throw Error('Account mismatch');
  const verified = {...config, testAccountVerified: testAccount};
  const path = '/v1/payments/' + pix.paymentId;
  let payment = await provider.request(config, path);
  const matches = value => String(value.id) === pix.paymentId && value.payment_method_id === 'pix' && provider.paymentMatches(value, order, verified);
  if (!matches(payment)) throw Error('Payment mismatch');
  if (['approved', 'refunded', 'charged_back'].includes(payment.status)) return {release: false, paymentStatus: await confirmPayment(payment)};
  const expiry = Date.parse(payment.date_of_expiration);
  if (!Number.isFinite(expiry) || expiry + 60000 > Date.now()) throw new AppError('O prazo deste PIX ainda não terminou. Aguarde antes de encerrar.', {status: 409});
  if (payment.status === 'pending') {
    await provider.request(config, path, {status: 'cancelled'}, undefined, 'PUT');
    payment = await provider.request(config, path);
    if (!matches(payment)) throw Error('Payment mismatch');
  }
  if (['approved', 'refunded', 'charged_back'].includes(payment.status)) return {release: false, paymentStatus: await confirmPayment(payment)};
  if (!['rejected', 'cancelled'].includes(payment.status)) throw new AppError('O pagamento está em análise. O estoque permanece reservado.', {status: 409});
  const search = await provider.request(config, '/v1/payments/search?external_reference=' + encodeURIComponent(order.orderNumber) + '&limit=100&offset=0');
  if (!Array.isArray(search.results) || !Number.isInteger(search.paging?.total) || search.paging.total > search.results.length ||
      search.results.some(value => !provider.paymentMatches(value, order, verified))) throw Error('Incomplete payment search');
  const settled = search.results.find(value => ['approved', 'refunded', 'charged_back'].includes(value.status));
  if (settled) return {release: false, paymentStatus: await confirmPayment(settled)};
  if (search.results.some(value => !['rejected', 'cancelled'].includes(value.status))) throw new AppError('Há outro pagamento em análise. O estoque permanece reservado.', {status: 409});
  return {release: true};
}
module.exports = {verifyExpiredPix};
