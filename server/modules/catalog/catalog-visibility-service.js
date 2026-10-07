"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { getFirestore } = require("../../infrastructure/firebase/firebase-admin");

const SOURCES_MANIFEST = path.resolve(
    process.cwd(),
    "data/catalog/manifests/catalog-sources.json"
);
const SETTINGS_COLLECTION = "settings";
const SETTINGS_DOCUMENT = "catalogVisibility";

function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase();
}

async function loadManagedSources() {
    const snapshot = await getFirestore().collection("catalogSuppliers").get();
    return snapshot.docs.map(document => ({ id: document.id, ...document.data(), managed: true }));
}

function loadSources() {
    const raw = fs.readFileSync(SOURCES_MANIFEST, "utf8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw);
    const sources = Array.isArray(parsed) ? parsed : parsed?.sources;
    return Array.isArray(sources) ? sources : [];
}

async function readState() {
    const db = getFirestore();
    const [settingsSnapshot, inactiveProducts, managedSources] = await Promise.all([
        db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOCUMENT).get(),
        db.collection("products").where("active", "==", false).get(),
        loadManagedSources()
    ]);

    const settings = settingsSnapshot.exists ? settingsSnapshot.data() || {} : {};
    const sourceOverrides = settings.sources || {};
    const sourceMap = new Map();
    [...loadSources(), ...managedSources].forEach(source => {
        const id = normalizeId(source.id);
        if (id) sourceMap.set(id, { ...source, id });
    });
    const sources = [...sourceMap.values()].map(source => {
        const id = normalizeId(source.id);
        return {
            id,
            name: String(source.name || source.id || "Fornecedor"),
            url: String(source.url || ""),
            file: String(source.file || ""),
            managed: source.managed === true,
            visible: typeof sourceOverrides[id] === "boolean"
                ? sourceOverrides[id]
                : source.visible !== false
        };
    });
    const inactiveProductSkus = inactiveProducts.docs
        .map(document => normalizeId(document.data()?.sku))
        .filter(Boolean);

    return { sources, inactiveProductSkus };
}

async function setSourceVisibility(id, visible, actor = "") {
    if (typeof visible !== "boolean") {
        throw new Error("Informe se o fornecedor deve ficar visível.");
    }
    const normalizedId = normalizeId(id);
    const sources = [...loadSources(), ...await loadManagedSources()];
    if (!sources.some(source => normalizeId(source.id) === normalizedId)) {
        throw new Error("Fornecedor não encontrado no catálogo.");
    }

    await getFirestore()
        .collection(SETTINGS_COLLECTION)
        .doc(SETTINGS_DOCUMENT)
        .set({
            sources: { [normalizedId]: Boolean(visible) },
            updatedAt: new Date().toISOString(),
            updatedBy: String(actor || "Administrador").slice(0, 160)
        }, { merge: true });

    return { id: normalizedId, visible: Boolean(visible) };
}

async function setProductVisibility(id, visible, actor = "") {
    if (typeof visible !== "boolean") {
        throw new Error("Informe se o produto deve ficar visível.");
    }
    const productId = String(id ?? "").trim();
    if (!productId || productId.includes("/")) {
        throw new Error("Identificador do produto inválido.");
    }

    const reference = getFirestore().collection("products").doc(productId);
    const snapshot = await reference.get();
    if (!snapshot.exists) {
        throw new Error("Produto não encontrado.");
    }

    await reference.update({
        active: Boolean(visible),
        updatedAt: new Date().toISOString(),
        visibilityUpdatedBy: String(actor || "Administrador").slice(0, 160)
    });

    return {
        id: productId,
        sku: String(snapshot.data()?.sku || ""),
        visible: Boolean(visible)
    };
}

module.exports = {
    getVisibility: readState,
    setSourceVisibility,
    setProductVisibility
};
