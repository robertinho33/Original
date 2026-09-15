'use strict';

import fs from 'node:fs';
import path from 'node:path';

const previewPath = path.resolve(
    'data/_staging/catalog-preview-block10.json'
);

const outputPath = path.resolve(
    'data/_staging/catalog-audit-block11.json'
);

function clean(value) {
    return String(value ?? '').trim();
}

function isValidProduct(product) {
    return Boolean(
        clean(product?.sku) &&
        clean(product?.name) &&
        Number(product?.price) > 0 &&
        clean(product?.image) &&
        clean(product?.sourceId) &&
        clean(product?.sourceUrl)
    );
}

function countMissing(products, field) {
    return products.filter(product => {
        if (field === 'price') {
            return !(Number(product?.price) > 0);
        }

        return !clean(product?.[field]);
    }).length;
}

function duplicateValues(products, field) {
    const groups = new Map();

    for (const product of products) {
        const value = clean(product?.[field]).toLowerCase();

        if (!value) {
            continue;
        }

        if (!groups.has(value)) {
            groups.set(value, []);
        }

        groups.get(value).push(product);
    }

    return [...groups.entries()]
        .filter(([, items]) => items.length > 1)
        .map(([value, items]) => ({
            value,
            count: items.length,
            products: items.map(product => ({
                sku: clean(product.sku),
                name: clean(product.name),
                sourceId: clean(product.sourceId),
                sourceUrl: clean(product.sourceUrl)
            }))
        }));
}

function groupBySource(products) {
    const result = {};

    for (const product of products) {
        const sourceId = clean(product?.sourceId) || 'sem-sourceId';

        if (!result[sourceId]) {
            result[sourceId] = {
                total: 0,
                valid: 0,
                invalid: 0,
                featured: 0,
                inactive: 0
            };
        }

        result[sourceId].total++;

        if (isValidProduct(product)) {
            result[sourceId].valid++;
        } else {
            result[sourceId].invalid++;
        }

        if (product?.featured === true) {
            result[sourceId].featured++;
        }

        if (product?.active === false) {
            result[sourceId].inactive++;
        }
    }

    return result;
}

if (!fs.existsSync(previewPath)) {
    console.error('');
    console.error('ERRO: Preview do Bloco 10 não encontrado.');
    console.error(`Esperado: ${previewPath}`);
    process.exit(1);
}

const raw = fs.readFileSync(previewPath, 'utf8');
const data = JSON.parse(raw);

const products = Array.isArray(data)
    ? data
    : Array.isArray(data.products)
        ? data.products
        : Array.isArray(data.catalog)
            ? data.catalog
            : [];

if (!products.length) {
    console.error('');
    console.error('ERRO: O preview existe, mas não contém produtos.');
    process.exit(1);
}

const validProducts = products.filter(isValidProduct);
const invalidProducts = products.filter(
    product => !isValidProduct(product)
);

const duplicateSkus = duplicateValues(products, 'sku');
const duplicateUrls = duplicateValues(products, 'sourceUrl');
const duplicateNames = duplicateValues(products, 'name');

const audit = {
    generatedAt: new Date().toISOString(),

    source: {
        file: 'data/_staging/catalog-preview-block10.json'
    },

    summary: {
        total: products.length,
        valid: validProducts.length,
        invalid: invalidProducts.length,
        validityRate: Number(
            ((validProducts.length / products.length) * 100).toFixed(2)
        )
    },

    bySource: groupBySource(products),

    missing: {
        sku: countMissing(products, 'sku'),
        name: countMissing(products, 'name'),
        price: countMissing(products, 'price'),
        image: countMissing(products, 'image'),
        sourceId: countMissing(products, 'sourceId'),
        sourceName: countMissing(products, 'sourceName'),
        sourceUrl: countMissing(products, 'sourceUrl')
    },

    duplicates: {
        sku: duplicateSkus,
        sourceUrl: duplicateUrls,
        name: duplicateNames
    },

    invalidProducts: invalidProducts.map(product => ({
        sku: clean(product.sku),
        name: clean(product.name),
        price: Number(product.price) || 0,
        image: clean(product.image),
        sourceId: clean(product.sourceId),
        sourceName: clean(product.sourceName),
        sourceUrl: clean(product.sourceUrl),
        active: product.active !== false,
        featured: product.featured === true,
        priority: Number(product.priority) || 0
    })),

    sample: products.slice(0, 10).map(product => ({
        sku: clean(product.sku),
        name: clean(product.name),
        price: Number(product.price) || 0,
        category: clean(product.category),
        sourceId: clean(product.sourceId),
        sourceName: clean(product.sourceName),
        sourceUrl: clean(product.sourceUrl),
        active: product.active !== false,
        featured: product.featured === true,
        priority: Number(product.priority) || 0
    }))
};

fs.mkdirSync(path.dirname(outputPath), {
    recursive: true
});

fs.writeFileSync(
    outputPath,
    JSON.stringify(audit, null, 2),
    'utf8'
);

console.log('');
console.log('============================================================');
console.log(' BLOCO 11 — AUDITORIA DO PREVIEW');
console.log('============================================================');
console.log('');

console.log(`TOTAL:             ${audit.summary.total}`);
console.log(`VÁLIDOS:           ${audit.summary.valid}`);
console.log(`INVÁLIDOS:         ${audit.summary.invalid}`);
console.log(`TAXA DE VALIDADE:  ${audit.summary.validityRate}%`);

console.log('');
console.log('---------------- PRODUTOS POR FORNECEDOR ----------------');

for (const [sourceId, stats] of Object.entries(audit.bySource)) {
    console.log(
        `${sourceId}: total=${stats.total} | válidos=${stats.valid} | inválidos=${stats.invalid} | featured=${stats.featured}`
    );
}

console.log('');
console.log('---------------- CAMPOS AUSENTES ----------------');

for (const [field, count] of Object.entries(audit.missing)) {
    console.log(`${field}: ${count}`);
}

console.log('');
console.log('---------------- DUPLICIDADES ----------------');

console.log(`SKUs duplicados:       ${duplicateSkus.length}`);
console.log(`URLs duplicadas:       ${duplicateUrls.length}`);
console.log(`Nomes duplicados:      ${duplicateNames.length}`);

console.log('');

if (invalidProducts.length) {
    console.log('---------------- PRODUTOS INVÁLIDOS ----------------');

    for (const product of audit.invalidProducts) {
        console.log(
            `- ${product.sku || '(sem SKU)'} | ${product.name || '(sem nome)'} | fonte=${product.sourceId || '(sem fonte)'}`
        );
    }

    console.log('');
}

console.log('---------------- AMOSTRA ----------------');

for (const product of audit.sample) {
    console.log(
        `${product.sourceId || '(sem fonte)'} | ${product.sku || '(sem SKU)'} | ${product.name || '(sem nome)'} | R$ ${product.price.toFixed(2)}`
    );
}

console.log('');
console.log('============================================================');
console.log(' BLOCO 11 CONCLUÍDO');
console.log('============================================================');
console.log('');
console.log(`Auditoria: ${outputPath}`);
console.log('');
console.log('CATÁLOGO OFICIAL: PRESERVADO');
console.log('CHECKOUT: PRESERVADO');
console.log('PIX: PRESERVADO');
console.log('PEDIDOS: PRESERVADOS');
console.log('SERVER.JS: PRESERVADO');
console.log('');
