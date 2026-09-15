'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

const SOURCE_DIR = path.join(
    ROOT,
    'data',
    'catalog',
    'sources'
);

const STAGING_DIR = path.join(
    ROOT,
    'data',
    'catalog',
    '_staging'
);

const MANIFEST_DIR = path.join(
    ROOT,
    'data',
    'catalog',
    'manifests'
);

const NORMALIZED_FILE = path.join(
    STAGING_DIR,
    'catalog-normalized.json'
);

const CORRECTION_REPORT = path.join(
    MANIFEST_DIR,
    'catalog-vml-correction.json'
);

const MANIFEST_FILE = path.join(
    MANIFEST_DIR,
    'catalog-sources.json'
);

const SOURCES = [
    {
        id: 'brae',
        name: 'Braé',
        file: 'Brae.csv'
    },
    {
        id: 'ecobelle',
        name: 'EcoBelle',
        file: 'EcoBelle.csv'
    },
    {
        id: 'inovax',
        name: 'Inovax',
        file: 'Inovax.csv'
    }
];

const correction = {
    startedAt: new Date().toISOString(),
    mode: 'STAGING_ONLY',
    sourceFilesModified: false,
    officialCatalogModified: false,
    checkoutModified: false,
    pixModified: false,
    ordersModified: false,
    serverModified: false,
    sources: {},
    totals: {
        csvRows: 0,
        productsGenerated: 0,
        rejectedTechnicalRows: 0,
        braePricesConverted: 0,
        braePricesPreserved: 0,
        missingImages: 0,
        duplicateImages: 0
    },
    warnings: []
};

function clean(value) {
    return String(value ?? '')
        .replace(/^\uFEFF/, '')
        .trim();
}

function headerKey(value) {
    return clean(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
}

function parsePrice(value) {
    let text = clean(value);

    if (!text) {
        return null;
    }

    text = text
        .replace(/R\$/gi, '')
        .replace(/\s/g, '');

    if (text.includes(',') && text.includes('.')) {
        if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
            text = text
                .replace(/\./g, '')
                .replace(',', '.');
        } else {
            text = text.replace(/,/g, '');
        }
    } else if (text.includes(',')) {
        text = text.replace(',', '.');
    }

    text = text.replace(/[^\d.-]/g, '');

    const number = Number(text);

    return Number.isFinite(number)
        ? number
        : null;
}

function parseCsv(text) {
    text = text.replace(/^\uFEFF/, '');

    const lines = text
        .split(/\r?\n/)
        .filter(line => line.trim());

    if (!lines.length) {
        return {
            delimiter: ';',
            headers: [],
            rows: []
        };
    }

    const headerLine = lines.shift();

    const semicolonCount =
        (headerLine.match(/;/g) || []).length;

    const commaCount =
        (headerLine.match(/,/g) || []).length;

    const tabCount =
        (headerLine.match(/\t/g) || []).length;

    let delimiter = ';';

    if (
        commaCount > semicolonCount &&
        commaCount >= tabCount
    ) {
        delimiter = ',';
    }

    if (
        tabCount > semicolonCount &&
        tabCount > commaCount
    ) {
        delimiter = '\t';
    }

    const headers = headerLine
        .split(delimiter)
        .map(headerKey);

    const rows = lines.map((line, index) => {
        const cells = line.split(delimiter);

        const row = {
            __line: index + 2
        };

        headers.forEach((header, position) => {
            row[header] =
                clean(cells[position] ?? '');
        });

        return row;
    });

    return {
        delimiter,
        headers,
        rows
    };
}

function resolve(row, aliases) {
    for (const alias of aliases) {
        const key = headerKey(alias);

        if (
            Object.prototype.hasOwnProperty.call(
                row,
                key
            ) &&
            clean(row[key])
        ) {
            return clean(row[key]);
        }
    }

    return '';
}

