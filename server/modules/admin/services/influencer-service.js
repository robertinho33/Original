"use strict";

const {
    getFirestore
} = require("../../../infrastructure/firebase/firebase-admin");

const COLLECTION = "influencers";

function db() {
    return getFirestore();
}

function normalizeText(value) {
    return String(value ?? "").trim();
}

function normalizeCommission(value) {
    const number = Number(value ?? 0);

    if (!Number.isFinite(number) || number < 0) {
        return 0;
    }

    if (number > 100) {
        return 100;
    }

    return number;
}

function normalizeInfluencer(data = {}) {
    const name = normalizeText(data.name);

    if (!name) {
        throw new Error(
            "Nome do influenciador é obrigatório."
        );
    }

    return {
        name,
        email: normalizeText(data.email),
        phone: normalizeText(data.phone),
        pixKey: normalizeText(data.pixKey).slice(0, 160),

        active:
            data.active !== undefined
                ? Boolean(data.active)
                : true,

        commissionDefault:
            normalizeCommission(
                data.commissionDefault ??
                data.commission ??
                0
            )
    };
}

async function listInfluencers() {
    const snapshot =
        await db()
            .collection(COLLECTION)
            .get();

    return snapshot.docs
        .map(doc => ({
            id: doc.id,
            ...doc.data()
        }))
        .sort((a, b) =>
            String(a.name || "")
                .localeCompare(
                    String(b.name || ""),
                    "pt-BR"
                )
        );
}

async function getInfluencer(id) {
    if (!id) {
        throw new Error(
            "ID do influenciador é obrigatório."
        );
    }

    const reference =
        db()
            .collection(COLLECTION)
            .doc(id);

    const snapshot =
        await reference.get();

    if (!snapshot.exists) {
        throw new Error(
            "Influenciador não encontrado."
        );
    }

    return {
        id: snapshot.id,
        ...snapshot.data()
    };
}

async function createInfluencer(data = {}) {
    const influencer =
        normalizeInfluencer(data);

    const now =
        new Date().toISOString();

    const document = {
        ...influencer,
        createdAt: now,
        updatedAt: now
    };

    const reference =
        await db()
            .collection(COLLECTION)
            .add(document);

    return {
        id: reference.id,
        ...document
    };
}

async function updateInfluencer(id, data = {}) {
    if (!id) {
        throw new Error(
            "ID do influenciador é obrigatório."
        );
    }

    const reference =
        db()
            .collection(COLLECTION)
            .doc(id);

    const snapshot =
        await reference.get();

    if (!snapshot.exists) {
        throw new Error(
            "Influenciador não encontrado."
        );
    }

    const current =
        snapshot.data() || {};

    const merged = {
        name:
            data.name !== undefined
                ? data.name
                : current.name,

        email:
            data.email !== undefined
                ? data.email
                : current.email,

        phone:
            data.phone !== undefined
                ? data.phone
                : current.phone,

        pixKey:
            data.pixKey !== undefined
                ? data.pixKey
                : current.pixKey,

        active:
            data.active !== undefined
                ? Boolean(data.active)
                : current.active !== false,

        commissionDefault:
            data.commissionDefault !== undefined ||
            data.commission !== undefined
                ? normalizeCommission(
                    data.commissionDefault ??
                    data.commission
                )
                : normalizeCommission(
                    current.commissionDefault ??
                    current.commission ??
                    0
                )
    };

    const normalized =
        normalizeInfluencer(merged);

    const updated = {
        ...normalized,
        updatedAt:
            new Date().toISOString()
    };

    await reference.update(updated);

    return {
        id,
        ...current,
        ...updated
    };
}

async function deleteInfluencer(id) {
    if (!id) {
        throw new Error(
            "ID do influenciador é obrigatório."
        );
    }

    const reference =
        db()
            .collection(COLLECTION)
            .doc(id);

    const snapshot =
        await reference.get();

    if (!snapshot.exists) {
        throw new Error(
            "Influenciador não encontrado."
        );
    }

    await reference.delete();

    return {
        id,
        deleted: true
    };
}

module.exports = {
    listInfluencers,
    getInfluencer,
    createInfluencer,
    updateInfluencer,
    deleteInfluencer
};
