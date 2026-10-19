'use strict';
const provider = require('./mercado-pago-provider');

function statusHandler(dependencies = {}) {
  const attempts = new Map();
  return async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const config = (dependencies.configuration || provider.configuration)();
    if (!config.enabled) return res.status(503).json({success: false, message: 'A consulta de pagamento está indisponível.'});
    const token = String(req.body?.token || '');
    if (!/^[a-f0-9]{64}$/i.test(token)) return res.sendStatus(400);
    const now = Date.now();
    for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
    const entry = attempts.get(token) || {until: now + 60000, count: 0};
    if (++entry.count > 20 || attempts.size > 5000) return res.status(429).json({success: false, message: 'Aguarde alguns segundos para conferir novamente.'});
    attempts.set(token, entry);
    try {
      const db = dependencies.db || dependencies.getDb?.() || require('../../infrastructure/firebase/firebase-admin').getFirestore();
      const names = config.mode === 'test' ? {orders: 'mpTestOrders', tracking: 'mpTestTracking'} : {orders: 'orders', tracking: 'orderTracking'};
      const tracking = await db.collection(names.tracking).doc(token).get();
      if (!tracking.exists || !/^AUR-[A-F0-9]{16}$/.test(tracking.data().orderNumber || '')) return res.sendStatus(404);
      const ref = db.collection(names.orders).doc(tracking.data().orderNumber);
      const snapshot = await ref.get();
      if (!snapshot.exists) return res.sendStatus(404);
      let order = snapshot.data();
      if (order.publicTrackingToken !== token || order.payment?.provider !== 'mercado-pago' || order.payment.mode !== config.mode ||
          order.payment.experience !== 'embedded_pix' || !/^\d{1,24}$/.test(order.payment.pix?.paymentId || '')) return res.sendStatus(404);
      if (order.payment.status === 'pending') {
        const payment = await (dependencies.request || provider.request)(config, '/v1/payments/' + order.payment.pix.paymentId);
        // This callback rechecks owner, total, currency, live mode and external reference.
        await dependencies.confirmPayment(config, payment, token);
        order = (await ref.get()).data();
      }
      const data = {orderNumber: order.orderNumber, total: order.totals.total, paymentStatus: order.payment.status};
      if (order.payment.status === 'pending') data.pix = order.payment.pix;
      res.json({success: true, data});
    } catch {
      res.status(503).json({success: false, message: 'Não foi possível conferir a confirmação agora. Aguarde a próxima consulta automática.'});
    }
  };
}
module.exports = {statusHandler};
