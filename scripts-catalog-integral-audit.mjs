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

const REPORT_FILE = path.join(
    MANIFEST_DIR,
    'catalog-integral-audit.json'
);

const EXPECTED_SOURCES = [
    {
        id: 'brae',
        file: 'Brae.csv',
        name: 'Braé'
    },
    {
        id: 'ecobelle',
        file: 'EcoBelle.csv',
        name: 'EcoBelle'
    },
    {
        id: 'inovax',
        file: 'Inovax.csv',
        name: 'Inovax'
    }
];

const result = {
    startedAt: new Date().toISOString(),
    project: 'AUREA COSMETICS',
    scope: 'catalog-core-only',
    overall: 'PASS',
    tests: [],
    sources: {},
    global: {
        totalRows: 0,
        acceptedRows: 0,
        rejectedRows: 0,
        invalidRows: 0,
        duplicateSkus: 0,
        duplicateImages: 0,
        suspiciousPrices: 0,
        inactiveProducts: 0,
        featuredProducts: 0
    },
    protectedAreas: {
        checkout: true,
        pix: true,
        orders: true,
        server: true,
        cart: true,
        officialCatalog: true
    }
};

function addTest(name, passed, details = '') {
    result.tests.push({
        name,
        passed: Boolean(passed),
        details
    });

    if (!passed) {
        result.overall = 'FAIL';
    }
}

function normalizeHeader(value) {
    return String(value || '')
        .replace(/^\uFEFF/, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '');
}

function normalizeText(value) {
    return String(value ?? '')
        .replace(/^\uFEFF/, '')
        .trim();
}

function onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
}

function parsePrice(value) {
    const raw = normalizeText(value);

    if (!raw) {
        return null;
    }

    let text = raw
        .replace(/R\$/gi, '')
        .replace(/\s/g, '');

    if (text.includes(',') && text.includes('.')) {
        if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
            text = text.replace(/\./g, '').replace(',', '.');
        } else {
            text = text.replace(/,/g, '');
        }
    } else if (text.includes(',')) {
        text = text.replace(',', '.');
    }

    text = text.replace(/[^\d.-]/g, '');

    const number = Number(text);

    if (!Number.isFinite(number)) {
        return null;
    }

    return number;
}

function parseCsv(text) {
    const clean = text.replace(/^\uFEFF/, '');

    const firstLine = clean
        .split(/\r?\n/)
        .find(line => line.trim());

    if (!firstLine) {
        return {
            delimiter: null,
            headers: [],
            rows: []
        };
    }

    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;

    let delimiter = ';';

    if (commaCount > semicolonCount && commaCount >= tabCount) {
        delimiter = ',';
    }

    if (tabCount > semicolonCount && tabCount > commaCount) {
        delimiter = '\t';
    }

    const lines = clean
        .split(/\r?\n/)
        .filter(line => line.trim());

    const rawHeaders = lines.shift().split(delimiter);

    const headers = rawHeaders.map(header => normalizeHeader(header));

    const rows = lines.map((line, index) => {
        const cells = line.split(delimiter);

        const row = {
            __line: index + 2,
            __raw: line
        };

        headers.forEach((header, position) => {
            row[header] = normalizeText(cells[position] ?? '');
        });

        return row;
    });

    return {
        delimiter,
        headers,
        rows
    };
}

function resolveField(row, aliases) {
    for (const alias of aliases) {
        const key = normalizeHeader(alias);

        if (
            Object.prototype.hasOwnProperty.call(row, key) &&
            normalizeText(row[key])
        ) {
            return normalizeText(row[key]);
        }
    }

    return '';
}

function mapProduct(row) {
    const sku = resolveField(row, [
        'sku',
        'codigo',
        'código',
        'id',
        'productid',
        'codigo produto',
        'código produto'
    ]);

    const name = resolveField(row, [
        'produto',
        'product',
        'name',
        'nome',
        'nome produto',
        'descrição curta',
        'descricao curta',
        'title'
    ]);

    const weight = resolveField(row, [
        'peso',
        'weight',
        'volume',
        'tamanho',
        'size'
    ]);

    const priceRaw = resolveField(row, [
        'preço',
        'preco',
        'price',
        'valor',
        'valor venda',
        'preço venda'
    ]);

    const category = resolveField(row, [
        'categoria',
        'category',
        'categoria produto',
        'category name'
    ]);

    const stock = resolveField(row, [
        'estoque',
        'stock',
        'quantidade',
        'qty',
        'saldo'
    ]);

    const description = resolveField(row, [
        'descrição',
        'descricao',
        'description',
        'detalhes'
    ]);

    const image = resolveField(row, [
        'imagem',
        'image',
        'foto',
        'url imagem',
        'imagem url',
        'image url',
        'url'
    ]);

    const price = parsePrice(priceRaw);

    return {
        line: row.__line,
        sku,
        name,
        weight,
        priceRaw,
        price,
        category,
        stock,
        description,
        image
    };
}

