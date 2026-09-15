'use strict';

import fs from 'node:fs';
import path from 'node:path';

const sourceDir = path.resolve('data/catalog/sources');
const stagingDir = path.resolve('data/catalog/_staging');

const outputPath = path.join(
    stagingDir,
    'catalog-normalized.json'
);

const files = fs.readdirSync(sourceDir)
    .filter(file => file.toLowerCase().endsWith('.csv'))
    .sort();

if (!files.length) {
    console.error(
        'ERRO: nenhum CSV encontrado em data/catalog/sources.'
    );

    process.exit(1);
}

function detectEncoding(buffer) {
    if (
        buffer.length >= 3 &&
        buffer[0] === 0xEF &&
        buffer[1] === 0xBB &&
        buffer[2] === 0xBF
    ) {
        return 'utf8-bom';
    }

    if (
        buffer.length >= 2 &&
        buffer[0] === 0xFF &&
        buffer[1] === 0xFE
    ) {
        return 'utf16-le';
    }

    if (
        buffer.length >= 2 &&
        buffer[0] === 0xFE &&
        buffer[1] === 0xFF
    ) {
        return 'utf16-be';
    }

    return 'utf8';
}

function decodeBuffer(buffer, encoding) {
    if (encoding === 'utf16-le') {
        return buffer.toString('utf16le');
    }

    if (encoding === 'utf16-be') {
        const swapped = Buffer.alloc(buffer.length);

        for (let i = 0; i + 1 < buffer.length; i += 2) {
            swapped[i] = buffer[i + 1];
            swapped[i + 1] = buffer[i];
        }

        return swapped.toString('utf16le');
    }

    return buffer.toString('utf8');
}

function cleanText(value) {
    return String(value ?? '')
        .replace(/^\uFEFF/, '')
        .trim();
}

function normalizeKey(value) {
    return cleanText(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
}

function detectDelimiter(line) {
    const candidates = [
        {
            delimiter: ';',
            count: (line.match(/;/g) || []).length
        },
        {
            delimiter: ',',
            count: (line.match(/,/g) || []).length
        },
        {
            delimiter: '\t',
            count: (line.match(/\t/g) || []).length
        },
        {
            delimiter: '|',
            count: (line.match(/\|/g) || []).length
        }
    ];

    candidates.sort(
        (a, b) => b.count - a.count
    );

    return candidates[0].count > 0
        ? candidates[0].delimiter
        : ',';
}

function parseCsvLine(line, delimiter) {
    const values = [];
    let current = '';
    let quoted = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (
                quoted &&
                line[i + 1] === '"'
            ) {
                current += '"';
                i++;
                continue;
            }

            quoted = !quoted;
            continue;
        }

        if (
            char === delimiter &&
            !quoted
        ) {
            values.push(current);
            current = '';
            continue;
        }

        current += char;
    }

    values.push(current);

    return values;
}

function findHeaderIndex(headers, predicates) {
    for (const predicate of predicates) {
        const index = headers.findIndex(
            header => predicate(normalizeKey(header))
        );

        if (index >= 0) {
            return index;
        }
    }

    return -1;
}

function resolveColumns(headers) {
    return {
        sku: findHeaderIndex(headers, [
            key => key === 'sku',
            key => key.includes('sku'),
            key => key.includes('codigo'),
            key => key.includes('codigoproduto'),
            key => key === 'idproduto'
        ]),

        name: findHeaderIndex(headers, [
            key => key === 'nome',
            key => key === 'produto',
            key => key === 'nomeproduto',
            key => key.includes('nomedoproduto'),
            key => key.includes('productname'),
            key => key === 'name'
        ]),

        weight: findHeaderIndex(headers, [
            key => key === 'peso',
            key => key.includes('peso'),
            key => key.includes('volume'),
            key => key.includes('tamanho'),
            key => key.includes('gramatura'),
            key => key === 'weight'
        ]),

        price: findHeaderIndex(headers, [
            key => key === 'price',
            key => key === 'preco',
            key => key === 'valor',
            key => key === 'precovenda',
            key => key.includes('preco')
        ]),

        category: findHeaderIndex(headers, [
            key => key.includes('categoria'),
            key => key.includes('category'),
            key => key.includes('departamento')
        ]),

        stock: findHeaderIndex(headers, [
            key => key.includes('estoque'),
            key => key.includes('stock'),
            key => key.includes('quantidade')
        ]),

        description: findHeaderIndex(headers, [
            key => key.includes('descricao'),
            key => key.includes('description'),
            key => key.includes('detalhe')
        ]),

        image: findHeaderIndex(headers, [
            key => key.includes('imagem'),
            key => key.includes('image'),
            key => key.includes('foto'),
            key => key.includes('urlimagem')
        ])
    };
}

