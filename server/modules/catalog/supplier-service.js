"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { getFirestore } = require("../../infrastructure/firebase/firebase-admin");
const visibilityService = require("./catalog-visibility-service");
const storefrontCatalog = require("./catalog-storefront-service");

const SUPPLIERS = "catalogSuppliers";
const PRODUCTS = "products";
const IMPORT_LOGS = "catalogSupplierImports";
const MANIFEST = path.resolve(process.cwd(), "data/catalog/manifests/catalog-sources.json");
const SOURCE_DIR = path.resolve(process.cwd(), "data/catalog/sources");

function clean(value, max = 500) {
    return String(value ?? "").trim().slice(0, max);
}

function staticSources() {
    const parsed = JSON.parse(fs.readFileSync(MANIFEST, "utf8").replace(/^\uFEFF/, ""));
    return Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.sources) ? parsed.sources : []);
}

async function listSuppliers() {
    const state = await visibilityService.getVisibility();
    return state.sources.map(source => {
        const staticSource = staticSources().find(item => String(item.id).toLowerCase() === source.id);
        return {
            ...source,
            url: source.url || staticSource?.url || "",
            fileName: staticSource?.file ? path.basename(staticSource.file) : "",
            managed: !staticSource
        };
    });
}

async function createSupplier(payload, actor) {
    const id = clean(payload?.id, 48).toLowerCase();
    const name = clean(payload?.name, 120);
    const url = clean(payload?.url, 500);
    if (!/^[a-z0-9][a-z0-9-]{1,47}$/.test(id)) {
        throw new Error("Use um identificador com letras minúsculas, números e hífens.");
    }
    if (!name) throw new Error("Informe o nome do fornecedor.");
    if (url) {
        let parsed;
        try { parsed = new URL(url); } catch { throw new Error("Informe um endereço de site válido."); }
        if (!/^https?:$/.test(parsed.protocol)) throw new Error("O site deve usar HTTP ou HTTPS.");
    }
    const all = await listSuppliers();
    if (all.some(source => source.id === id)) throw new Error("Já existe um fornecedor com esse identificador.");

    const now = new Date().toISOString();
    const supplier = {
        id, name, url, enabled: true, visible: true, featured: false,
        createdAt: now, updatedAt: now, createdBy: clean(actor, 160)
    };
    await getFirestore().collection(SUPPLIERS).doc(id).create(supplier);
    storefrontCatalog.invalidate();
    return supplier;
}

function parseCsvLine(line, delimiter) {
    const fields = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (char === '"') {
            if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
            else quoted = !quoted;
        } else if (char === delimiter && !quoted) {
            fields.push(value.trim()); value = "";
        } else value += char;
    }
    fields.push(value.trim());
    if (quoted) throw new Error("O CSV contém uma aspa não fechada.");
    return fields;
}

function parseCsv(text) {
    const lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim());
    if (!lines.length) throw new Error("O arquivo CSV está vazio.");
    const candidates = [";", ",", "\t"];
    const delimiter = candidates.sort((a,b) => parseCsvLine(lines[0], b).length - parseCsvLine(lines[0], a).length)[0];
    const headers = parseCsvLine(lines[0], delimiter).map(value => value.toLowerCase().replace(/\s+/g,"_").replace(/[áàâã]/g,"a").replace(/[éê]/g,"e").replace(/[í]/g,"i").replace(/[óôõ]/g,"o").replace(/[ú]/g,"u"));
    const aliases = { sku:["sku","codigo","código","product_id"], name:["name","nome","produto"], weight:["weight","peso","volume"], price:["price","preco","preço","valor"], category:["category","categoria","linha"], stock:["stock","estoque","disponibilidade"], description:["description","descricao","descrição"], image:["image","imagem","foto"] };
    const columns = {};
    for (const [field, options] of Object.entries(aliases)) columns[field] = headers.findIndex(header => options.includes(header));
    for (const required of ["sku","name","price"]) if (columns[required] < 0) throw new Error(`Cabeçalho obrigatório ausente: ${required}.`);

    return lines.slice(1).map((line, offset) => {
        const fields = parseCsvLine(line, delimiter);
        const row = {};
        for (const [key, index] of Object.entries(columns)) row[key] = index < 0 ? "" : String(fields[index] ?? "").trim();
        row.line = offset + 2;
        return row;
    });
}

function parsePrice(value) {
    let text = clean(value, 80).replace(/R\$/gi, "").replace(/\s/g, "").replace(/[^\d,.\-]/g, "");
    if (!text) return null;
    if (text.includes(",") && text.includes(".")) {
        text = text.lastIndexOf(",") > text.lastIndexOf(".") ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
    } else if (text.includes(",")) text = text.replace(",", ".");
    const amount = Number(text);
    return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null;
}

function stockFromRow(value, previous, sameSupplier) {
    const status = clean(value, 80).toLowerCase();
    if (/^\d+(?:[.,]\d+)?$/.test(status)) return Math.max(0, Math.floor(Number(status.replace(",", "."))));
    if (["out_of_stock","out-of-stock","unavailable","esgotado","indisponivel","indisponível"].includes(status)) return 0;
    if (["in_stock","in-stock","available","disponivel","disponível",""].includes(status)) {
        return sameSupplier && Number.isFinite(Number(previous?.stock)) ? Math.max(0, Math.floor(Number(previous.stock))) : 0;
    }
    throw new Error(`Disponibilidade não reconhecida: ${status}`);
}

