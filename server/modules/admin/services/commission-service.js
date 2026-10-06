"use strict";

const { createHash } = require("node:crypto");
const { getFirestore } = require("../../../infrastructure/firebase/firebase-admin");
const partnershipService = require("./partnership-service");
const COLLECTION = "influencerCommissions";
function db() { return getFirestore(); }
function actorName(value) {
    const result = String(value ?? "").trim();
    if (!result || result.length > 160) throw new Error("Identifique o responsável pela ação.");
    return result;
}
function documentId(orderDocumentId) {
    return createHash("sha256").update(String(orderDocumentId)).digest("hex");
}
async function list() {
    const snapshot = await db().collection(COLLECTION).get();
    return snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id }))
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}
async function sync(actor) {
    const now = new Date().toISOString();
    const overview = await partnershipService.getOverview();
    const sourceByOrder = new Map(overview.attributedOrders.map(item => [item.orderDocumentId, item]));
    const eligible = overview.attributedOrders.filter(item =>
        item.paymentStatus === "Pago" && !item.unlinked && item.commissionBasisAvailable && item.orderDocumentId
    );
    let created = 0;
    let voided = 0;
    let reviewRequired = 0;
    for (const item of eligible) {
        const id = documentId(item.orderDocumentId);
        const ref = db().collection(COLLECTION).doc(id);
        const record = {
            orderDocumentId: item.orderDocumentId,
            orderId: item.orderId,
            influencerId: item.influencerId,
            influencerName: item.influencerName,
            contractId: item.contractId,
            couponCode: item.couponCode,
            orderPaidAt: item.commissionDate,
            commissionBase: item.commissionBase,
            commissionRate: item.commissionRate,
            commissionRateSource: item.commissionRateSource,
            contractTitle: item.contractTitle,
            amount: item.commissionAmount,
            currency: "BRL",
            status: "pending",
            createdAt: now,
            updatedAt: now,
            createdBy: actorName(actor),
            paidAt: null,
            paidBy: null,
            paymentReference: null
        };
        const result = await db().runTransaction(async transaction => {
            const existing = await transaction.get(ref);
            if (existing.exists) {
                const current = existing.data() || {};
                if (current.status === "review_required" && current.reviewReason === "Dados do cupom não foram salvos no pedido; identifique o cupom antes de registrar a comissão.") {
                    transaction.update(ref, { ...record, status: "pending", createdAt: current.createdAt || now, updatedAt: now });
                    return "linked";
                }
                return "exists";
            }
            transaction.create(ref, record);
            return "created";
        });
        if (result === "created" || result === "linked") created += 1;
    }

    const unresolved = overview.unlinkedPaidOrders.filter(item => item.orderDocumentId);
    for (const item of unresolved) {
        const id = documentId(item.orderDocumentId);
        const ref = db().collection(COLLECTION).doc(id);
        const reason = item.missingCouponData
            ? "Dados do cupom não foram salvos no pedido; identifique o cupom antes de registrar a comissão."
            : "Cupom sem vínculo com influenciador; vincule o influenciador antes de registrar a comissão.";
        const record = {
            orderDocumentId: item.orderDocumentId,
            orderId: item.orderId,
            influencerId: null,
            influencerName: "Não identificado",
            contractId: null,
            couponCode: item.couponCode,
            orderPaidAt: item.createdAt,
            commissionBase: null,
            commissionRate: null,
            commissionRateSource: null,
            contractTitle: null,
            amount: 0,
            currency: "BRL",
            status: "review_required",
            reviewReason: reason,
            createdAt: now,
            updatedAt: now,
            createdBy: actorName(actor),
            paidAt: null,
            paidBy: null,
            paymentReference: null
        };
        const wasCreated = await db().runTransaction(async transaction => {
            const existing = await transaction.get(ref);
            if (existing.exists) return false;
            transaction.create(ref, record);
            return true;
        });
        if (wasCreated) reviewRequired += 1;
    }

    const ledger = await list();
    for (const item of ledger) {
        const source = sourceByOrder.get(item.orderDocumentId);
        const reason = !source
            ? "Pedido ou vínculo do cupom não localizado na conciliação."
            : source.unlinked
                ? (source.missingCouponData
                    ? "Dados do cupom não foram salvos no pedido; identifique o cupom antes de registrar a comissão."
                    : "Cupom sem vínculo com influenciador; vincule o influenciador antes de registrar a comissão.")
            : source.paymentStatus === "Cancelado/estornado"
                ? "Pedido cancelado, estornado ou contestado após a geração da comissão."
                : source.paymentStatus !== "Pago"
                    ? "O pedido não está confirmado como pago na conciliação."
                    : "";
        if (!reason) continue;
        const ref = db().collection(COLLECTION).doc(item.id);
        const nextStatus = source && item.status === "pending" && source.paymentStatus !== "Pago" ? "void" : "review_required";
        const changed = await db().runTransaction(async transaction => {
            const current = await transaction.get(ref);
            if (!current.exists) return false;
            const status = current.data()?.status;
            if (status !== "pending" && status !== "paid") return false;
            const safeStatus = status === "pending" && nextStatus === "void" ? "void" : "review_required";
            transaction.update(ref, {
                status: safeStatus,
                ...(status === "paid" ? { previousStatus: "paid" } : {}),
                reviewReason: reason,
                updatedAt: now,
                reviewedBy: actorName(actor)
            });
            return safeStatus;
        });
        if (changed === "void") voided += 1;
        if (changed === "review_required") reviewRequired += 1;
    }
    const skippedWithoutBase = overview.attributedOrders.filter(item =>
        item.paymentStatus === "Pago" && !item.unlinked && !item.commissionBasisAvailable
    ).length;
    return {
        created,
        voided,
        reviewRequired,
        skippedWithoutBase,
        unlinkedPaidOrders: overview.unlinkedPaidOrders.length,
        unlinkedCoupons: [...new Set(overview.unlinkedPaidOrders.map(item => item.couponCode).filter(Boolean))],
        missingCouponData: overview.unlinkedPaidOrders.filter(item => item.missingCouponData).map(item => ({
            orderId: item.orderId,
            discount: item.orderDiscount
        })),
        total: (await list()).length,
        syncedAt: now
    };
}
async function markPaid(id, data = {}, actor) {
    const paymentReference = String(data.paymentReference ?? "").trim();
    if (!paymentReference) throw new Error("Informe a referência do pagamento para registrar a quitação.");
    if (paymentReference.length > 160) throw new Error("A referência deve ter até 160 caracteres.");
    const ref = db().collection(COLLECTION).doc(String(id || ""));
    if (!id) throw new Error("Comissão inválida.");
    const now = new Date().toISOString();
    const paidBy = actorName(actor);
    return db().runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) throw new Error("Comissão não encontrada.");
        const current = snapshot.data() || {};
        if (current.status !== "pending") throw new Error("Somente comissões pendentes podem ser pagas.");
        const orderRef = db().collection("orders").doc(String(current.orderDocumentId || ""));
        const order = await transaction.get(orderRef);
        if (!order.exists || !partnershipService.isPaidOrder(order.data() || {}) || partnershipService.isCancelledOrder(order.data() || {})) {
            throw new Error("O pedido não está mais pago. Sincronize as comissões antes de registrar o pagamento.");
        }
        transaction.update(ref, {
            status: "paid",
            paidAt: now,
            paidBy,
            paymentReference,
            updatedAt: now
        });
        return { id: snapshot.id, ...current, status: "paid", paidAt: now, paidBy, paymentReference, updatedAt: now };
    });
}
module.exports = { list, sync, markPaid };