function mapRow(row) {
    return {
        line: row.__line,

        sku: resolve(row, [
            'sku',
            'codigo',
            'código',
            'id',
            'productid'
        ]),

        name: resolve(row, [
            'produto',
            'product',
            'name',
            'nome',
            'title'
        ]),

        weight: resolve(row, [
            'peso',
            'weight',
            'volume',
            'tamanho',
            'size'
        ]),

        priceRaw: resolve(row, [
            'preço',
            'preco',
            'price',
            'valor',
            'valor venda',
            'preço venda'
        ]),

        category: resolve(row, [
            'categoria',
            'category',
            'categoria produto',
            'category name'
        ]),

        stock: resolve(row, [
            'estoque',
            'stock',
            'quantidade',
            'qty',
            'saldo'
        ]),

        description: resolve(row, [
            'descrição',
            'descricao',
            'description',
            'detalhes'
        ]),

        image: resolve(row, [
            'imagem',
            'image',
            'foto',
            'url imagem',
            'imagem url',
            'image url',
            'url'
        ])
    };
}

function normalizeBraePrice(price) {
    if (
        price === null ||
        price <= 0
    ) {
        return {
            price,
            converted: false
        };
    }

    /*
     * Regra específica confirmada para este CSV Braé:
     *
     * valores inteiros elevados representam centavos.
     *
     * Ex.:
     * 19995 -> 199.95
     * 11495 -> 114.95
     * 14388 -> 143.88
     *
     * Valores abaixo de 1000 são preservados.
     */
    if (
        Number.isInteger(price) &&
        price >= 1000
    ) {
        return {
            price: Number(
                (price / 100).toFixed(2)
            ),
            converted: true
        };
    }

    return {
        price: Number(
            price.toFixed(2)
        ),
        converted: false
    };
}

function normalizeProduct(
    row,
    source
) {
    const rawPrice =
        parsePrice(row.priceRaw);

    let price = rawPrice;
    let converted = false;

    if (source.id === 'brae') {
        const result =
            normalizeBraePrice(rawPrice);

        price = result.price;
        converted = result.converted;
    }

    return {
        sku: row.sku,
        name: row.name,
        weight: row.weight,
        price,
        category: row.category,
        stock: row.stock,
        description: row.description,
        image: row.image,

        sourceId: source.id,
        sourceName: source.name,
        sourceUrl: '',

        active: true,
        featured: false,
        priority: 0,

        _sourceLine: row.line,
        _priceRaw: row.priceRaw,
        _priceConverted: converted
    };
}

function shouldReject(row, source) {
    /*
     * A regra é diferente para Inovax porque
     * o CSV contém uma linha de interface/cabeçalho
     * no início.
     */

    if (source.id === 'inovax') {
        /*
         * Produto real precisa possuir:
         * SKU + nome + preço válido.
         *
         * Imagem pode ser compartilhada.
         */
        const price = parsePrice(row.priceRaw);

        if (
            !row.sku ||
            !row.name ||
            price === null ||
            price <= 0
        ) {
            return true;
        }

        return false;
    }

    /*
     * Braé e EcoBelle:
     * produto real precisa de SKU,
     * nome e preço válido.
     *
     * Imagem não é obrigatória.
     */
    const price = parsePrice(row.priceRaw);

    if (
        !row.sku ||
        !row.name ||
        price === null ||
        price <= 0
    ) {
        return true;
    }

    return false;
}

function ensureDirectories() {
    fs.mkdirSync(
        STAGING_DIR,
        { recursive: true }
    );

    fs.mkdirSync(
        MANIFEST_DIR,
        { recursive: true }
    );
}

const allProducts = [];

