"use strict";

const { getFirestore } = require("../../../infrastructure/firebase/firebase-admin");

const HERO_COLLECTION = "settings";
const HERO_ACTIVE_ID = "storefrontHero";
const HERO_DRAFT_ID = "storefrontHeroDraft";
const CAMPAIGNS = "incentiveCampaigns";

function db() { return getFirestore(); }
function text(value, max = 240) { return String(value ?? "").trim().slice(0, max); }
function money(value) { const amount = Number(value || 0); return Number.isFinite(amount) ? Math.max(0, amount) : 0; }
function when(value) {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate();
    if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}
function iso(value) { return when(value)?.toISOString() || null; }
function normalized(value) { return text(value, 320).toLocaleLowerCase("pt-BR"); }
function paid(order) {
    const states = [order.payment?.status, order.paymentStatus, order.status].map(normalized);
    if (states.some(status => ["cancelled", "canceled", "cancelado", "cancelada", "refunded", "reembolsado", "estornado", "chargeback"].includes(status))) return false;
    return states.some(value => ["paid", "pago", "confirmed", "confirmado", "approved", "aprovado", "completed"].includes(value));
}
function customerKey(order) {
    const email = normalized(order.customer?.email || order.email);
    if (email) return `email:${email}`;
    const phone = text(order.customer?.phone || order.phone, 40).replace(/\D/g, "");
    if (phone) return `phone:${phone}`;
    const id = text(order.customerId || order.userId || order.customer?.id, 180);
    return id ? `id:${id}` : `order:${text(order.id, 180)}`;
}
function customerLabel(order) {
    return text(order.customer?.name || order.customerName || order.customer_name, 160) || "Cliente";
}
function validHeroUrl(value) {
    const url = text(value, 1200);
    if (!url) return "";
    if ((url.startsWith("/") && !url.startsWith("//")) || url.startsWith("#")) return url;
    try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" ? url : "";
    } catch {
        return "";
    }
}
function normalizeHero(body = {}) {
    return {
        eyebrow: text(body.eyebrow, 80),
        title: text(body.title, 90),
        emphasis: text(body.emphasis, 60),
        ending: text(body.ending, 90),
        description: text(body.description, 320),
        buttonLabel: text(body.buttonLabel, 40),
        buttonUrl: validHeroUrl(body.buttonUrl),
        imageUrl: validHeroUrl(body.imageUrl),
        imageAlt: text(body.imageAlt, 160),
        startsAt: text(body.startsAt, 32) || null,
        endsAt: text(body.endsAt, 32) || null
    };
}
function actorName(actor) { return text(actor, 160) || "Administrador"; }

async function getHeroDraft() {
    const [draftSnapshot, activeSnapshot] = await Promise.all([
        db().collection(HERO_COLLECTION).doc(HERO_DRAFT_ID).get(),
        db().collection(HERO_COLLECTION).doc(HERO_ACTIVE_ID).get()
    ]);
    return {
        draft: draftSnapshot.exists ? { id: draftSnapshot.id, ...draftSnapshot.data() } : {},
        active: activeSnapshot.exists ? { id: activeSnapshot.id, ...activeSnapshot.data() } : {}
    };
}

async function getActiveHero() {
    const snapshot = await db().collection(HERO_COLLECTION).doc(HERO_ACTIVE_ID).get();
    if (!snapshot.exists) return null;
    const hero = snapshot.data() || {};
    const now = Date.now();
    if (hero.startsAt && new Date(hero.startsAt).getTime() > now) return null;
    if (hero.endsAt && new Date(hero.endsAt).getTime() < now) return null;
    return hero;
}

async function saveHeroDraft(body, actor) {
    const hero = normalizeHero(body);
    if (!hero.title || !hero.description || !hero.buttonLabel || !hero.buttonUrl) {
        throw new Error("Preencha título, descrição, texto e destino do botão.");
    }
    const start = hero.startsAt ? new Date(hero.startsAt).getTime() : null;
    const end = hero.endsAt ? new Date(hero.endsAt).getTime() : null;
    if ((start !== null && !Number.isFinite(start)) || (end !== null && !Number.isFinite(end))) {
        throw new Error("Informe datas válidas para a campanha.");
    }
    if (start !== null && end !== null && end < start) {
        throw new Error("A data de término deve ser posterior à data de início.");
    }
    const ref = db().collection(HERO_COLLECTION).doc(HERO_DRAFT_ID);
    const now = new Date().toISOString();
    await ref.set({ ...hero, status: "draft", updatedAt: now, updatedBy: actorName(actor) }, { merge: true });
    return { id: ref.id, ...hero, status: "draft", updatedAt: now, updatedBy: actorName(actor) };
}