function parsePrice(value) {
    const raw = cleanText(value);

    if (!raw) {
        return null;
    }

    let normalized = raw
        .replace(/[R$\s]/gi, '');

    if (
        normalized.includes(',') &&
        normalized.includes('.')
    ) {
        const lastComma =
            normalized.lastIndexOf(',');

        const lastDot =
            normalized.lastIndexOf('.');

        if (lastComma > lastDot) {
            normalized = normalized
                .replace(/\./g, '')
                .replace(',', '.');
        } else {
            normalized = normalized
                .replace(/,/g, '');
        }
    } else if (normalized.includes(',')) {
        normalized = normalized.replace(
            ',',
            '.'
        );
    }

    normalized = normalized.replace(
        /[^0-9.-]/g,
        ''
    );

    const number = Number(normalized);

    return Number.isFinite(number)
        ? number
        : null;
}

function normalizeSourceName(fileName) {
    return path
        .basename(fileName, '.csv')
        .trim();
}

function looksLikeProduct(row, columns) {
    const sku =
        columns.sku >= 0
            ? cleanText(row[columns.sku])
            : '';

    const name =
        columns.name >= 0
            ? cleanText(row[columns.name])
            : '';

    const image =
        columns.image >= 0
            ? cleanText(row[columns.image])
            : '';

    const price =
        columns.price >= 0
            ? parsePrice(row[columns.price])
            : null;

    return Boolean(
        sku ||
        (
            name &&
            (
                price !== null ||
                image
            )
        )
    );
}

function isInactive(name) {
    return /^inativo\s*-/i.test(
        cleanText(name)
    );
}

function isSuspiciousPrice(price) {
    if (price === null) {
        return false;
    }

    return (
        price <= 0 ||
        price > 10000
    );
}

const products = [];
const rejectedRows = [];
const suspiciousPrices = [];
const sourceStats = [];

for (const fileName of files) {
    const filePath = path.join(
        sourceDir,
        fileName
    );

    const buffer =
        fs.readFileSync(filePath);

    const encoding =
        detectEncoding(buffer);

    const text =
        decodeBuffer(buffer, encoding)
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n');

    const lines = text
        .split('\n')
        .filter(
            line => line.trim().length > 0
        );

    if (!lines.length) {
        continue;
    }

    const delimiter =
        detectDelimiter(lines[0]);

    const headers =
        parseCsvLine(
            lines[0],
            delimiter
        ).map(cleanText);

    const columns =
        resolveColumns(headers);

    let accepted = 0;
    let rejected = 0;
    let inactiveCount = 0;
    let suspicious = 0;

    for (
        let rowIndex = 1;
        rowIndex < lines.length;
        rowIndex++
    ) {
        const values =
            parseCsvLine(
                lines[rowIndex],
                delimiter
            );

        if (
            !looksLikeProduct(
                values,
                columns
            )
        ) {
            rejected++;

            rejectedRows.push({
                source:
                    normalizeSourceName(
                        fileName
                    ),

                row:
                    rowIndex + 1,

                reason:
                    'not-a-product-row',

                values
            });

            continue;
        }

        const sku =
            columns.sku >= 0
                ? cleanText(values[columns.sku])
                : '';

        const name =
            columns.name >= 0
                ? cleanText(values[columns.name])
                : '';

        const weight =
            columns.weight >= 0
                ? cleanText(values[columns.weight])
                : '';

        const price =
            columns.price >= 0
                ? parsePrice(values[columns.price])
                : null;

        const category =
            columns.category >= 0
                ? cleanText(values[columns.category])
                : '';

        const stock =
            columns.stock >= 0
                ? cleanText(values[columns.stock])
                : '';

        const description =
            columns.description >= 0
                ? cleanText(values[columns.description])
                : '';

        const image =
            columns.image >= 0
                ? cleanText(values[columns.image])
                : '';

        const inactive =
            isInactive(name);

        const priceSuspicious =
            isSuspiciousPrice(price);

        if (inactive) {
            inactiveCount++;
        }

        if (priceSuspicious) {
            suspicious++;

            suspiciousPrices.push({
                source:
                    normalizeSourceName(
                        fileName
                    ),

                row:
                    rowIndex + 1,

                sku,
                name,

                rawPrice:
                    columns.price >= 0
                        ? cleanText(
                            values[columns.price]
                        )
                        : '',

                parsedPrice:
                    price
            });
        }

        products.push({
            sku,
            name,
            weight,
            price,
            category,
            stock,
            description,
            image,

            sourceId:
                normalizeSourceName(
                    fileName
                ).toLowerCase(),

            sourceName:
                normalizeSourceName(
                    fileName
                ),

            active: !inactive,

            featured: false,

            priority:
                inactive
                    ? 0
                    : 1
        });

        accepted++;
    }

    sourceStats.push({
        source:
            normalizeSourceName(
                fileName
            ),

        rows:
            lines.length - 1,

        accepted,
        rejected,

        inactive:
            inactiveCount,

        suspicious,

        columns: {
            sku:
                columns.sku >= 0
                    ? headers[columns.sku]
                    : null,

            name:
                columns.name >= 0
                    ? headers[columns.name]
                    : null,

            weight:
                columns.weight >= 0
                    ? headers[columns.weight]
                    : null,

            price:
                columns.price >= 0
                    ? headers[columns.price]
                    : null,

            category:
                columns.category >= 0
                    ? headers[columns.category]
                    : null,

            stock:
                columns.stock >= 0
                    ? headers[columns.stock]
                    : null,

            description:
                columns.description >= 0
                    ? headers[columns.description]
                    : null,

            image:
                columns.image >= 0
                    ? headers[columns.image]
                    : null
        }
    });
}

