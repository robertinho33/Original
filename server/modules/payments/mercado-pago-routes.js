'use strict';

const express = require('express');
const { randomBytes, randomUUID, createHash } = require('node:crypto');
const { getFirestore } = require('../../infrastructure/firebase/firebase-admin');
const { validateOrderPayload } = require('../../core/payload-validator');
const { buildCompleteOrder } = require('../orders/complete-order-builder');
const provider = require('./mercado-pago-provider');
const stock = require('./mercado-pago-stock');
const router = express.Router();

const collections = config => config.mode === 'test'
  ? { orders: 'mpTestOrders', tracking: 'mpTestTracking', attempts: 'mpTestAttempts' }
  : { orders: 'orders', tracking: 'orderTracking', attempts: 'mpCheckoutAttempts' };

let productionReadiness = null;
async function inspectProductionAccount() {
  const token = process.env.MP_PRODUCTION_ACCESS_TOKEN;
  if (!token) return { success: true, configured: false, productionEnabled: false };
    if (!productionReadiness || productionReadiness.token !== token || productionReadiness.until < Date.now()) {
      const account = await provider.request({ token }, '/users/me');
      const methods = await provider.request({ token }, '/v1/payment_methods');
      const isRealAccount = !account.tags?.includes('test_user') && account.site_id === 'MLB';
      const active = Array.isArray(methods) ? methods.filter(method => method.status === 'active') : [];
      productionReadiness = { token, until: Date.now() + 60000, data: {
        success: true, configured: true, accountVerified: isRealAccount,
        merchantId: String(account.id || ''),
        creditAvailable: active.some(method => method.payment_type_id === 'credit_card'),
        debitAvailable: active.some(method => method.payment_type_id === 'debit_card')
      } };
    }
  return { ...productionReadiness.data, productionEnabled: provider.configuration().mode === 'production' && provider.configuration().enabled };
}
router.get('/production-readiness', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    res.json(await inspectProductionAccount());
  } catch { res.status(503).json({ success: false, configured: true, message: 'Não foi possível verificar as credenciais de produção.' }); }
});

// Apenas leitura da conta e dos meios aceitos; não cria cobrança e não registra chaves.
if (process.env.MP_PRODUCTION_ACCESS_TOKEN) setTimeout(async () => {
  try { console.info('[MP_PRODUCTION_READY]', JSON.stringify(await inspectProductionAccount())); }
  catch { console.warn('[MP_PRODUCTION_READY] Verificação indisponível.'); }
}, 2000).unref();

router.get('/configuration', (req, res) => {
  const config = provider.configuration();
  res.set('Cache-Control', 'no-store').json({ success: true,
    enabled: config.enabled, testMode: config.mode === 'test',
    previewOnly: config.mode === 'production' && process.env.MP_REAL_SALE_TEST_ONLY === 'true' });
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
    payload.items = stock.aggregateItems(payload.items);
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
      if (existing?.response && existing.expiresAt > Date.now()) {
        const stored = await tx.get(db.collection(names.orders).doc(existing.orderNumber));
        if (stored.exists && ['paid', 'refunded', 'chargeback'].includes(stored.data().payment?.status)) return { settled: true };
        return { response: existing.response };
      }
      if (existing?.expiresAt && existing.expiresAt <= Date.now()) return { expired: true };
      if (existing?.lockedUntil > Date.now()) return { busy: true };
      const orderNumber = existing?.orderNumber || `AUR-${randomBytes(8).toString('hex').toUpperCase()}`;
      tx.set(attemptRef, { fingerprint, orderNumber, lease, lockedUntil: Date.now() + 60000 }, { merge: true });
      return { orderNumber };
    });
    if (claim.response) return res.json(claim.response);
    if (claim.settled) return res.status(409).json({ success: false, message: 'Este pagamento já foi registrado. Consulte seu link de acompanhamento.' });
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
      if (config.mode === 'production') stock.validatePilot(order);
      const reservationPlan = await stock.prepareReservation(db, order, config.mode);
      const pilotRef = config.mode === 'production' ? db.collection('mpRealSalePilot').doc('first-sale') : null;
      await db.runTransaction(async tx => {
        const attempt = (await tx.get(attemptRef)).data();
        if (attempt.lease !== lease) throw new Error('Tentativa concorrente.');
        if (pilotRef && (await tx.get(pilotRef)).exists) {
          const { AppError } = require('../../core/app-error');
          throw new AppError('Uma compra já está em andamento. Consulte o pedido antes de tentar novamente.', { status: 409 });
        }
        order.stock = await stock.reserveInTransaction(tx, reservationPlan);
        tx.create(orderRef, order);
        if (pilotRef) tx.create(pilotRef, { orderNumber: order.orderNumber, createdAt: order.createdAt });
        tx.set(db.collection(names.tracking).doc(order.publicTrackingToken), {
          id: order.orderNumber, orderNumber: order.orderNumber, createdAt: order.createdAt,
          status: 'pending', paymentStatus: 'pending', total: order.totals.total,
          logisticsStatus: 'pending', history: []
        });
      });
      if (config.mode === 'production') require('../catalog/catalog-storefront-service').invalidate();
    }
    if (!['pending', 'failed', 'cancelled'].includes(order.payment.status)) return res.status(409).json({ success: false, message: 'Este pedido já possui uma atualização de pagamento. Consulte o acompanhamento.' });
    // Em caso de falha após iniciar a chamada, não criar uma segunda preferência às cegas.
    if (order.payment.preferenceCreationStartedAt && !order.payment.preferenceId) return res.status(409).json({ success: false, message: 'A preparação deste pedido precisa ser conferida antes de uma nova tentativa.' });
    await db.runTransaction(async tx => {
      const attempt = (await tx.get(attemptRef)).data();
      const current = (await tx.get(orderRef)).data();
      if (attempt.lease !== lease) throw new Error('Tentativa concorrente.');
      if (current.payment.preferenceCreationStartedAt) {
        const { AppError } = require('../../core/app-error');
        throw new AppError('A preparação deste pedido precisa ser conferida antes de uma nova tentativa.', { status: 409 });
      }
      tx.update(orderRef, { 'payment.preferenceCreationStartedAt': new Date().toISOString() });
    });
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

