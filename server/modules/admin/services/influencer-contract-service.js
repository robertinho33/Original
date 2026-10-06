"use strict";
const { getFirestore } = require("../../../infrastructure/firebase/firebase-admin");
const COLLECTION = "influencerContracts";
function db() { return getFirestore(); }
function text(value, max, label, required = false) {
    const result = String(value ?? "").trim();
    if (required && !result) throw new Error(`${label} é obrigatório.`);
    if (result.length > max) throw new Error(`${label} deve ter até ${max} caracteres.`);
    return result;
}
function rate(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error("A comissão deve estar entre 0 e 100%.");
    return n;
}
function validateDates(startAt, endAt) {
    const start = startAt ? new Date(startAt) : null;
    const end = endAt ? new Date(endAt) : null;
    if ((start && !Number.isFinite(start.getTime())) || (end && !Number.isFinite(end.getTime()))) throw new Error("Informe datas válidas para a vigência.");
    if (start && end && end < start) throw new Error("O fim da vigência deve ser posterior ao início.");
}
async function list() {
    const snap = await db().collection(COLLECTION).get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}
async function create(data = {}, actor = "admin") {
    const influencerId = text(data.influencerId, 128, "Influenciador", true);
    const influencerSnap = await db().collection("influencers").doc(influencerId).get();
    if (!influencerSnap.exists) throw new Error("Selecione um influenciador cadastrado.");
    const influencer = influencerSnap.data() || {};
    const startAt = text(data.startAt, 10, "Início");
    const endAt = text(data.endAt, 10, "Fim");
    validateDates(startAt, endAt);
    const now = new Date().toISOString();
    const contract = {
        influencerId,
        influencerName: text(influencer.name, 160, "Nome", true),
        title: text(data.title, 120, "Título", true),
        terms: text(data.terms, 8000, "Termos", true),
        commissionRate: rate(data.commissionRate),
        startAt: startAt || null,
        endAt: endAt || null,
        status: "draft",
        createdAt: now,
        updatedAt: now,
        createdBy: text(actor, 80, "Responsável", true),
        activatedAt: null,
        activatedBy: null
    };
    const ref = await db().collection(COLLECTION).add(contract);
    return { id: ref.id, ...contract };
}
async function activate(id, data = {}, actor = "admin") {
    if (data.confirmReviewed !== true) throw new Error("Confirme que as partes revisaram e aceitaram estes termos antes de ativar.");
    const ref = db().collection(COLLECTION).doc(text(id, 128, "Contrato", true));
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Contrato não encontrado.");
    if (snap.data()?.status !== "draft") throw new Error("Somente contratos em rascunho podem ser ativados.");
    const contract = snap.data() || {};
    const today = new Date().toISOString().slice(0, 10);
    const active = await db().collection(COLLECTION).where("influencerId", "==", contract.influencerId).get();
    if (active.docs.some(doc => { const item = doc.data() || {}; return item.status === "active" && (!item.endAt || item.endAt >= today); })) throw new Error("Este influenciador já tem um contrato ativo. Encerre-o antes de ativar outro.");
    if (contract.startAt && contract.startAt > today) throw new Error("Aguarde o início da vigência para ativar este contrato.");
    if (contract.endAt && contract.endAt < today) throw new Error("A vigência deste contrato já terminou.");
    const now = new Date().toISOString();
    await ref.update({ status: "active", updatedAt: now, activatedAt: now, activatedBy: text(actor, 80, "Responsável", true) });
    return { id: ref.id, ...snap.data(), status: "active", updatedAt: now, activatedAt: now, activatedBy: actor };
}
async function end(id, actor = "admin") {
    const ref = db().collection(COLLECTION).doc(text(id, 128, "Contrato", true));
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Contrato não encontrado.");
    if (snap.data()?.status !== "active") throw new Error("Somente contratos ativos podem ser encerrados.");
    const now = new Date().toISOString();
    await ref.update({ status: "ended", updatedAt: now, endedAt: now, endedBy: text(actor, 80, "Responsável", true) });
    return { id: ref.id, ...snap.data(), status: "ended", updatedAt: now, endedAt: now, endedBy: actor };
}
module.exports = { list, create, activate, end };

