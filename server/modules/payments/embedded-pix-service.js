'use strict';
const {AppError} = require('../../core/app-error');
const provider = require('./mercado-pago-provider');

function validCpf(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  for (let size = 9; size <= 10; size++) {
    let sum = 0;
    for (let i = 0; i < size; i++) sum += Number(digits[i]) * (size + 1 - i);
    const check = (sum * 10) % 11;
    if ((check === 10 ? 0 : check) !== Number(digits[size])) return false;
  }
  return true;
}

function payerFor(customer = {}, identification) {
  const email = String(customer.email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new AppError('Confira o e-mail para gerar o PIX.', {status: 400});
  }
  const name = String(customer.name || '').trim().split(/\s+/);
  const payer = {email, first_name: name[0] || 'Cliente', last_name: name.slice(1).join(' ') || name[0] || 'Cliente'};
  if (identification) {
    if (identification.type !== 'CPF' || !validCpf(identification.number)) {
      throw new AppError('Confira o CPF para gerar o PIX.', {status: 400});
    }
    payer.identification = {type: 'CPF', number: String(identification.number).replace(/\D/g, '')};
  }
  return payer;
}

function paymentBody(order, request) {
  const total = Number(order.totals?.total);
  if (!Number.isFinite(total) || total <= 0) throw new AppError('Total inválido para gerar o PIX.', {status: 400});
  return {transaction_amount: total, payment_method_id: 'pix',
    description: 'Pedido Fios Perfeitos ' + order.orderNumber, external_reference: order.orderNumber,
    notification_url: request.notificationUrl, date_of_expiration: request.expiresAt,
    payer: payerFor(order.customer, order.payment?.payerIdentification)};
}

function publicPix(payment, fallbackExpiry) {
  const data = payment.point_of_interaction?.transaction_data || {};
  const expiresAt = payment.date_of_expiration || fallbackExpiry;
  if (!/^\d{1,24}$/.test(String(payment.id)) || !Number.isFinite(Date.parse(expiresAt))) throw Error('Invalid PIX response');
  if (['approved', 'refunded', 'charged_back'].includes(payment.status)) return {paymentId: String(payment.id), expiresAt};
  if (payment.status !== 'pending' || typeof data.qr_code !== 'string' || !data.qr_code.startsWith('000201') || data.qr_code.length > 4096 ||
      typeof data.qr_code_base64 !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(data.qr_code_base64) || data.qr_code_base64.length > 1000000) {
    throw new AppError('Não foi possível preparar o QR Code. Consulte o pedido antes de tentar novamente.', {status: 503});
  }
  return {paymentId: String(payment.id), expiresAt, qrCode: data.qr_code, qrCodeBase64: data.qr_code_base64};
}

async function prepareEmbeddedPix({config, db, order, orderRef, attemptRef, lease, confirmPayment, request = provider.request, now = Date.now}) {
  const savedRequest = await db.runTransaction(async tx => {
    const attempt = (await tx.get(attemptRef)).data();
    const current = (await tx.get(orderRef)).data();
    if (attempt?.lease !== lease || !current || !['pending', 'failed', 'cancelled'].includes(current.payment?.status)) throw new AppError('Consulte o estado deste pedido antes de continuar.', {status: 409});
    if (current.payment.preferenceId || current.payment.preferenceCreationStartedAt) throw new AppError('Este pedido já possui um pagamento em preparação. Consulte o acompanhamento.', {status: 409});
    if (current.payment.pixRequest) return current.payment.pixRequest;
    const record = {idempotencyKey: 'fp-pix-' + order.orderNumber,
      // Allow a margin above the provider minimum; retries retain this same expiry.
      expiresAt: new Date(now() + 60 * 60000).toISOString(), notificationUrl: config.notificationUrl};
    // Persist before calling the provider; retries use exactly the same key, expiry and payer.
    tx.update(orderRef, {'payment.pixRequest': record, 'payment.experience': 'embedded_pix'});
    return record;
  });
  if (Date.parse(savedRequest.expiresAt) <= now()) throw new AppError('O prazo deste código terminou. Consulte o pedido antes de iniciar outro pagamento.', {status: 409});
  const payment = await request(config, '/v1/payments', paymentBody(order, savedRequest), undefined, 'POST',
    {'X-Idempotency-Key': savedRequest.idempotencyKey});
  if (payment.payment_method_id !== 'pix' || !provider.paymentMatches(payment, order, config)) throw Error('PIX does not match order');
  const pix = publicPix(payment, savedRequest.expiresAt);
  const response = {success: true, data: {kind: 'embedded_pix', orderNumber: order.orderNumber,
    trackingToken: order.publicTrackingToken, total: order.totals.total, testMode: config.mode === 'test', pix}};
  await db.runTransaction(async tx => {
    const attempt = (await tx.get(attemptRef)).data();
    const current = (await tx.get(orderRef)).data();
    if (attempt?.lease !== lease || current.payment.pixRequest?.idempotencyKey !== savedRequest.idempotencyKey ||
        (current.payment.pix?.paymentId && current.payment.pix.paymentId !== pix.paymentId)) throw Error('Concurrent PIX preparation');
    tx.update(orderRef, {'payment.pix': pix, 'payment.experience': 'embedded_pix', updatedAt: new Date(now()).toISOString()});
    tx.set(attemptRef, {response, expiresAt: Date.parse(pix.expiresAt), lockedUntil: 0}, {merge: true});
  });
  await confirmPayment(payment);
  return response;
}

module.exports = {validCpf, payerFor, paymentBody, publicPix, prepareEmbeddedPix};