async function activateHero(actor) {
    const ref = db().collection(HERO_COLLECTION).doc(HERO_DRAFT_ID);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new Error("Salve um rascunho do banner antes de publicar.");
    const now = new Date().toISOString();
    const hero = { ...snapshot.data(), status: "active", activatedAt: now, activatedBy: actorName(actor), updatedAt: now };
    await db().collection(HERO_COLLECTION).doc(HERO_ACTIVE_ID).set(hero);
    return hero;
}

async function listCampaigns() {
    const snapshot = await db().collection(CAMPAIGNS).get();
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }))
        .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
}

function normalizeFilters(value = {}) {
    return {
        minOrders: Math.max(0, Number(value.minOrders) || 0),
        minSpend: Math.max(0, Number(value.minSpend) || 0),
        minCommission: Math.max(0, Number(value.minCommission) || 0),
        inactiveDays: Math.max(0, Number(value.inactiveDays) || 0),
        activeOnly: value.activeOnly !== false
    };
}

async function previewAudience(targetType, rawFilters = {}) {
    const filters = normalizeFilters(rawFilters);
    const now = Date.now();
    if (targetType === "customers") {
        const [orderSnapshot, userSnapshot] = await Promise.all([
            db().collection("orders").get(),
            db().collection("users").get()
        ]);
        const profiles = new Map();
        for (const doc of userSnapshot.docs) {
            const user = doc.data() || {};
            const email = normalized(user.email);
            const phone = text(user.phone || user.whatsapp, 40).replace(/\D/g, "");
            const key = email ? `email:${email}` : phone ? `phone:${phone}` : `id:${doc.id}`;
            profiles.set(key, {
                id: doc.id,
                name: text(user.name || user.displayName, 160) || "Cliente",
                email,
                phone,
                orderCount: 0,
                spend: 0,
                lastActivityAt: iso(user.updatedAt || user.createdAt)
            });
        }
        for (const doc of orderSnapshot.docs) {
            const order = { id: doc.id, ...doc.data() };
            const key = customerKey(order);
            const profile = profiles.get(key) || {
                id: key,
                name: customerLabel(order),
                email: normalized(order.customer?.email || order.email),
                phone: text(order.customer?.phone || order.phone, 40),
                orderCount: 0,
                spend: 0,
                lastActivityAt: null
            };
            profile.name = profile.name === "Cliente" ? customerLabel(order) : profile.name;
            profile.orderCount += 1;
            if (paid(order)) profile.spend += money(order.total ?? order.totals?.total);
            const orderDate = iso(order.updatedAt || order.createdAt);
            if (orderDate && (!profile.lastActivityAt || orderDate > profile.lastActivityAt)) profile.lastActivityAt = orderDate;
            profiles.set(key, profile);
        }
        return [...profiles.values()].filter(profile => {
            const age = profile.lastActivityAt ? (now - new Date(profile.lastActivityAt).getTime()) / 86400000 : Infinity;
            return profile.orderCount >= filters.minOrders && profile.spend >= filters.minSpend && (!filters.inactiveDays || age >= filters.inactiveDays);
        }).map(profile => ({ ...profile, spend: Number(profile.spend.toFixed(2)) }));
    }

    if (targetType === "influencers") {
        const [influencerSnapshot, couponSnapshot, orderSnapshot, commissionSnapshot] = await Promise.all([
            db().collection("influencers").get(),
            db().collection("coupons").get(),
            db().collection("orders").get(),
            db().collection("influencerCommissions").get()
        ]);
        const influencers = influencerSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), orderCount: 0, spend: 0, commission: 0, lastActivityAt: null }));
        const byId = new Map(influencers.map(item => [item.id, item]));
        const byCoupon = new Map();
        for (const doc of couponSnapshot.docs) {
            const coupon = doc.data() || {};
            const code = normalized(coupon.code || coupon.couponCode);
            const influencerId = text(coupon.influencerId || coupon.influencer_id, 180);
            if (code && influencerId) byCoupon.set(code, influencerId);
        }
        for (const doc of orderSnapshot.docs) {
            const order = doc.data() || {};
            const coupon = typeof order.coupon === "string" ? { code: order.coupon } : order.coupon || {};
            const influencerId = text(coupon.influencerId || coupon.influencer_id, 180) || byCoupon.get(normalized(coupon.code || order.couponCode || order.coupon_code));
            const influencer = byId.get(influencerId);
            if (!influencer) continue;
            if (paid(order)) {
                influencer.orderCount += 1;
                influencer.spend += money(order.total ?? order.totals?.total);
            }
            const activity = iso(order.updatedAt || order.createdAt);
            if (activity && (!influencer.lastActivityAt || activity > influencer.lastActivityAt)) influencer.lastActivityAt = activity;
        }
        for (const doc of commissionSnapshot.docs) {
            const commission = doc.data() || {};
            const influencer = byId.get(text(commission.influencerId, 180));
            if (influencer && !["void", "voided", "cancelled", "anulada"].includes(normalized(commission.status))) influencer.commission += money(commission.amount);
        }
        return influencers.filter(item => {
            const age = item.lastActivityAt ? (now - new Date(item.lastActivityAt).getTime()) / 86400000 : Infinity;
            return (!filters.activeOnly || item.active !== false) && item.orderCount >= filters.minOrders && item.spend >= filters.minSpend && item.commission >= filters.minCommission && (!filters.inactiveDays || age >= filters.inactiveDays);
        }).map(item => ({
            id: item.id,
            name: text(item.name, 160) || "Influenciador",
            email: text(item.email, 240),
            phone: text(item.phone, 40),
            active: item.active !== false,
            orderCount: item.orderCount,
            spend: Number(item.spend.toFixed(2)),
            commission: Number(item.commission.toFixed(2)),
            lastActivityAt: item.lastActivityAt
        }));
    }
    throw new Error("Selecione clientes ou influenciadores para a campanha.");
}