for (const source of SOURCES) {
    const filePath =
        path.join(
            SOURCE_DIR,
            source.file
        );

    const sourceResult = {
        id: source.id,
        name: source.name,
        file: source.file,
        csvRows: 0,
        generated: 0,
        rejected: 0,
        rejectedLines: [],
        braePricesConverted: 0,
        missingImages: 0,
        imageMap: new Map()
    };

    if (!fs.existsSync(filePath)) {
        throw new Error(
            `Fonte não encontrada: ${filePath}`
        );
    }

    const text =
        fs.readFileSync(
            filePath,
            'utf8'
        );

    const parsed =
        parseCsv(text);

    sourceResult.csvRows =
        parsed.rows.length;

    correction.totals.csvRows +=
        parsed.rows.length;

    for (const rawRow of parsed.rows) {
        const row =
            mapRow(rawRow);

        if (
            shouldReject(
                row,
                source
            )
        ) {
            sourceResult.rejected++;

            correction.totals
                .rejectedTechnicalRows++;

            if (
                sourceResult.rejectedLines
                    .length < 20
            ) {
                sourceResult.rejectedLines
                    .push({
                        line: row.line,
                        sku: row.sku,
                        name: row.name,
                        price: row.priceRaw
                    });
            }

            continue;
        }

        const product =
            normalizeProduct(
                row,
                source
            );

        if (
            source.id === 'brae' &&
            product._priceConverted
        ) {
            sourceResult
                .braePricesConverted++;

            correction.totals
                .braePricesConverted++;
        }

        if (
            source.id === 'brae' &&
            !product._priceConverted
        ) {
            correction.totals
                .braePricesPreserved++;
        }

        if (!product.image) {
            sourceResult.missingImages++;

            correction.totals
                .missingImages++;
        }

        if (product.image) {
            if (
                !sourceResult.imageMap
                    .has(product.image)
            ) {
                sourceResult.imageMap
                    .set(product.image, []);
            }

            sourceResult.imageMap
                .get(product.image)
                .push({
                    line: product._sourceLine,
                    sku: product.sku,
                    name: product.name
                });
        }

        allProducts.push(product);
        sourceResult.generated++;
        correction.totals
            .productsGenerated++;
    }

    let duplicateImageCount = 0;

    for (
        const products of
        sourceResult.imageMap.values()
    ) {
        if (products.length > 1) {
            duplicateImageCount++;
        }
    }

    correction.totals
        .duplicateImages +=
        duplicateImageCount;

    correction.sources[source.id] = {
        id: source.id,
        name: source.name,
        file: source.file,
        csvRows: sourceResult.csvRows,
        generated: sourceResult.generated,
        rejected: sourceResult.rejected,
        rejectedLines:
            sourceResult.rejectedLines,
        braePricesConverted:
            sourceResult.braePricesConverted,
        missingImages:
            sourceResult.missingImages,
        duplicateImages:
            duplicateImageCount
    };
}

/*
 * Validação interna antes de gravar.
 */

const skuMap = new Map();

for (const product of allProducts) {
    const sku =
        clean(product.sku);

    if (!skuMap.has(sku)) {
        skuMap.set(sku, []);
    }

    skuMap.get(sku).push(product);
}

const duplicateSkus = [];

for (
    const [sku, products]
    of skuMap.entries()
) {
    if (products.length > 1) {
        duplicateSkus.push({
            sku,
            products: products.map(
                product => ({
                    sourceId:
                        product.sourceId,
                    line:
                        product._sourceLine,
                    name:
                        product.name
                })
            )
        });
    }
}

if (duplicateSkus.length) {
    throw new Error(
        `SKUs duplicados após normalização: ${duplicateSkus.length}`
    );
}

/*
 * Remove somente campos internos
 * antes da publicação do staging.
 */

const publicProducts =
    allProducts.map(product => {
        const {
            _sourceLine,
            _priceRaw,
            _priceConverted,
            ...cleanProduct
        } = product;

        return cleanProduct;
    });

const normalizedPayload = {
    generatedAt:
        new Date().toISOString(),

    version: 1,

    products:
        publicProducts
};

fs.writeFileSync(
    NORMALIZED_FILE,
    JSON.stringify(
        normalizedPayload,
        null,
        2
    ),
    'utf8'
);

/*
 * Manifesto oficial das fontes.
 */