const skuGroups = new Map();

for (const product of products) {
    if (!product.sku) {
        continue;
    }

    const key =
        product.sku.toLowerCase();

    if (!skuGroups.has(key)) {
        skuGroups.set(key, []);
    }

    skuGroups
        .get(key)
        .push(product);
}

const duplicateSkus = [
    ...skuGroups.entries()
]
    .filter(([, values]) =>
        values.length > 1
    )
    .map(([sku, values]) => ({
        sku,
        count: values.length,

        sources: [
            ...new Set(
                values.map(
                    item => item.sourceName
                )
            )
        ]
    }));

fs.mkdirSync(
    stagingDir,
    {
        recursive: true
    }
);

const report = {
    generatedAt:
        new Date().toISOString(),

    sourceDirectory:
        'data/catalog/sources',

    stagingOutput:
        'data/catalog/_staging/catalog-normalized.json',

    totals: {
        sourceRows:
            sourceStats.reduce(
                (sum, item) =>
                    sum + item.rows,
                0
            ),

        accepted:
            products.length,

        rejected:
            rejectedRows.length,

        inactive:
            products.filter(
                item => !item.active
            ).length,

        suspiciousPrices:
            suspiciousPrices.length,

        duplicateSkus:
            duplicateSkus.length
    },

    sources:
        sourceStats,

    duplicateSkus,

    suspiciousPrices,

    rejectedRows,

    products
};

fs.mkdirSync(
    stagingDir,
    {
        recursive: true
    }
);

fs.writeFileSync(
    outputPath,
    JSON.stringify(
        report,
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
    ' BLOCO 14 — RESULTADO DA NORMALIZAÇÃO'
);
console.log(
    '============================================================'
);
console.log('');

console.log(
    `Linhas originais:     ${report.totals.sourceRows}`
);

console.log(
    `Produtos aceitos:     ${report.totals.accepted}`
);

console.log(
    `Linhas descartadas:   ${report.totals.rejected}`
);

console.log(
    `Produtos inativos:    ${report.totals.inactive}`
);

console.log(
    `Preços suspeitos:     ${report.totals.suspiciousPrices}`
);

console.log(
    `SKUs duplicados:      ${report.totals.duplicateSkus}`
);

console.log('');

for (const source of sourceStats) {
    console.log(
        `${source.source}:`
    );

    console.log(
        `  linhas:      ${source.rows}`
    );

    console.log(
        `  aceitos:     ${source.accepted}`
    );

    console.log(
        `  descartados: ${source.rejected}`
    );

    console.log(
        `  inativos:    ${source.inactive}`
    );

    console.log(
        `  suspeitos:   ${source.suspicious}`
    );

    console.log('');
}

if (suspiciousPrices.length) {
    console.log(
        'PREÇOS SUSPEITOS:'
    );

    for (
        const item of suspiciousPrices.slice(0, 20)
    ) {
        console.log(
            `  ${item.source} | linha ${item.row} | ${item.sku} | ${item.name} | ${item.rawPrice} -> ${item.parsedPrice}`
        );
    }

    console.log('');
}

if (duplicateSkus.length) {
    console.log(
        'SKUs DUPLICADOS:'
    );

    for (
        const item of duplicateSkus.slice(0, 20)
    ) {
        console.log(
            `  ${item.sku} | ${item.sources.join(', ')}`
        );
    }

    console.log('');
}

console.log(
    `STAGING: ${outputPath}`
);

console.log('');
console.log(
    '============================================================'
);
console.log(
    ' BLOCO 14 CONCLUÍDO'
);
console.log(
    '============================================================'
);
console.log('');

console.log(
    'CSV ORIGINAL: PRESERVADO'
);

console.log(
    'CATÁLOGO OFICIAL: PRESERVADO'
);

console.log(
    'CARRINHO: PRESERVADO'
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
