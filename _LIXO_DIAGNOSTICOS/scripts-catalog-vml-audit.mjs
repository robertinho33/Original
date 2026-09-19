'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

const NORMALIZED_FILE =
    path.join(
        ROOT,
        'data',
        'catalog',
        '_staging',
        'catalog-normalized.json'
    );

const AUDIT_FILE =
    path.join(
        ROOT,
        'data',
        'catalog',
        'manifests',
        'catalog-integral-audit.json'
    );

const data =
    JSON.parse(
        fs.readFileSync(
            NORMALIZED_FILE,
            'utf8'
        )
    );

if (!Array.isArray(data.products)) {
    throw new Error(
        'catalog-normalized.json não contém products[].'
    );
}

let missingImages = 0;
let inactiveWithoutImage = 0;

for (const product of data.products) {
    const hasImage =
        String(product.image || '').trim() !== '';

    if (!hasImage) {
        missingImages++;

        /*
         * Produto sem imagem permanece preservado,
         * mas não deve aparecer para o cliente.
         */
        product.active = false;
        product.featured = false;

        inactiveWithoutImage++;
    }
}

/*
 * Duplicidade de imagem NÃO é erro estrutural.
 * Apenas contabilizamos para auditoria.
 */

const imageMap = new Map();

for (const product of data.products) {
    const image =
        String(product.image || '').trim();

    if (!image) {
        continue;
    }

    if (!imageMap.has(image)) {
        imageMap.set(image, []);
    }

    imageMap.get(image).push(product);
}

const duplicateImages = [];

for (
    const [image, products]
    of imageMap.entries()
) {
    if (products.length > 1) {
        duplicateImages.push({
            image,
            count: products.length,
            products: products.map(
                product => ({
                    sku: product.sku,
                    name: product.name,
                    sourceId: product.sourceId
                })
            )
        });
    }
}

fs.writeFileSync(
    NORMALIZED_FILE,
    JSON.stringify(
        data,
        null,
        2
    ),
    'utf8'
);

const audit = {
    generatedAt:
        new Date().toISOString(),

    status: 'PASS',

    rules: {
        duplicateImages: 'WARNING',
        missingImageActiveProduct: 'FAIL',
        missingImageInactiveProduct: 'PASS',
        duplicateSku: 'FAIL',
        invalidPrice: 'FAIL',
        missingSku: 'FAIL',
        missingName: 'FAIL',
        missingSourceId: 'FAIL'
    },

    normalized: {
        total: data.products.length,

        missingSku:
            data.products.filter(
                product =>
                    !String(
                        product.sku || ''
                    ).trim()
            ).length,

        missingName:
            data.products.filter(
                product =>
                    !String(
                        product.name || ''
                    ).trim()
            ).length,

        invalidPrice:
            data.products.filter(
                product =>
                    !Number.isFinite(
                        Number(product.price)
                    ) ||
                    Number(product.price) <= 0
            ).length,

        missingSourceId:
            data.products.filter(
                product =>
                    !String(
                        product.sourceId || ''
                    ).trim()
            ).length,

        missingImages,

        inactiveWithoutImage,

        duplicateImageGroups:
            duplicateImages.length
    },

    duplicateImages,

    productsWithoutImage:
        data.products
            .filter(
                product =>
                    !String(
                        product.image || ''
                    ).trim()
            )
            .map(
                product => ({
                    sku: product.sku,
                    name: product.name,
                    sourceId: product.sourceId,
                    active: product.active
                })
            )
};

const skuMap = new Map();

for (const product of data.products) {
    const sku =
        String(
            product.sku || ''
        ).trim();

    if (!skuMap.has(sku)) {
        skuMap.set(sku, []);
    }

    skuMap.get(sku).push(product);
}

audit.duplicateSkus = [];

for (
    const [sku, products]
    of skuMap.entries()
) {
    if (
        sku &&
        products.length > 1
    ) {
        audit.duplicateSkus.push({
            sku,
            products:
                products.map(
                    product => ({
                        name: product.name,
                        sourceId:
                            product.sourceId
                    })
                )
        });
    }
}

const failures = [];

if (audit.normalized.missingSku > 0) {
    failures.push(
        `SKU ausente: ${audit.normalized.missingSku}`
    );
}

if (audit.normalized.missingName > 0) {
    failures.push(
        `nome ausente: ${audit.normalized.missingName}`
    );
}

if (audit.normalized.invalidPrice > 0) {
    failures.push(
        `preço inválido: ${audit.normalized.invalidPrice}`
    );
}

if (audit.normalized.missingSourceId > 0) {
    failures.push(
        `sourceId ausente: ${audit.normalized.missingSourceId}`
    );
}

if (audit.duplicateSkus.length > 0) {
    failures.push(
        `SKUs duplicados: ${audit.duplicateSkus.length}`
    );
}

if (failures.length > 0) {
    audit.status = 'FAIL';
    audit.failures = failures;
} else {
    audit.failures = [];
}

fs.writeFileSync(
    AUDIT_FILE,
    JSON.stringify(
        audit,
        null,
        2
    ),
    'utf8'
);

console.log('');
console.log(
    '============================================================'
);
console.log(
    ' RESULTADO DA AUDITORIA VML-2'
);
console.log(
    '============================================================'
);
console.log('');

console.log(
    `STATUS:                 ${audit.status}`
);

console.log(
    `PRODUTOS:               ${audit.normalized.total}`
);

console.log(
    `SKUs AUSENTES:          ${audit.normalized.missingSku}`
);

console.log(
    `NOMES AUSENTES:         ${audit.normalized.missingName}`
);

console.log(
    `PREÇOS INVÁLIDOS:       ${audit.normalized.invalidPrice}`
);

console.log(
    `SOURCE IDs AUSENTES:    ${audit.normalized.missingSourceId}`
);

console.log(
    `SKUs DUPLICADOS:        ${audit.duplicateSkus.length}`
);

console.log(
    `SEM IMAGEM:             ${audit.normalized.missingImages}`
);

console.log(
    `SEM IMAGEM / INATIVOS:  ${audit.normalized.inactiveWithoutImage}`
);

console.log(
    `GRUPOS DE IMAGEM DUP.:  ${audit.normalized.duplicateImageGroups}`
);

console.log('');

if (
    duplicateImages.length
) {
    console.log(
        'WARNING | Imagens duplicadas são permitidas.'
    );

    console.log(
        `WARNING | ${duplicateImages.length} grupo(s) encontrado(s).`
    );
}

if (
    audit.normalized.missingImages
) {
    console.log(
        'INFO | Produtos sem imagem foram preservados como active=false.'
    );
}

if (audit.status === 'PASS') {
    console.log('');
    console.log(
        '============================================================'
    );
    console.log(
        ' AUDITORIA FINAL: PASS'
    );
    console.log(
        '============================================================'
    );
} else {
    console.log('');
    console.log(
        'FALHAS:'
    );

    for (
        const failure
        of audit.failures
    ) {
        console.log(
            `FAIL | ${failure}`
        );
    }

    console.log('');
    console.log(
        '============================================================'
    );
    console.log(
        ' AUDITORIA FINAL: FAIL'
    );
    console.log(
        '============================================================'
    );
}
