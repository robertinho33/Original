"use strict";

const { getFirestore } = require("../../../infrastructure/firebase/firebase-admin");

function db() { return getFirestore(); }
function norm(value) { return String(value ?? "").trim().toLowerCase(); }
function number(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function dateValue(value) {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate();
    if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}
function dateString(value) { return dateValue(value)?.toISOString() || null; }
function dateOnly(value) { return dateString(value)?.slice(0, 10) || null; }
function orderStatuses(order) {
    return [order.payment?.status, order.paymentStatus, order.status].map(norm).filter(Boolean);
}
function isPaidOrder(order) {
    return orderStatuses(order).some(status => ["paid", "pago", "confirmed", "confirmado", "approved", "aprovado", "completed", "concluido", "concluído"].includes(status));
}
function isCancelledOrder(order) {
    return orderStatuses(order).some(status => ["cancelled", "canceled", "cancelado", "cancelada", "refunded", "estornado", "estornada", "chargeback", "contestado"].includes(status));
}
async function collection(name) {
    const snap = await db().collection(name).get();
    return snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
}
function contractForOrder(influencerId, orderDate, contracts) {
    if (!orderDate) return null;
    const day = dateOnly(orderDate);
    return contracts
        .filter(item => item.influencerId === influencerId && ["active", "ended"].includes(item.status))
        .filter(item => !item.startAt || item.startAt <= day)
        .filter(item => {
            const end = [item.endAt, item.endedAt ? dateOnly(item.endedAt) : null].filter(Boolean).sort()[0];
            return !end || end >= day;
        })
        .sort((a, b) => String(b.startAt || "0000-00-00").localeCompare(String(a.startAt || "0000-00-00")))[0] || null;
}
async function getOverview() {
    const [influencers, coupons, orders, contracts] = await Promise.all([
        collection("influencers"), collection("coupons"), collection("orders"), collection("influencerContracts")
    ]);
    const influencerById = new Map(influencers.map(item => [item.id, item]));
    const influencerByName = new Map(influencers.map(item => [norm(item.name), item]));
    const couponByCode = new Map();
    const couponById = new Map();
    for (const coupon of coupons) {
        const influencer = influencerById.get(String(coupon.influencerId || coupon.influencer_id || "")) || influencerByName.get(norm(coupon.affiliateName || coupon.affiliate_name || coupon.influencerName || coupon.influencer_name));
        if (coupon.id) couponById.set(String(coupon.id), { ...coupon, influencer });
        const code = coupon.code || coupon.couponCode || coupon.coupon_code;
        if (code) couponByCode.set(norm(code), { ...coupon, influencer });
    }
    const totals = new Map(influencers.map(item => [item.id, {
        influencerId: item.id, influencerName: item.name, active: item.active !== false,
        coupons: [], orderCount: 0, paidOrders: 0, paidRevenue: 0,
        commissionEarned: 0, pendingOrders: 0
    }]));
    for (const coupon of coupons) {
        const influencer = influencerById.get(String(coupon.influencerId || coupon.influencer_id || "")) || influencerByName.get(norm(coupon.affiliateName || coupon.affiliate_name || coupon.influencerName || coupon.influencer_name));
        if (!influencer || !totals.has(influencer.id)) continue;
        totals.get(influencer.id).coupons.push({
            id: coupon.id,
            code: coupon.code || coupon.couponCode || coupon.coupon_code || "—",
            active: coupon.active !== false
        });
    }
    const attributedOrders = [];
    for (const order of orders) {
        const rawOrderCoupon = order.coupon && typeof order.coupon === "object" ? order.coupon : {};
        const orderCoupon = typeof order.coupon === "string" ? { code: order.coupon } : rawOrderCoupon;
        const coupon = couponById.get(String(orderCoupon.id || orderCoupon.couponId || orderCoupon.coupon_id || "")) || couponByCode.get(norm(orderCoupon.code || orderCoupon.couponCode || orderCoupon.coupon_code || order.couponCode || order.coupon_code));
        const influencer = coupon?.influencer;
        if (!influencer || !totals.has(influencer.id)) {
            const usedCouponCode = orderCoupon.code || orderCoupon.couponCode || orderCoupon.coupon_code || order.couponCode || order.coupon_code;
            const orderDiscount = number(order.discount ?? order.totals?.discount) ?? 0;
            if (isPaidOrder(order) && !isCancelledOrder(order) && (usedCouponCode || orderDiscount > 0)) {
                attributedOrders.push({
                    orderDocumentId: order.id,
                    orderId: String(order.orderNumber || order.order_number || order.id || "—"),
                    createdAt: dateString(order.createdAt),
                    couponCode: usedCouponCode || null,
                    orderDiscount,
                    paymentStatus: "Pago",
                    commissionBasisAvailable: false,
                    unlinked: true,
                    missingCouponData: !usedCouponCode
                });
            }
            continue;
        }
        const cancelled = isCancelledOrder(order);
        const paid = isPaidOrder(order) && !cancelled;
        const orderDate = dateString(order.paidAt || order.payment?.paidAt || order.payment?.confirmedAt || order.createdAt);
        const contract = contractForOrder(influencer.id, orderDate, contracts);
        const subtotal = number(order.subtotal ?? order.totals?.subtotal);
        const discount = number(order.discount ?? order.totals?.discount ?? 0) ?? 0;
        const base = subtotal === null ? null : Math.round(Math.max(0, subtotal - discount) * 100) / 100;
        const couponRate = number(coupon.commission);
        const rate = number(contract?.commissionRate ?? couponRate ?? influencer.commissionDefault) ?? 0;
        const commissionRateSource = contract ? "Contrato" : couponRate !== null ? "Cupom" : "Cadastro";
        const amount = paid && base !== null ? Math.round(base * rate) / 100 : null;
        const row = totals.get(influencer.id);
        row.orderCount += 1;
        if (paid) {
            row.paidOrders += 1;
            row.paidRevenue += number(order.total ?? order.totals?.total) ?? 0;
            if (amount !== null) row.commissionEarned += amount;
        } else if (!cancelled) row.pendingOrders += 1;
        attributedOrders.push({
            orderDocumentId: order.id,
            orderId: String(order.orderNumber || order.order_number || order.id || "—"),
            createdAt: dateString(order.createdAt),
            commissionDate: orderDate,
            influencerId: influencer.id,
            influencerName: influencer.name,
            contractId: contract?.id || null,
            couponCode: coupon.code || coupon.couponCode || coupon.coupon_code || orderCoupon.code || "—",
            paymentStatus: paid ? "Pago" : (cancelled ? "Cancelado/estornado" : "Pendente"),
            orderTotal: number(order.total ?? order.totals?.total) ?? 0,
            commissionBase: base,
            commissionRate: rate,
            commissionRateSource,
            contractTitle: contract?.title || null,
            commissionAmount: amount,
            commissionBasisAvailable: base !== null
        });
    }
    return {
        influencers: [...totals.values()].map(item => ({ ...item, paidRevenue: Math.round(item.paidRevenue * 100) / 100, commissionEarned: Math.round(item.commissionEarned * 100) / 100 })),
        attributedOrders: attributedOrders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
        unlinkedPaidOrders: attributedOrders.filter(item => item.unlinked),
        reconciliationNote: "Comissão estimada sobre subtotal menos desconto, sem frete. Usa o contrato válido na data da venda; sem contrato, usa a taxa do cupom ou do influenciador. Apenas pedidos pagos entram no total."
    };
}
module.exports = { getOverview, isPaidOrder, isCancelledOrder };
