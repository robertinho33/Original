'use strict';

const express = require('express');
const { randomBytes, randomUUID, createHash } = require('node:crypto');
const { getFirestore } = require('../../infrastructure/firebase/firebase-admin');
const { validateOrderPayload } = require('../../core/payload-validator');
const { buildCompleteOrder } = require('../orders/complete-order-builder');
const provider = require('./mercado-pago-provider');
const router = express.Router();

const collections = config => config.mode === 'test'
  ? { orders: 'mpTestOrders', tracking: 'mpTestTracking', attempts: 'mpTestAttempts' }
  : { orders: 'orders', tracking: 'orderTracking', attempts: 'mpCheckoutAttempts' };

router.get('/configuration', (req, res) => {
  const config = provider.configuration();
  res.set('Cache-Control', 'no-store').json({ success: true,
    enabled: config.enabled, testMode: config.mode === 'test' });
});

router.post('/checkout', async (req, res) => {
  const config = provider.configuration();
  if (!config.enabled) return res.status(503).json({ success: false, message: 'Pagamento com cartão ainda não está disponível.' });
  try {
    // Conferir o dono e o tipo da conta antes de criar qualquer cobrança.
    const account = await provider.request(config, '/users/me');
    const isTestAccount = Array.isArray(account.tags) && account.tags.includes('test_user');
    if (String(account.id) !== config.collectorId || isTestAccount !== (config.mode === 'test')) {
      return res.status(503).json({ success: false, message: 'A conta de pagamento não corresponde ao ambiente configurado.' });
    }
    const payload = validateOrderPayload(req.body);
    if (!/^[a-f0-9-]{36}$/i.test(payload.checkoutAttemptId || '')) return res.status(400).json({ success: false, message: 'Identificador de tentativa inválido.' });
    const fingerprint = createHash('sha256').update(JSON.stringify({
      items: payload.items, customer: payload.customer, address: payload.address,
      deliveryMethod: payload.deliveryMethod, coupon: payload.coupon
    })).digest('hex');
    const db = getFirestore(), names = collections(config);
    const attemptRef = db.collection(names.attempts).doc(payload.checkoutAttemptId);
    const lease = randomUUID();
    const claim = await db.runTransaction(async tx => {
      const snapshot = await tx.get(attemptRef);
      const existing = snapshot.exists ? snapshot.data() : null;
      if (existing && existing.fingerprint !== fingerprint) return { conflict: true };
      if (existing?.response && existing.expiresAt > Date.now()) return { response: existing.response };
      if (existing?.expiresAt && existing.expiresAt <= Date.now()) return { expired: true };
      if (existing?.lockedUntil > Date.now()) return { busy: true };
      const orderNumber = existing?.orderNumber || `AUR-${randomBytes(8).toString('hex').toUpperCase()}`;
      tx.set(attemptRef, { fingerprint, orderNumber, lease, lockedUntil: Date.now() + 60000 }, { merge: true });
      return { orderNumber };
    });
    if (claim.response) return res.json(claim.response);
    if (claim.conflict || claim.expired || claim.busy) return res.status(409).json({ success: false,
      message: claim.expired ? 'Esta tentativa expirou. Atualize a sacola para iniciar outra.' : 'A tentativa está em processamento ou seus dados mudaram. Aguarde e tente novamente.' });
    const orderRef = db.collection(names.orders).doc(claim.orderNumber);
    let snapshot = await orderRef.get();
    let order = snapshot.exists ? snapshot.data() : null;
    if (!order) {
      const draft = await buildCompleteOrder({ ...payload, paymentMethod: 'card' });
      order = { ...draft, orderNumber: claim.orderNumber,
        publicTrackingToken: randomBytes(32).toString('hex'),
        payment: { method: 'card', provider: 'mercado-pago', status: 'pending', mode: config.mode },
        status: 'pending' };
      await db.runTransaction(async tx => {
        const attempt = (await tx.get(attemptRef)).data();
        if (attempt.lease !== lease) throw new Error('Tentativa concorrente.');
        tx.create(orderRef, order);
        tx.set(db.collection(names.tracking).doc(order.publicTrackingToken), {
          id: order.orderNumber, orderNumber: order.orderNumber, createdAt: order.createdAt,
          status: 'pending', paymentStatus: 'pending', total: order.totals.total,
          logisticsStatus: 'pending', history: []
        });
      });
    }
    if (order.payment.status !== 'pending') return res.status(409).json({ success: false, message: 'Este pedido já possui uma atualização de pagamento. Consulte o acompanhamento.' });
    const preference = await provider.request(config, '/checkout/preferences', provider.preferenceBody(order, config));
    // Credenciais de vendedor de teste usam init_point; a conta controla o ambiente.
    const url = provider.checkoutUrl(preference.init_point);
    const response = { success: true, data: { checkoutUrl: url, orderNumber: order.orderNumber,
      trackingToken: order.publicTrackingToken, total: order.totals.total, testMode: config.mode === 'test' } };
    await db.runTransaction(async tx => {
      const attempt = (await tx.get(attemptRef)).data();
      if (attempt.lease !== lease) throw new Error('Tentativa concorrente.');
      tx.update(orderRef, { 'payment.preferenceId': preference.id, updatedAt: new Date().toISOString() });
      tx.set(attemptRef, { response, expiresAt: Date.now() + 30 * 60 * 1000, lockedUntil: 0 }, { merge: true });
    });
    res.json(response);
  } catch (error) {
    // Não registrar payload, credenciais ou resposta bruta do provedor.
    res.status(error.status || 503).json({ success: false,
      message: error.status && error.status < 500 ? error.message : 'Não foi possível abrir o pagamento. Aguarde um minuto e tente novamente.' });
  }
});