async function csvForSupplier(source, suppliedCsv) {
    if (typeof suppliedCsv === "string" && suppliedCsv.trim()) return suppliedCsv;
    if (!source.file) throw new Error("Selecione o arquivo CSV deste fornecedor.");
    const fileName = path.basename(source.file);
    const filePath = path.resolve(SOURCE_DIR, fileName);
    if (!filePath.startsWith(SOURCE_DIR + path.sep)) throw new Error("Arquivo de catálogo inválido.");
    return fs.readFileSync(filePath, "utf8");
}

async function importSupplierCatalog(id, suppliedCsv, actor) {
    const normalizedId = clean(id, 48).toLowerCase();
    const suppliers = await listSuppliers();
    const supplier = suppliers.find(item => item.id === normalizedId);
    if (!supplier || supplier.enabled === false) throw new Error("Fornecedor não cadastrado ou inativo.");
    const rows = parseCsv(await csvForSupplier(supplier, suppliedCsv));
    if (rows.length > 5000) throw new Error("O arquivo excede o limite de 5.000 produtos por importação.");

    const valid = [];
    const seen = new Set();
    const errors = [];
    for (const row of rows) {
        const sku = clean(row.sku, 120);
        const name = clean(row.name, 300);
        const price = parsePrice(row.price);
        if (!sku || sku.includes("/")) errors.push(`Linha ${row.line}: SKU ausente ou inválido.`);
        if (!name) errors.push(`Linha ${row.line}: nome ausente.`);
        if (price === null) errors.push(`Linha ${row.line}: preço inválido.`);
        const key = sku.toLowerCase();
        if (sku && seen.has(key)) errors.push(`Linha ${row.line}: SKU duplicado no arquivo (${sku}).`);
        seen.add(key);
        if (sku && name && price !== null) valid.push({ ...row, sku, name, price });
    }
    if (errors.length) throw new Error(errors.slice(0, 8).join(" "));
    if (!valid.length) throw new Error("O arquivo não contém produtos válidos.");

    const db = getFirestore();
    const snapshot = await db.collection(PRODUCTS).get();
    const existingBySku = new Map();
    snapshot.docs.forEach(document => {
        const product = document.data() || {};
        const sku = clean(product.sku, 120).toLowerCase();
        if (sku && !existingBySku.has(sku)) existingBySku.set(sku, { documentId: document.id, ...product });
    });

    const conflicts = valid.filter(row => {
        const existing = existingBySku.get(row.sku.toLowerCase());
        return existing && clean(existing.sourceId).toLowerCase() !== normalizedId;
    });
    if (conflicts.length) throw new Error(`SKU já pertence a outro fornecedor: ${conflicts.slice(0,5).map(row=>row.sku).join(", ")}.`);

    const now = new Date().toISOString();
    const writes = valid.map(row => {
        const existing = existingBySku.get(row.sku.toLowerCase());
        const rawStock = clean(row.stock, 80).toLowerCase();
        const availability = rawStock || "unknown";
        const stock = stockFromRow(rawStock, existing, Boolean(existing && clean(existing.sourceId).toLowerCase() === normalizedId));
        const reference = existing ? db.collection(PRODUCTS).doc(existing.documentId) : db.collection(PRODUCTS).doc(row.sku);
        return {
            reference,
            data: {
                sku: row.sku,
                name: row.name,
                weight: clean(row.weight, 80),
                price: row.price,
                category: clean(row.category, 160),
                categoryName: clean(row.category, 160),
                description: clean(row.description, 4000),
                image: clean(row.image, 2000),
                sourceId: normalizedId,
                sourceName: supplier.name,
                sourceUrl: supplier.url || "",
                supplierAvailability: availability,
                stock,
                active: true,
                featured: false,
                priority: 0,
                createdAt: existing?.createdAt || now,
                updatedAt: now,
                supplierImportedAt: now,
                supplierImportedBy: clean(actor, 160)
            },
            existed: Boolean(existing)
        };
    });

    let imported = 0;
    let updated = 0;
    for (let offset = 0; offset < writes.length; offset += 400) {
        const batch = db.batch();
        for (const write of writes.slice(offset, offset + 400)) {
            batch.set(write.reference, write.data, { merge: true });
            write.existed ? updated++ : imported++;
        }
        await batch.commit();
    }
    const unknownStock = writes.filter(write => !/^\d+(?:[.,]\d+)?$/.test(write.data.supplierAvailability) && !["out_of_stock","out-of-stock","unavailable","esgotado","indisponivel","indisponível"].includes(write.data.supplierAvailability)).length;
    try {
        await db.collection(IMPORT_LOGS).add({ supplierId: normalizedId, supplierName: supplier.name, total: writes.length, imported, updated, stockReview: unknownStock, importedBy: clean(actor,160), createdAt: now });
    } catch (error) { console.warn("[SUPPLIERS] Importação concluída, mas não foi possível gravar o log:", error?.message || error); }
    storefrontCatalog.invalidate();
    return { supplierId: normalizedId, total: writes.length, imported, updated, stockReview: unknownStock };
}

module.exports = { listSuppliers, createSupplier, importSupplierCatalog };
