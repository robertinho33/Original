'use strict';
const express = require('express');
const { randomBytes, createHash } = require('node:crypto');
const provider = require('./infinitepay-provider');
const { validateOrderPayload } = require('../../core/payload-validator');

// Dependencies can be replaced in tests without contacting Firebase or the payment API.
function createRouter(deps = {}) {
  const router = express.Router();
  const getDb = deps.getDb || (() => require('../../infrastructure/firebase/firebase-admin').getFirestore());
  const buildOrder = deps.buildOrder || (payload => require('../orders/complete-order-builder').buildCompleteOrder(payload));
  const stock = deps.stock || require('../inventory/stock-reservations');
  const commitStock = deps.commitStock || require('../inventory/payment-stock').commitPaidStock;
  const notify = deps.notify || (order => require('../communication/paid-order-notification').notifyPaidOrder(order));
  const invalidate = deps.invalidate || (() => require('../catalog/catalog-storefront-service').invalidate());
  const request = deps.request || provider.request;
  const configFor = deps.configuration || provider.configuration;
  const validOrder = value => /^AUR-[A-F0-9]{16}$/.test(value || '');
  const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(value);
  function config() {
    const result = configFor();
    if (!result.enabled) throw provider.fail('InfinitePay ainda não está disponível.');
    return result;
  }
  function error(res, err) {
    return res.status(err.status || 503).json({ success: false,
      message: err.status && err.status < 500 ? err.message : 'Não foi possível confirmar a operação. Consulte seu pedido antes de tentar novamente.' });
  }
  router.get('/configuration', (req, res) => res.set('Cache-Control', 'no-store').json({ success: true, enabled: configFor().enabled }));
  router.post('/attempt/recover', async (req, res) => {
    try {
      const id = req.body?.checkoutAttemptId;
      if (!/^[a-f0-9-]{36}$/i.test(id || '')) throw provider.fail('Tentativa inválida.', 400);
      const db = getDb(), attemptRef = db.collection('infinitepayAttempts').doc(id);
      const data = await db.runTransaction(async tx => {
        const snapshot = await tx.get(attemptRef);
        if (!snapshot.exists) {
          // Close the old ID atomically: a request delayed in transit cannot create a payment later.
          tx.create(attemptRef, { closed: true, closedAt: new Date().toISOString() });
          return { state: 'empty' };
        }
        const attempt = snapshot.data();
        if (attempt.closed) return { state: 'empty' };
        if (!validOrder(attempt.orderNumber)) throw provider.fail('Tentativa precisa de conferência.', 409);
        const saved = await tx.get(db.collection('orders').doc(attempt.orderNumber));
        const order = saved.exists ? saved.data() : null;
        if (!order || order.payment?.provider !== 'infinitepay') throw provider.fail('Pedido precisa de conferência.', 409);
        return { state: 'order', orderNumber: order.orderNumber,
          trackingToken: order.publicTrackingToken, paymentStatus: order.payment.status };
      });
      res.set('Cache-Control', 'no-store').json({ success: true, data });
    } catch (err) { error(res, err); }
  });
  router.post('/checkout', async (req, res) => {
    let order, persisted = false;
    try {
      const cfg = config(), db = getDb();
      const payload = validateOrderPayload(req.body);
      if (!/^[a-f0-9-]{36}$/i.test(payload.checkoutAttemptId || '')) throw provider.fail('Tentativa inválida.', 400);
      const items = stock.aggregateItems(payload.items).sort((a, b) => a.sku.localeCompare(b.sku));
      const input = { items, customer: payload.customer || {}, address: payload.address || null,
        deliveryMethod: payload.deliveryMethod || 'delivery', shippingSelection: payload.shippingSelection || null,
        coupon: payload.coupon || null, notes: String(payload.notes || '').trim().slice(0, 1500), paymentMethod: 'online' };
      const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
      const attemptRef = db.collection('infinitepayAttempts').doc(payload.checkoutAttemptId);
      // Existing attempts never generate another link after an ambiguous network result.
      const existing = await attemptRef.get();
      if (existing.exists) return await reuse(existing.data());
      const draft = await buildOrder(input);
      provider.cents(draft.totals.total);
      order = { ...draft, notes: input.notes, orderNumber: `AUR-${randomBytes(8).toString('hex').toUpperCase()}`,
        publicTrackingToken: randomBytes(32).toString('hex'),
        payment: { method: 'online', provider: 'infinitepay', mode: 'production', status: 'pending',
          handle: cfg.handle, linkStatus: 'creating', expiresAt: new Date(Date.now() + 30 * 60000).toISOString() } };
      const orderRef = db.collection('orders').doc(order.orderNumber);
      const plans = await stock.prepareReservation(db, order, 'production_inventory');
      const won = await db.runTransaction(async tx => {
        const current = await tx.get(attemptRef);
        if (current.exists) return false;
        order.stock = await stock.reserveInTransaction(tx, plans);
        tx.create(orderRef, order);
        tx.create(attemptRef, { fingerprint, orderNumber: order.orderNumber, trackingToken: order.publicTrackingToken });
        tx.create(db.collection('orderTracking').doc(order.publicTrackingToken), {
          orderNumber: order.orderNumber, createdAt: order.createdAt, status: 'pending',
          paymentStatus: 'pending', paymentProvider: 'infinitepay', logisticsStatus: 'pending', history: [] });
        return true;
      });
      if (!won) return await reuse((await attemptRef.get()).data());
      persisted = true;
      invalidate();
      const result = await request(cfg, '/links', provider.linkBody(order, cfg));
      const checkoutUrl = provider.checkoutUrl(result.url);
      await orderRef.update({ 'payment.checkoutUrl': checkoutUrl, 'payment.linkStatus': 'ready' });
      return res.json({ success: true, data: { checkoutUrl, orderNumber: order.orderNumber, trackingToken: order.publicTrackingToken } });

      async function reuse(attempt) {
        if (attempt.closed) throw provider.fail('Esta tentativa foi encerrada com segurança. Atualize a página e tente novamente.', 409);
        if (attempt.fingerprint !== fingerprint) throw provider.fail('Os dados desta tentativa mudaram. Consulte o pedido anterior.', 409);
        const saved = (await db.collection('orders').doc(attempt.orderNumber).get()).data();
        if (!saved || saved.payment?.provider !== 'infinitepay') throw provider.fail('Pedido indisponível.', 409);
        const data = { orderNumber: saved.orderNumber, trackingToken: saved.publicTrackingToken };
        if (saved.payment.status !== 'pending' || Date.parse(saved.payment.expiresAt) <= Date.now()) {
          return res.status(409).json({ success: false, message: 'Consulte o acompanhamento deste pedido.', data });
        }
        if (!saved.payment.checkoutUrl) return res.status(409).json({ success: false,
          message: 'O link deste pedido precisa de conferência. Consulte a loja antes de iniciar outro pagamento.', data });
        return res.json({ success: true, data: { ...data, checkoutUrl: provider.checkoutUrl(saved.payment.checkoutUrl) } });
      }
    } catch (err) {
      // Keep the order and reservation: a failed response does not prove no link was created.
      if (persisted) return res.status(503).json({ success: false,
        message: 'Não foi possível concluir a abertura do pagamento. Consulte a loja com este pedido antes de tentar novamente.',
        data: { orderNumber: order.orderNumber, trackingToken: order.publicTrackingToken } });
      return error(res, err);
    }
  });
  async function confirm(body, requireToken) {
    const cfg = config(), db = getDb();
    if (!body || !validOrder(body.order_nsu) || !identifier(body.transaction_nsu) || !identifier(body.slug || body.invoice_slug)) {
      throw provider.fail('Referência de pagamento inválida.', 400);
    }
    const ref = db.collection('orders').doc(body.order_nsu);
    const snapshot = await ref.get(), order = snapshot.exists ? snapshot.data() : null;
    if (!order || order.payment?.provider !== 'infinitepay' || order.payment.handle !== cfg.handle ||
      (requireToken && (!/^[a-f0-9]{64}$/i.test(body.token || '') || body.token !== order.publicTrackingToken))) {
      throw provider.fail('Pedido não encontrado.', 404);
    }
    // Neither the browser callback nor webhook contents are proof of payment.
    const payment = await request(cfg, '/payment_check', { handle: cfg.handle, order_nsu: body.order_nsu,
      transaction_nsu: body.transaction_nsu, slug: body.slug || body.invoice_slug });
    if (payment.success !== true || typeof payment.paid !== 'boolean') throw provider.fail('Resposta de confirmação inválida.', 502);
    if (!payment.paid) return { paymentStatus: order.payment.status };
    if (!provider.verifiedPayment(payment, order)) throw provider.fail('Pagamento incompatível com o pedido.', 409);
    const transactionRef = db.collection('infinitepayTransactions').doc(body.transaction_nsu);
    await db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data();
      const used = await tx.get(transactionRef);
      if (used.exists && used.data().orderNumber !== order.orderNumber) throw provider.fail('Transação já vinculada.', 409);
      if (current.payment.status === 'paid') {
        if (current.payment.paymentId !== body.transaction_nsu) throw provider.fail('Pagamento diferente do registrado.', 409);
        return;
      }
      if (current.payment.status !== 'pending') throw provider.fail('Pedido precisa de conferência.', 409);
      const now = new Date().toISOString();
      const changes = current.stock?.status === 'released' ? { 'payment.reviewRequired': true } : await commitStock(db, tx, current);
      if (changes['stock.reviewRequired']) changes['payment.reviewRequired'] = true;
      tx.set(transactionRef, { orderNumber: order.orderNumber });
      tx.update(ref, { ...changes, 'payment.status': 'paid', 'payment.paymentId': body.transaction_nsu,
        'payment.slug': body.slug || body.invoice_slug, 'payment.confirmedAt': now,
        'payment.method': payment.capture_method === 'pix' ? 'pix' : 'card', updatedAt: now });
      tx.set(db.collection('orderTracking').doc(order.publicTrackingToken), { paymentStatus: 'paid', paymentConfirmedAt: now }, { merge: true });
    });
    invalidate();
    try { await notify((await ref.get()).data()); } catch { console.warn('[INFINITEPAY] Aviso de expedição precisa de conferência.'); }
    return { paymentStatus: 'paid' };
  }
  router.post('/webhook', async (req, res) => {
    try { await confirm(req.body, false); res.json({ success: true }); } catch (err) { error(res, err); }
  });
  router.post('/confirm', async (req, res) => {
    try { res.set('Cache-Control', 'no-store').json({ success: true, data: await confirm(req.body, true) }); } catch (err) { error(res, err); }
  });
  router.post('/resume', async (req, res) => {
    try {
      config();
      if (!validOrder(req.body?.orderNumber) || !/^[a-f0-9]{64}$/i.test(req.body?.token || '')) throw provider.fail('Pedido não encontrado.', 404);
      const snapshot = await getDb().collection('orders').doc(req.body.orderNumber).get();
      const order = snapshot.exists ? snapshot.data() : null;
      if (!order || order.payment?.provider !== 'infinitepay' || order.publicTrackingToken !== req.body.token) throw provider.fail('Pedido não encontrado.', 404);
      const data = { paymentStatus: order.payment.status };
      if (order.payment.status === 'pending' && Date.parse(order.payment.expiresAt) > Date.now() && order.payment.checkoutUrl) data.checkoutUrl = provider.checkoutUrl(order.payment.checkoutUrl);
      res.set('Cache-Control', 'no-store').json({ success: true, data });
    } catch (err) { error(res, err); }
  });
  return router;
}
module.exports = { createRouter };