router.post('/webhook', async (req, res) => {
  const config = provider.configuration();
  if (!config.enabled) return res.sendStatus(503);
  if (!provider.verifySignature(req, config.webhookSecret)) return res.sendStatus(401);
  if (req.body?.type !== 'payment' && req.query.type !== 'payment') return res.sendStatus(200);
  try {
    const payment = await provider.request(config, `/v1/payments/${req.query['data.id']}`);
    const names = collections(config), db = getFirestore();
    if (!/^AUR-[A-F0-9]{16}$/.test(payment.external_reference || '')) return res.sendStatus(200);
    const ref = db.collection(names.orders).doc(payment.external_reference);
    await db.runTransaction(async tx => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) return;
      const order = snapshot.data();
      if (!provider.paymentMatches(payment, order, config)) throw new Error('Pagamento incompatível.');
      const updatedAt = Date.parse(payment.date_last_updated || payment.date_created);
      if (!Number.isFinite(updatedAt)) throw new Error('Data inválida.');
      if (order.payment.paymentId && String(order.payment.paymentId) !== String(payment.id)) {
        // Uma segunda cobrança nunca substitui a primeira; requer revisão no painel do provedor.
        tx.update(ref, { 'payment.reviewRequired': true });
        return;
      }
      if (Number(order.payment.providerUpdatedAt || 0) >= updatedAt) return;
      const status = provider.paymentStatus(payment);
      const changes = { 'payment.status': status, 'payment.providerStatus': payment.status,
        'payment.paymentId': String(payment.id), 'payment.providerUpdatedAt': updatedAt,
        updatedAt: new Date().toISOString() };
      if (status === 'paid') changes['payment.confirmedAt'] = payment.date_approved || new Date(updatedAt).toISOString();
      tx.update(ref, changes);
      tx.set(db.collection(names.tracking).doc(order.publicTrackingToken), {
        paymentStatus: status, paymentConfirmedAt: changes['payment.confirmedAt'] || null,
        updatedAt: changes.updatedAt
      }, { merge: true });
    });
    res.sendStatus(200);
  } catch { res.sendStatus(503); }
});

router.get('/test-tracking/:token', async (req, res) => {
  if (provider.configuration().mode !== 'test' || !/^[a-f0-9]{64}$/i.test(req.params.token)) return res.sendStatus(404);
  try {
    const snapshot = await getFirestore().collection('mpTestTracking').doc(req.params.token).get();
    if (!snapshot.exists) return res.sendStatus(404);
    res.set('Cache-Control', 'no-store').json({ success: true, data: snapshot.data() });
  } catch { res.sendStatus(503); }
});

module.exports = router;