async function applyVerifiedPayment(config, payment, expectedToken = null) {
    const account = await provider.request(config, '/users/me');
    const isTestAccount = Array.isArray(account.tags) && account.tags.includes('test_user');
    if (String(account.id) !== config.collectorId || isTestAccount !== (config.mode === 'test')) throw new Error('Conta incompatível.');
    const verifiedConfig = { ...config, testAccountVerified: isTestAccount };
    const names = collections(config), db = getFirestore();
    if (!/^AUR-[A-F0-9]{16}$/.test(payment.external_reference || '')) throw new Error('Referência inválida.');
    const ref = db.collection(names.orders).doc(payment.external_reference);
    return db.runTransaction(async tx => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) throw new Error('Pedido não encontrado.');
      const order = snapshot.data();
      if (expectedToken && order.publicTrackingToken !== expectedToken) throw new Error('Pedido incompatível.');
      if (!provider.paymentMatches(payment, order, verifiedConfig)) {
        console.warn('[MP_PAYMENT_MISMATCH]', JSON.stringify({
          referenceMatches: String(payment.external_reference) === order.orderNumber,
          collectorMatches: String(payment.collector_id) === config.collectorId,
          currency: payment.currency_id, liveMode: payment.live_mode, mode: config.mode,
          amountMatches: Math.round(Number(payment.transaction_amount) * 100) === Math.round(Number(order.totals.total) * 100)
        }));
        throw new Error('Pagamento incompatível.');
      }
      const updatedAt = Date.parse(payment.date_last_updated || payment.date_created);
      if (!Number.isFinite(updatedAt)) throw new Error('Data inválida.');
      if (order.payment.paymentId && String(order.payment.paymentId) !== String(payment.id) &&
          ['paid', 'refunded', 'chargeback'].includes(order.payment.status)) {
        // Uma segunda cobrança nunca substitui a primeira; requer revisão no painel do provedor.
        if (provider.paymentStatus(payment) === 'paid') tx.update(ref, { 'payment.reviewRequired': true });
        return order.payment.status;
      }
      if (Number(order.payment.providerUpdatedAt || 0) >= updatedAt) return order.payment.status;
      const status = provider.paymentStatus(payment);
      const changes = { 'payment.status': status, 'payment.providerStatus': payment.status,
        'payment.paymentId': String(payment.id), 'payment.providerUpdatedAt': updatedAt,
        updatedAt: new Date().toISOString() };
      if (status === 'paid') changes['payment.confirmedAt'] = payment.date_approved || new Date(updatedAt).toISOString();
      if (status === 'paid' && order.stock?.status === 'reserved') changes['stock.status'] = 'committed';
      tx.update(ref, changes);
      tx.set(db.collection(names.tracking).doc(order.publicTrackingToken), {
        paymentStatus: status, paymentConfirmedAt: changes['payment.confirmedAt'] || null,
        updatedAt: changes.updatedAt
      }, { merge: true });
      return status;
    });
}

router.post('/webhook', async (req, res) => {
  const config = provider.configuration();
  if (!config.enabled) return res.sendStatus(503);
  if (!provider.verifySignature(req, config.webhookSecret)) {
    console.warn('[MP_WEBHOOK] Assinatura inválida', JSON.stringify({
      hasSignature: Boolean(req.get('x-signature')), hasRequestId: Boolean(req.get('x-request-id')),
      hasDataId: Boolean(req.query['data.id']), mode: config.mode
    }));
    return res.sendStatus(401);
  }
  if (req.body?.type !== 'payment' && req.query.type !== 'payment') return res.sendStatus(200);
  try {
    const payment = await provider.request(config, `/v1/payments/${req.query['data.id']}`);
    await applyVerifiedPayment(config, payment);
    res.sendStatus(200);
  } catch { res.sendStatus(503); }
});

const reconciliationLimits = new Map();
router.post('/reconcile', async (req, res) => {
  const config = provider.configuration();
  if (!config.enabled) return res.sendStatus(503);
  const token = String(req.body?.token || ''), paymentId = String(req.body?.paymentId || '');
  if (!/^[a-f0-9]{64}$/i.test(token) || !/^\d{1,24}$/.test(paymentId)) return res.sendStatus(400);
  const now = Date.now(), key = `${req.ip}:${token}`;
  for (const [entry, value] of reconciliationLimits) if (value.until < now) reconciliationLimits.delete(entry);
  const limit = reconciliationLimits.get(key) || { count: 0, until: now + 60000 };
  if (++limit.count > 6 || reconciliationLimits.size > 5000) return res.sendStatus(429);
  reconciliationLimits.set(key, limit);
  try {
    const tracking = await getFirestore().collection(collections(config).tracking).doc(token).get();
    if (!tracking.exists) return res.sendStatus(404);
    // O ID enviado pelo navegador nunca é prova de aprovação: consultar o provedor autenticado.
    const payment = await provider.request(config, `/v1/payments/${paymentId}`);
    const status = await applyVerifiedPayment(config, payment, token);
    res.set('Cache-Control', 'no-store').json({ success: true, paymentStatus: status });
  } catch { res.status(503).json({ success: false, message: 'Não foi possível conferir o pagamento agora.' }); }
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