function isLikelyHtmlArtifact(product) {
    const combined = [
        product.name,
        product.category,
        product.description,
        product.image
    ]
        .join(' ')
        .toLowerCase();

    const markers = [
        '<html',
        '<div',
        '<span',
        '<script',
        'categoria-id-',
        'borda-principal',
        'menu-principal',
        'logo',
        'favicon'
    ];

    return markers.some(marker => combined.includes(marker));
}

function validateImage(image) {
    if (!image) {
        return {
            valid: false,
            reason: 'imagem ausente'
        };
    }

    const value = image.toLowerCase();

    if (
        value.startsWith('http://') ||
        value.startsWith('https://') ||
        value.startsWith('/') ||
        value.startsWith('./')
    ) {
        return {
            valid: true,
            reason: ''
        };
    }

    return {
        valid: false,
        reason: 'formato de imagem não reconhecido'
    };
}

function inspectPrice(product, sourceId) {
    if (product.price === null) {
        return {
            suspicious: true,
            reason: 'preço ausente ou inválido'
        };
    }

    if (product.price <= 0) {
        return {
            suspicious: true,
            reason: 'preço menor ou igual a zero'
        };
    }

    if (sourceId === 'brae') {
        if (
            product.price >= 1000 &&
            Number.isInteger(product.price)
        ) {
            return {
                suspicious: true,
                reason: 'valor inteiro elevado possivelmente representado em centavos'
            };
        }
    }

    return {
        suspicious: false,
        reason: ''
    };
}