async function createCampaign(body = {}, actor, canActivate = false) {
    const title = text(body.title, 120);
    const targetType = text(body.targetType, 30);
    const benefit = text(body.benefit, 240);
    const description = text(body.description, 800);
    if (!title || !benefit || !["customers", "influencers"].includes(targetType)) throw new Error("Informe o nome, o incentivo e o público da campanha.");
    const filters = normalizeFilters(body.filters);
    const audience = await previewAudience(targetType, filters);
    if (!audience.length) throw new Error("Nenhum participante corresponde a esses filtros.");
    const now = new Date().toISOString();
    const status = canActivate && body.activate === true ? "active" : "draft";
    const document = {
        title, targetType, benefit, description, filters,
        audienceCount: audience.length,
        status,
        createdAt: now,
        updatedAt: now,
        createdBy: actorName(actor),
        activatedAt: status === "active" ? now : null,
        activatedBy: status === "active" ? actorName(actor) : null,
        history: [{ type: status === "active" ? "campaign_activated" : "campaign_draft_created", at: now, actor: actorName(actor), audienceCount: audience.length }]
    };
    const ref = await db().collection(CAMPAIGNS).add(document);
    return { id: ref.id, ...document };
}

async function launchCampaign(id, actor) {
    const ref = db().collection(CAMPAIGNS).doc(text(id, 180));
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new Error("Campanha não encontrada.");
    const current = snapshot.data() || {};
    if (current.status === "active") throw new Error("Esta campanha já está ativa.");
    const audience = await previewAudience(current.targetType, current.filters);
    if (!audience.length) throw new Error("Nenhuma pessoa corresponde aos filtros atuais; a campanha não foi ativada.");
    const now = new Date().toISOString();
    const event = { type: "campaign_activated", at: now, actor: actorName(actor), audienceCount: audience.length };
    await ref.update({ status: "active", audienceCount: audience.length, activatedAt: now, activatedBy: actorName(actor), updatedAt: now, history: [...(Array.isArray(current.history) ? current.history : []), event] });
    return { id: ref.id, ...current, ...event, status: "active", audienceCount: audience.length, activatedAt: now, activatedBy: actorName(actor) };
}

module.exports = { getHeroDraft, getActiveHero, saveHeroDraft, activateHero, listCampaigns, previewAudience, createCampaign, launchCampaign };
