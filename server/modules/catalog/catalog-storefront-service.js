"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { getFirestore } = require("../../infrastructure/firebase/firebase-admin");
const RUNTIME_CATALOG = path.resolve(process.cwd(), "data/catalog/catalog-runtime.json");
let cache = null;
let cacheUntil = 0;

function loadRuntime() {
    const parsed = JSON.parse(fs.readFileSync(RUNTIME_CATALOG, "utf8").replace(/^\uFEFF/, ""));
    return Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.products) ? parsed.products : []);
}

async function getPublicCatalog() {
    if (cache && Date.now() < cacheUntil) return cache;
    const base = loadRuntime();
    let suppliers;
    try {
        suppliers = await getFirestore().collection("catalogSuppliers").get();
    } catch (error) {
        console.warn("[CATALOG] Catálogo dinâmico indisponível; usando catálogo publicado:", error?.message || error);
        cache = base;
        cacheUntil = Date.now() + 30000;
        return cache;
    }
    const dynamicIds = new Set(suppliers.docs.map(document => document.id.toLowerCase()));
    if (!dynamicIds.size) {
        cache = base;
        cacheUntil = Date.now() + 30000;
        return cache;
    }
    const db = getFirestore();
    const supplierIdList = [...dynamicIds];
    const productSnapshots = [];
    for (let offset = 0; offset < supplierIdList.length; offset += 30) {
        const group = supplierIdList.slice(offset, offset + 30);
        const snapshot = await db.collection("products").where("sourceId", "in", group).get();
        productSnapshots.push(...snapshot.docs);
    }
    const merged = new Map(base.map(product => [String(product.sku || "").toLowerCase(), product]));
    for (const document of productSnapshots) {
        const product = document.data() || {};
        const sku = String(product.sku || "").trim().toLowerCase();
        if (sku) merged.set(sku, { id: document.id, ...product });
    }
    cache = [...merged.values()];
    cacheUntil = Date.now() + 30000;
    return cache;
}

function invalidate() { cache = null; cacheUntil = 0; }

module.exports = { getPublicCatalog, invalidate };
