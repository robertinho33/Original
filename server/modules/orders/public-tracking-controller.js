'use strict';

const { getFirestore } = require('../../infrastructure/firebase/firebase-admin');

const attempts = new Map();
const MAX_PER_WINDOW = 40;
const WINDOW_MS = 60 * 1000;

function allowed(req) {
    const now = Date.now();
    const ip = String(req.get?.('x-forwarded-for') || req.ip || req.socket?.remoteAddress || 'unknown')
        .split(',')[0]
        .trim();
    const current = attempts.get(ip);
    if (attempts.size > 10000) {
        for (const [key, value] of attempts) {
            if (now - value.startedAt >= WINDOW_MS) attempts.delete(key);
        }
    }
    if (!current || now - current.startedAt >= WINDOW_MS) {
        attempts.set(ip, { startedAt: now, count: 1 });
        return true;
    }
    current.count += 1;
    return current.count <= MAX_PER_WINDOW;
}

function safeDate(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    return typeof value === 'string' ? value : null;
}

function publicFields(id, data = {}) {
    return {
        id: String(data.orderNumber || data.id || id),
        orderNumber: String(data.orderNumber || data.id || id),
        createdAt: safeDate(data.createdAt),
        status: String(data.status || 'pending'),
        paymentStatus: String(data.paymentStatus || 'pending'),
        paymentConfirmedAt: safeDate(data.paymentConfirmedAt),
        trackingToken: /^[a-f0-9]{64}$/i.test(String(id)) ? String(id) : '',
        logisticsStatus: String(data.logisticsStatus || 'pending'),
        carrier: String(data.carrier || ''),
        trackingCode: String(data.trackingCode || ''),
        postedAt: safeDate(data.postedAt),
        estimatedDelivery: safeDate(data.estimatedDelivery),
        deliveredAt: safeDate(data.deliveredAt),
        history: (Array.isArray(data.history) ? data.history : [])
            .slice(-40)
            .map(event => ({
                type: String(event?.type || '').slice(0, 80),
                label: String(event?.label || '').slice(0, 120),
                status: String(event?.status || '').slice(0, 60),
                paymentStatus: String(event?.paymentStatus || '').slice(0, 60),
                createdAt: safeDate(event?.createdAt)
            }))
    };
}

async function getPublicTracking(req, res) {
    if (!allowed(req)) {
        return res.status(429).json({ success: false, error: 'Muitas consultas. Aguarde um minuto e tente novamente.' });
    }

    const reference = String(req.params.reference || '').trim();
    const isToken = /^[a-f0-9]{64}$/i.test(reference);
    const isOrderNumber = /^AUR-[A-Z0-9]{4,24}$/i.test(reference);
    if (!isToken && !isOrderNumber) {
        return res.status(404).json({ success: false, error: 'Pedido não encontrado.' });
    }

    try {
        const collection = getFirestore().collection('orderTracking');
        let snapshot = await collection.doc(reference).get();
        if (!snapshot.exists && isOrderNumber) {
            const matches = await collection
                .where('orderNumber', '==', reference.toUpperCase())
                .limit(1)
                .get();
            snapshot = matches.empty ? null : matches.docs[0];
        }

        if (!snapshot || !snapshot.exists) {
            return res.status(404).json({ success: false, error: 'Pedido não encontrado.' });
        }

        res.set('Cache-Control', 'no-store');
        return res.json({ success: true, data: publicFields(snapshot.id, snapshot.data()) });
    } catch (error) {
        console.error('[PUBLIC TRACKING] Consulta falhou:', error?.message || error);
        return res.status(503).json({ success: false, error: 'Não foi possível consultar o pedido agora.' });
    }
}

module.exports = { getPublicTracking };