const manifest = {
    version: 1,

    generatedAt:
        new Date().toISOString(),

    sources: SOURCES.map(
        source => ({
            id: source.id,
            name: source.name,
            file: source.file,
            enabled: true,
            visible: true,
            featured: true
        })
    )
};

fs.writeFileSync(
    MANIFEST_FILE,
    JSON.stringify(
        manifest,
        null,
        2
    ),
    'utf8'
);

correction.finishedAt =
    new Date().toISOString();

correction.products =
    publicProducts.length;

correction.duplicateSkus =
    duplicateSkus;

correction.warnings.push(
    'Imagens duplicadas foram preservadas.'
);

correction.warnings.push(
    'Produtos sem imagem foram preservados sem imagem.'
);

correction.warnings.push(
    'Nenhum CSV original foi alterado.'
);

correction.warnings.push(
    'Nenhum produto foi excluído por imagem duplicada.'
);

fs.writeFileSync(
    CORRECTION_REPORT,
    JSON.stringify(
        correction,
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
    ' VML — RESULTADO DA CORREÇÃO'
);
console.log(
    '============================================================'
);
console.log('');

for (
    const source of
    Object.values(correction.sources)
) {
    console.log(
        `${source.name}:`
    );

    console.log(
        `  CSV:             ${source.csvRows}`
    );

    console.log(
        `  Gerados:         ${source.generated}`
    );

    console.log(
        `  Rejeitados:      ${source.rejected}`
    );

    if (
        source.rejectedLines.length
    ) {
        console.log(
            `  Linhas rejeitadas:`
        );

        for (
            const line
            of source.rejectedLines
        ) {
            console.log(
                `    linha=${line.line} | ` +
                `SKU=${line.sku} | ` +
                `${line.name} | ` +
                `preço=${line.price}`
            );
        }
    }

    if (
        source.name === 'Braé'
    ) {
        console.log(
            `  Preços convertidos: ${source.braePricesConverted}`
        );
    }

    console.log(
        `  Sem imagem:       ${source.missingImages}`
    );

    console.log(
        `  Imagens duplicadas: ${source.duplicateImages}`
    );

    console.log('');
}

console.log(
    '------------------------------------------------------------'
);

console.log(
    `TOTAL CSV:             ${correction.totals.csvRows}`
);

console.log(
    `TOTAL PRODUTOS:        ${correction.totals.productsGenerated}`
);

console.log(
    `LINHAS TÉCNICAS:       ${correction.totals.rejectedTechnicalRows}`
);

console.log(
    `PREÇOS BRAÉ CONVERTIDOS: ${correction.totals.braePricesConverted}`
);

console.log(
    `PREÇOS BRAÉ PRESERVADOS: ${correction.totals.braePricesPreserved}`
);

console.log(
    `PRODUTOS SEM IMAGEM:   ${correction.totals.missingImages}`
);

console.log(
    `IMAGENS DUPLICADAS:    ${correction.totals.duplicateImages}`
);

console.log(
    `SKUs DUPLICADOS:       ${duplicateSkus.length}`
);

console.log('');

console.log(
    '------------------------------------------------------------'
);

console.log(
    'ARQUIVOS GERADOS'
);

console.log(
    `NORMALIZADO: ${NORMALIZED_FILE}`
);

console.log(
    `MANIFESTO:   ${MANIFEST_FILE}`
);

console.log(
    `RELATÓRIO:   ${CORRECTION_REPORT}`
);

console.log('');

console.log(
    'CSV ORIGINAL: PRESERVADO'
);

console.log(
    'CATÁLOGO OFICIAL: PRESERVADO'
);

console.log(
    'CHECKOUT: PRESERVADO'
);

console.log(
    'PIX: PRESERVADO'
);

console.log(
    'PEDIDOS: PRESERVADOS'
);

console.log(
    'SERVER.JS: PRESERVADO'
);

console.log('');

console.log(
    '============================================================'
);
console.log(
    ' VML CONCLUÍDO'
);
console.log(
    '============================================================'
);