function validateProduct(product, sourceId) {
    const errors = [];
    const warnings = [];

    if (!product.sku) {
        errors.push('SKU ausente');
    }

    if (!product.name) {
        errors.push('nome ausente');
    }

    if (product.price === null) {
        errors.push('preço inválido');
    }

    if (product.price !== null && product.price <= 0) {
        errors.push('preço inválido <= 0');
    }

    const imageValidation = validateImage(product.image);

    if (!imageValidation.valid) {
        errors.push(imageValidation.reason);
    }

    if (!product.category) {
        warnings.push('categoria ausente');
    }

    if (isLikelyHtmlArtifact(product)) {
        errors.push('possível artefato HTML/interface');
    }

    const priceCheck = inspectPrice(product, sourceId);

    if (priceCheck.suspicious) {
        warnings.push(priceCheck.reason);
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

function auditSource(source) {
    const sourcePath = path.join(SOURCE_DIR, source.file);

    const sourceResult = {
        id: source.id,
        name: source.name,
        file: source.file,
        exists: false,
        encoding: 'unknown',
        delimiter: null,
        headers: [],
        totalRows: 0,
        acceptedRows: 0,
        rejectedRows: 0,
        invalidRows: 0,
        suspiciousPrices: 0,
        missingSku: 0,
        missingName: 0,
        missingPrice: 0,
        missingImage: 0,
        missingCategory: 0,
        htmlArtifacts: 0,
        duplicateSku: 0,
        duplicateImage: 0,
        priceRange: {
            min: null,
            max: null
        },
        suspiciousPriceExamples: [],
        rejectedExamples: [],
        acceptedExamples: [],
        duplicateSkuValues: [],
        duplicateImageValues: []
    };

    if (!fs.existsSync(sourcePath)) {
        addTest(
            `${source.name}: arquivo CSV existe`,
            false,
            sourcePath
        );

        return sourceResult;
    }

    sourceResult.exists = true;

    const buffer = fs.readFileSync(sourcePath);

    if (
        buffer.length >= 3 &&
        buffer[0] === 0xEF &&
        buffer[1] === 0xBB &&
        buffer[2] === 0xBF
    ) {
        sourceResult.encoding = 'utf8-bom';
    } else {
        sourceResult.encoding = 'utf8';
    }

    const text = buffer.toString('utf8');
    const parsed = parseCsv(text);

    sourceResult.delimiter = parsed.delimiter;
    sourceResult.headers = parsed.headers;
    sourceResult.totalRows = parsed.rows.length;

    const skuMap = new Map();
    const imageMap = new Map();

    const requiredHeaderGroups = {
        sku: ['sku', 'codigo', 'código', 'id'],
        name: ['produto', 'product', 'name', 'nome', 'title'],
        price: ['preço', 'preco', 'price', 'valor'],
        image: ['imagem', 'image', 'foto', 'url imagem', 'url']
    };

    for (const [field, aliases] of Object.entries(requiredHeaderGroups)) {
        const found = aliases.some(alias =>
            parsed.headers.includes(normalizeHeader(alias))
        );

        addTest(
            `${source.name}: coluna ${field}`,
            found,
            found ? 'OK' : `Nenhuma coluna compatível com ${aliases.join(', ')}`
        );
    }

    for (const row of parsed.rows) {
        result.global.totalRows++;

        const product = mapProduct(row);

        const validation = validateProduct(product, source.id);

        if (!product.sku) {
            sourceResult.missingSku++;
        }

        if (!product.name) {
            sourceResult.missingName++;
        }

        if (product.price === null) {
            sourceResult.missingPrice++;
        }

        if (!product.image) {
            sourceResult.missingImage++;
        }

        if (!product.category) {
            sourceResult.missingCategory++;
        }

        if (isLikelyHtmlArtifact(product)) {
            sourceResult.htmlArtifacts++;
        }

        if (validation.valid) {
            sourceResult.acceptedRows++;
            result.global.acceptedRows++;

            if (sourceResult.acceptedExamples.length < 5) {
                sourceResult.acceptedExamples.push(product);
            }
        } else {
            sourceResult.rejectedRows++;
            sourceResult.invalidRows++;
            result.global.rejectedRows++;
            result.global.invalidRows++;

            if (sourceResult.rejectedExamples.length < 10) {
                sourceResult.rejectedExamples.push({
                    line: product.line,
                    sku: product.sku,
                    name: product.name,
                    errors: validation.errors
                });
            }
        }

        if (validation.warnings.length) {
            const priceWarning = validation.warnings.find(
                warning => warning.includes('valor inteiro elevado')
            );

            if (priceWarning) {
                sourceResult.suspiciousPrices++;
                result.global.suspiciousPrices++;

                if (sourceResult.suspiciousPriceExamples.length < 30) {
                    sourceResult.suspiciousPriceExamples.push({
                        line: product.line,
                        sku: product.sku,
                        name: product.name,
                        raw: product.priceRaw,
                        numeric: product.price
                    });
                }
            }
        }

        if (product.price !== null && product.price > 0) {
            if (
                sourceResult.priceRange.min === null ||
                product.price < sourceResult.priceRange.min
            ) {
                sourceResult.priceRange.min = product.price;
            }

            if (
                sourceResult.priceRange.max === null ||
                product.price > sourceResult.priceRange.max
            ) {
                sourceResult.priceRange.max = product.price;
            }
        }

        if (product.sku) {
            if (!skuMap.has(product.sku)) {
                skuMap.set(product.sku, []);
            }

            skuMap.get(product.sku).push(product.line);
        }

        if (product.image) {
            if (!imageMap.has(product.image)) {
                imageMap.set(product.image, []);
            }

            imageMap.get(product.image).push(product.line);
        }
    }

    for (const [sku, lines] of skuMap.entries()) {
        if (lines.length > 1) {
            sourceResult.duplicateSku++;
            result.global.duplicateSkus++;

            sourceResult.duplicateSkuValues.push({
                sku,
                lines
            });
        }
    }

    for (const [image, lines] of imageMap.entries()) {
        if (lines.length > 1) {
            sourceResult.duplicateImage++;
            result.global.duplicateImages++;

            sourceResult.duplicateImageValues.push({
                image,
                lines
            });
        }
    }

    addTest(
        `${source.name}: UTF-8 válido`,
        sourceResult.encoding === 'utf8' ||
        sourceResult.encoding === 'utf8-bom',
        sourceResult.encoding
    );

    addTest(
        `${source.name}: delimitador encontrado`,
        Boolean(sourceResult.delimiter),
        sourceResult.delimiter || 'nenhum'
    );

    addTest(
        `${source.name}: sem SKUs duplicados`,
        sourceResult.duplicateSku === 0,
        `${sourceResult.duplicateSku} duplicidade(s)`
    );

    addTest(
        `${source.name}: sem imagens duplicadas`,
        sourceResult.duplicateImage === 0,
        `${sourceResult.duplicateImage} duplicidade(s)`
    );

    return sourceResult;
}

function auditNormalizedCatalog() {
    const audit = {
        exists: false,
        validJson: false,
        productsArray: false,
        total: 0,
        invalid: 0,
        duplicateSku: 0,
        missingFields: {
            sku: 0,
            name: 0,
            price: 0,
            image: 0,
            sourceId: 0
        },
        bySource: {}
    };

    if (!fs.existsSync(NORMALIZED_FILE)) {
        addTest(
            'JSON normalizado existe',
            false,
            NORMALIZED_FILE
        );

        return audit;
    }

    audit.exists = true;

    let data;

    try {
        data = JSON.parse(
            fs.readFileSync(NORMALIZED_FILE, 'utf8')
        );

        audit.validJson = true;
    } catch (error) {
        addTest(
            'JSON normalizado é JSON válido',
            false,
            error.message
        );

        return audit;
    }

    addTest(
        'JSON normalizado é JSON válido',
        true
    );

    const products = Array.isArray(data)
        ? data
        : Array.isArray(data.products)
            ? data.products
            : null;

    audit.productsArray = Array.isArray(products);

    addTest(
        'JSON normalizado contém lista de produtos',
        audit.productsArray,
        audit.productsArray
            ? `Produtos: ${products.length}`
            : 'Lista não encontrada'
    );

    if (!audit.productsArray) {
        return audit;
    }

    audit.total = products.length;

    const skuMap = new Map();

    for (const product of products) {
        if (!product.sku) {
            audit.missingFields.sku++;
        }

        if (!product.name) {
            audit.missingFields.name++;
        }

        if (
            product.price === undefined ||
            product.price === null ||
            Number(product.price) <= 0
        ) {
            audit.missingFields.price++;
        }

        if (!product.image) {
            audit.missingFields.image++;
        }

        if (!product.sourceId) {
            audit.missingFields.sourceId++;
        }

        if (
            !product.sku ||
            !product.name ||
            !product.image ||
            !product.sourceId ||
            !Number.isFinite(Number(product.price)) ||
            Number(product.price) <= 0
        ) {
            audit.invalid++;
        }

        const sku = String(product.sku || '').trim();

        if (sku) {
            if (!skuMap.has(sku)) {
                skuMap.set(sku, 0);
            }

            skuMap.set(sku, skuMap.get(sku) + 1);
        }

        const sourceId = String(product.sourceId || '').trim();

        if (sourceId) {
            if (!audit.bySource[sourceId]) {
                audit.bySource[sourceId] = 0;
            }

            audit.bySource[sourceId]++;
        }
    }

    for (const count of skuMap.values()) {
        if (count > 1) {
            audit.duplicateSku++;
        }
    }

    addTest(
        'JSON normalizado sem produtos inválidos',
        audit.invalid === 0,
        `${audit.invalid} inválido(s)`
    );

    addTest(
        'JSON normalizado sem SKU duplicado',
        audit.duplicateSku === 0,
        `${audit.duplicateSku} duplicidade(s)`
    );

    addTest(
        'JSON normalizado com SKUs',
        audit.missingFields.sku === 0,
        `${audit.missingFields.sku} sem SKU`
    );

    addTest(
        'JSON normalizado com nomes',
        audit.missingFields.name === 0,
        `${audit.missingFields.name} sem nome`
    );

    addTest(
        'JSON normalizado com preços válidos',
        audit.missingFields.price === 0,
        `${audit.missingFields.price} com preço inválido`
    );

    addTest(
        'JSON normalizado com imagens',
        audit.missingFields.image === 0,
        `${audit.missingFields.image} sem imagem`
    );

    addTest(
        'JSON normalizado com sourceId',
        audit.missingFields.sourceId === 0,
        `${audit.missingFields.sourceId} sem sourceId`
    );

    return audit;
}

function auditSourceManifest() {
    const manifestPath = path.join(
        MANIFEST_DIR,
        'catalog-sources.json'
    );

    if (!fs.existsSync(manifestPath)) {
        addTest(
            'Manifesto de fontes existe',
            false,
            manifestPath
        );

        return null;
    }

    let manifest;

    try {
        manifest = JSON.parse(
            fs.readFileSync(manifestPath, 'utf8')
        );
    } catch (error) {
        addTest(
            'Manifesto de fontes é JSON válido',
            false,
            error.message
        );

        return null;
    }

    addTest(
        'Manifesto de fontes é JSON válido',
        true
    );

    const sources =
        Array.isArray(manifest)
            ? manifest
            : Array.isArray(manifest.sources)
                ? manifest.sources
                : null;

    addTest(
        'Manifesto contém fontes',
        Array.isArray(sources),
        Array.isArray(sources)
            ? `${sources.length} fonte(s)`
            : 'Lista não encontrada'
    );

    if (!Array.isArray(sources)) {
        return manifest;
    }

    const ids = sources.map(source =>
        String(source.id || '').trim()
    );

    for (const expected of EXPECTED_SOURCES) {
        addTest(
            `Manifesto contém ${expected.name}`,
            ids.includes(expected.id),
            expected.id
        );
    }

    return manifest;
}

function auditProtectedFiles() {
    const protectedFiles = [
        'server.js',
        'pages/checkout.html',
        'js/checkout/checkout.js',
        'js/orders/order-repository.js',
        'js/orders/order-service.js',
        'data/catalog.json'
    ];

    for (const file of protectedFiles) {
        const exists = fs.existsSync(
            path.join(ROOT, file)
        );

        addTest(
            `Arquivo protegido existe: ${file}`,
            exists,
            exists ? 'OK' : 'AUSENTE'
        );
    }
}

for (const source of EXPECTED_SOURCES) {
    result.sources[source.id] = auditSource(source);
}

result.normalized = auditNormalizedCatalog();
result.manifest = auditSourceManifest();

auditProtectedFiles();

result.global.inactiveProducts =
    Object.values(result.sources)
        .reduce(
            (sum, source) =>
                sum + (
                    source.acceptedRows -
                    source.acceptedRows
                ),
            0
        );

fs.mkdirSync(MANIFEST_DIR, {
    recursive: true
});

fs.writeFileSync(
    REPORT_FILE,
    JSON.stringify(result, null, 2),
    'utf8'
);

result.finishedAt = new Date().toISOString();

fs.writeFileSync(
    REPORT_FILE,
    JSON.stringify(result, null, 2),
    'utf8'
);

console.log('');
console.log('============================================================');
console.log(' RESULTADO DA AUDITORIA');
console.log('============================================================');
console.log('');

for (const test of result.tests) {
    console.log(
        `${test.passed ? 'PASS' : 'FAIL'} | ${test.name}` +
        (test.details ? ` | ${test.details}` : '')
    );
}

console.log('');
console.log('------------------------------------------------------------');
console.log(' RESUMO');
console.log('------------------------------------------------------------');

console.log(
    `TOTAL DE LINHAS:       ${result.global.totalRows}`
);

console.log(
    `ACEITAS:               ${result.global.acceptedRows}`
);

console.log(
    `REJEITADAS:            ${result.global.rejectedRows}`
);

console.log(
    `SKUs DUPLICADOS:       ${result.global.duplicateSkus}`
);

console.log(
    `IMAGENS DUPLICADAS:    ${result.global.duplicateImages}`
);

console.log(
    `PREÇOS SUSPEITOS:      ${result.global.suspiciousPrices}`
);

console.log('');

for (const source of Object.values(result.sources)) {
    console.log(
        `${source.name}: ` +
        `linhas=${source.totalRows} | ` +
        `aceitas=${source.acceptedRows} | ` +
        `rejeitadas=${source.rejectedRows} | ` +
        `SKU dup=${source.duplicateSku} | ` +
        `imagem dup=${source.duplicateImage} | ` +
        `preços suspeitos=${source.suspiciousPrices}`
    );
}

console.log('');

if (result.normalized) {
    console.log(
        `NORMALIZADO: ${result.normalized.total} produto(s)`
    );

    console.log(
        `NORMALIZADO INVÁLIDOS: ${result.normalized.invalid}`
    );
}

console.log('');
console.log('------------------------------------------------------------');
console.log(
    result.overall === 'PASS'
        ? 'AUDITORIA FINAL: PASS'
        : 'AUDITORIA FINAL: FAIL'
);
console.log('------------------------------------------------------------');
console.log('');

console.log(
    `RELATÓRIO: ${REPORT_FILE}`
);

console.log('');
console.log('============================================================');

