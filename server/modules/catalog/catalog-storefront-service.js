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

async function refreshPublicCatalog() {
    if (cache && Date.now() < cacheUntil) return cache;
    const base = loadRuntime();
    // A compact stock snapshot keeps catalog browsing to one stock read per cache refresh.
    let stockAvailability = {};
    try {
        const publicStock = await getFirestore().collection('settings').doc('publicStock').get();
        stockAvailability = publicStock.exists ? (publicStock.data().stockAvailability || {}) : {};
    } catch { /* The checkout still validates against authoritative inventory. */ }
    const applyAvailability = products => products.map(product => {
        const available = stockAvailability[product.sku];
        return Number.isInteger(available) && available >= 0 ? { ...product, stock: available } : product;
    });
    let documents;
    try {
        const snapshot = await getFirestore().collection('products').get();
        documents = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    } catch (error) {
        console.warn('[CATALOG] Dados atuais indisponíveis; usando catálogo publicado.');
        cache = applyAvailability(base); cacheUntil = Date.now() + 30000; return cache;
    }
    const merged = require('./catalog-view').mergePublicProducts(base, documents);
    cache = applyAvailability(merged);
    cacheUntil = Date.now() + 30000;
    return cache;
}

let inFlight = null;
function getPublicCatalog() {
    if (cache && Date.now() < cacheUntil) return Promise.resolve(cache);
    if (inFlight) return inFlight;
    inFlight = refreshPublicCatalog().finally(() => { inFlight = null; });
    return inFlight;
}
function invalidate() { cache = null; cacheUntil = 0; }

module.exports = { getPublicCatalog, invalidate };
