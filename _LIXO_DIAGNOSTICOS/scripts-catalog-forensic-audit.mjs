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
    'catalog-forensic-audit.json'
);

const SOURCES = [
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

const report = {
    generatedAt: new Date().toISOString(),
    mode: 'READ_ONLY',
    sources: {},
    braePriceAnalysis: {
        total: 0,
        normal: [],
        suspicious: [],
        verySuspicious: [],
        distribution: {}
    },
    rejectedRows: [],
    duplicateImages: [],
    normalizedProblems: [],
    manifestProblem: null,
    comparisons: {},
    conclusions: []
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
            text = text.replace(/\./g, '').replace(',', '.');
        } else {
            text = text.replace(/,/g, '');
        }
    } else if (text.includes(',')) {
        text = text.replace(',', '.');
    }

    text = text.replace(/[^\d.-]/g, '');

    const number = Number(text);

    return Number.isFinite(number) ? number : null;
}

function parseCsv(text) {
    text = text.replace(/^\uFEFF/, '');

    const lines = text
        .split(/\r?\n/)
        .filter(line => line.trim());

    if (!lines.length) {
        return {
            delimiter: null,
            headers: [],
            rows: []
        };
    }

    const headerLine = lines.shift();

    const semicolons =
        (headerLine.match(/;/g) || []).length;

    const commas =
        (headerLine.match(/,/g) || []).length;

    const tabs =
        (headerLine.match(/\t/g) || []).length;

    let delimiter = ';';

    if (commas > semicolons && commas >= tabs) {
        delimiter = ',';
    }

    if (tabs > semicolons && tabs > commas) {
        delimiter = '\t';
    }

    const headers = headerLine
        .split(delimiter)
        .map(headerKey);

    const rows = lines.map((line, index) => {
        const cells = line.split(delimiter);

        const row = {
            __line: index + 2,
            __raw: line
        };

        headers.forEach((header, position) => {
            row[header] = clean(cells[position]);
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
            Object.prototype.hasOwnProperty.call(row, key) &&
            clean(row[key])
        ) {
            return clean(row[key]);
        }
    }

    return '';
}

function mapProduct(row) {
    const sku = resolve(row, [
        'sku',
        'codigo',
        'código',
        'id',
        'productid'
    ]);

    const name = resolve(row, [
        'produto',
        'product',
        'name',
        'nome',
        'title'
    ]);

    const weight = resolve(row, [
        'peso',
        'weight',
        'volume',
        'tamanho',
        'size'
    ]);

    const priceRaw = resolve(row, [
        'preço',
        'preco',
        'price',
        'valor',
        'valor venda',
        'preço venda'
    ]);

    const category = resolve(row, [
        'categoria',
        'category',
        'categoria produto',
        'category name'
    ]);

    const stock = resolve(row, [
        'estoque',
        'stock',
        'quantidade',
        'qty',
        'saldo'
    ]);

    const description = resolve(row, [
        'descrição',
        'descricao',
        'description',
        'detalhes'
    ]);

    const image = resolve(row, [
        'imagem',
        'image',
        'foto',
        'url imagem',
        'imagem url',
        'image url',
        'url'
    ]);

    return {
        line: row.__line,
        sku,
        name,
        weight,
        priceRaw,
        price: parsePrice(priceRaw),
        category,
        stock,
        description,
        image
    };
}

function classifyRow(product, sourceId) {
    const reasons = [];

    if (!product.sku) {
        reasons.push('SKU_AUSENTE');
    }

    if (!product.name) {
        reasons.push('NOME_AUSENTE');
    }

    if (
        product.price === null ||
        product.price <= 0
    ) {
        reasons.push('PRECO_INVALIDO');
    }

    if (!product.image) {
        reasons.push('IMAGEM_AUSENTE');
    }

    const combined = [
        product.name,
        product.category,
        product.description,
        product.image
    ]
        .join(' ')
        .toLowerCase();

    const htmlMarkers = [
        '<html',
        '<div',
        '<span',
        '<script',
        'categoria-id-',
        'borda-principal',
        'menu-principal'
    ];

    if (
        htmlMarkers.some(marker =>
            combined.includes(marker)
        )
    ) {
        reasons.push('POSSIVEL_ARTEFATO_HTML');
    }

    if (
        sourceId === 'inovax' &&
        (
            product.name.toLowerCase() === 'inovax' ||
            product.image.toLowerCase().includes('logo') ||
            product.category.toLowerCase().includes('categoria-id-')
        )
    ) {
        reasons.push('POSSIVEL_LINHA_CABECALHO_INTERFACE');
    }

    return reasons;
}

function priceClass(product) {
    if (product.price === null) {
        return 'INVALIDO';
    }

    if (product.price <= 0) {
        return 'INVALIDO';
    }

    if (product.price >= 10000) {
        return 'MUITO_SUSPEITO';
    }

    if (
        product.price >= 1000 &&
        Number.isInteger(product.price)
    ) {
        return 'SUSPEITO_CENTAVOS_OU_VALOR_ALTO';
    }

    if (product.price >= 500) {
        return 'VALOR_ALTO';
    }

    return 'NORMAL';
}

function analyzeSource(source) {
    const filePath = path.join(
        SOURCE_DIR,
        source.file
    );

    const sourceReport = {
        id: source.id,
        name: source.name,
        file: source.file,
        exists: fs.existsSync(filePath),
        rows: 0,
        accepted: 0,
        rejected: 0,
        rejectedByReason: {},
        rejectedExamples: [],
        duplicateImages: [],
        productsWithoutSku: [],
        productsWithoutPrice: [],
        productsWithoutImage: [],
        productsWithoutCategory: [],
        artifacts: []
    };

    if (!sourceReport.exists) {
        return sourceReport;
    }

    const buffer = fs.readFileSync(filePath);
    const text = buffer.toString('utf8');

    const parsed = parseCsv(text);

    sourceReport.rows = parsed.rows.length;

    const imageMap = new Map();

    for (const row of parsed.rows) {
        const product = mapProduct(row);

        const reasons = classifyRow(
            product,
            source.id
        );

        if (reasons.length === 0) {
            sourceReport.accepted++;
        } else {
            sourceReport.rejected++;

            for (const reason of reasons) {
                sourceReport.rejectedByReason[reason] =
                    (sourceReport.rejectedByReason[reason] || 0) + 1;
            }

            if (sourceReport.rejectedExamples.length < 100) {
                sourceReport.rejectedExamples.push({
                    line: product.line,
                    sku: product.sku,
                    name: product.name,
                    priceRaw: product.priceRaw,
                    price: product.price,
                    category: product.category,
                    image: product.image,
                    reasons
                });
            }
        }

        if (!product.sku) {
            sourceReport.productsWithoutSku.push({
                line: product.line,
                name: product.name,
                priceRaw: product.priceRaw,
                image: product.image
            });
        }

        if (
            product.price === null ||
            product.price <= 0
        ) {
            sourceReport.productsWithoutPrice.push({
                line: product.line,
                sku: product.sku,
                name: product.name,
                priceRaw: product.priceRaw
            });
        }

        if (!product.image) {
            sourceReport.productsWithoutImage.push({
                line: product.line,
                sku: product.sku,
                name: product.name
            });
        }

        if (!product.category) {
            sourceReport.productsWithoutCategory.push({
                line: product.line,
                sku: product.sku,
                name: product.name
            });
        }

        if (
            reasons.includes('POSSIVEL_ARTEFATO_HTML') ||
            reasons.includes('POSSIVEL_LINHA_CABECALHO_INTERFACE')
        ) {
            sourceReport.artifacts.push({
                line: product.line,
                sku: product.sku,
                name: product.name,
                category: product.category,
                image: product.image,
                reasons
            });
        }

        if (product.image) {
            if (!imageMap.has(product.image)) {
                imageMap.set(product.image, []);
            }

            imageMap.get(product.image).push({
                line: product.line,
                sku: product.sku,
                name: product.name
            });
        }

        if (source.id === 'brae') {
            report.braePriceAnalysis.total++;

            const classification =
                priceClass(product);

            const item = {
                line: product.line,
                sku: product.sku,
                name: product.name,
                raw: product.priceRaw,
                numeric: product.price,
                classification
            };

            report.braePriceAnalysis.distribution[classification] =
                (report.braePriceAnalysis.distribution[classification] || 0) + 1;

            if (
                classification === 'MUITO_SUSPEITO'
            ) {
                report.braePriceAnalysis.verySuspicious.push(item);
            } else if (
                classification === 'SUSPEITO_CENTAVOS_OU_VALOR_ALTO'
            ) {
                report.braePriceAnalysis.suspicious.push(item);
            } else {
                report.braePriceAnalysis.normal.push(item);
            }
        }
    }

    for (const [image, products] of imageMap.entries()) {
        if (products.length > 1) {
            sourceReport.duplicateImages.push({
                image,
                count: products.length,
                products
            });
        }
    }

    return sourceReport;
}

function auditNormalized() {
    const result = {
        exists: fs.existsSync(NORMALIZED_FILE),
        validJson: false,
        total: 0,
        problems: []
    };

    if (!result.exists) {
        return result;
    }

    let data;

    try {
        data = JSON.parse(
            fs.readFileSync(NORMALIZED_FILE, 'utf8')
        );

        result.validJson = true;
    } catch (error) {
        result.problems.push({
            type: 'INVALID_JSON',
            message: error.message
        });

        return result;
    }

    const products =
        Array.isArray(data)
            ? data
            : Array.isArray(data.products)
                ? data.products
                : [];

    result.total = products.length;

    products.forEach((product, index) => {
        const problems = [];

        if (!clean(product.sku)) {
            problems.push('SKU_AUSENTE');
        }

        if (
            product.price === undefined ||
            product.price === null ||
            !Number.isFinite(Number(product.price)) ||
            Number(product.price) <= 0
        ) {
            problems.push('PRECO_INVALIDO');
        }

        if (!clean(product.image)) {
            problems.push('IMAGEM_AUSENTE');
        }

        if (!clean(product.name)) {
            problems.push('NOME_AUSENTE');
        }

        if (!clean(product.sourceId)) {
            problems.push('SOURCE_ID_AUSENTE');
        }

        if (problems.length) {
            result.problems.push({
                index,
                sku: product.sku || '',
                name: product.name || '',
                price: product.price,
                image: product.image || '',
                sourceId: product.sourceId || '',
                problems
            });
        }
    });

    return result;
}

function auditManifest() {
    const manifestPath = path.join(
        MANIFEST_DIR,
        'catalog-sources.json'
    );

    const result = {
        path: manifestPath,
        exists: fs.existsSync(manifestPath),
        validJson: false,
        rawPreview: '',
        parsed: null,
        error: null
    };

    if (!result.exists) {
        result.error = 'arquivo inexistente';
        return result;
    }

    const raw = fs.readFileSync(
        manifestPath,
        'utf8'
    );

    result.rawPreview =
        raw.substring(0, 1000);

    try {
        result.parsed = JSON.parse(raw);
        result.validJson = true;
    } catch (error) {
        result.error = error.message;
    }

    return result;
}

function compareCsvWithNormalized() {
    const comparison = {};

    let normalized = [];

    if (fs.existsSync(NORMALIZED_FILE)) {
        try {
            const data = JSON.parse(
                fs.readFileSync(
                    NORMALIZED_FILE,
                    'utf8'
                )
            );

            normalized =
                Array.isArray(data)
                    ? data
                    : Array.isArray(data.products)
                        ? data.products
                        : [];
        } catch {
            normalized = [];
        }
    }

    const normalizedBySource = {};

    for (const product of normalized) {
        const sourceId =
            clean(product.sourceId) || 'sem-source';

        if (!normalizedBySource[sourceId]) {
            normalizedBySource[sourceId] = [];
        }

        normalizedBySource[sourceId].push(product);
    }

    for (const source of SOURCES) {
        const sourceReport =
            report.sources[source.id];

        comparison[source.id] = {
            csvRows: sourceReport.rows,
            normalizedRows:
                normalizedBySource[source.id]?.length || 0,
            difference:
                sourceReport.rows -
                (normalizedBySource[source.id]?.length || 0)
        };
    }

    return comparison;
}

for (const source of SOURCES) {
    report.sources[source.id] =
        analyzeSource(source);
}

report.normalized =
    auditNormalized();

report.manifest =
    auditManifest();

report.comparisons =
    compareCsvWithNormalized();

for (const source of SOURCES) {
    const data = report.sources[source.id];

    if (data.rejected > 0) {
        report.conclusions.push(
            `${source.name}: ${data.rejected} linha(s) precisam de análise antes da importação.`
        );
    }

    if (data.duplicateImages.length > 0) {
        report.conclusions.push(
            `${source.name}: existem ${data.duplicateImages.length} imagem(ns) compartilhadas por múltiplos produtos; isso é alerta e não deve ser corrigido automaticamente.`
        );
    }
}

if (
    report.braePriceAnalysis.verySuspicious.length > 0 ||
    report.braePriceAnalysis.suspicious.length > 0
) {
    report.conclusions.push(
        'Braé: existem preços candidatos a representação em centavos; nenhuma conversão foi aplicada.'
    );
}

if (
    report.normalized.problems.length > 0
) {
    report.conclusions.push(
        `JSON normalizado: ${report.normalized.problems.length} produto(s)/problema(s) precisam ser rastreados até a origem.`
    );
}

if (!report.manifest.validJson) {
    report.conclusions.push(
        'Manifesto de fontes precisa ser reparado antes da próxima importação.'
    );
}

fs.mkdirSync(
    MANIFEST_DIR,
    { recursive: true }
);

fs.writeFileSync(
    REPORT_FILE,
    JSON.stringify(
        report,
        null,
        2
    ),
    'utf8'
);

console.log('');
console.log('============================================================');
console.log(' DIAGNÓSTICO FORENSE');
console.log('============================================================');
console.log('');

for (const source of SOURCES) {
    const data = report.sources[source.id];

    console.log(
        `${source.name}:`
    );

    console.log(
        `  Linhas:       ${data.rows}`
    );

    console.log(
        `  Aceitas:      ${data.accepted}`
    );

    console.log(
        `  Rejeitadas:   ${data.rejected}`
    );

    console.log(
        `  Imagens dup.: ${data.duplicateImages.length}`
    );

    console.log(
        `  Sem SKU:      ${data.productsWithoutSku.length}`
    );

    console.log(
        `  Sem preço:    ${data.productsWithoutPrice.length}`
    );

    console.log(
        `  Sem imagem:   ${data.productsWithoutImage.length}`
    );

    console.log(
        `  Artefatos:    ${data.artifacts.length}`
    );

    console.log(
        `  Motivos:`,
        data.rejectedByReason
    );

    console.log('');
}

console.log(
    '------------------------------------------------------------'
);

console.log(
    'ANÁLISE DE PREÇOS BRAÉ'
);

console.log(
    `Total: ${report.braePriceAnalysis.total}`
);

console.log(
    'Distribuição:',
    report.braePriceAnalysis.distribution
);

console.log(
    `Muito suspeitos: ${report.braePriceAnalysis.verySuspicious.length}`
);

console.log(
    `Suspeitos:       ${report.braePriceAnalysis.suspicious.length}`
);

console.log(
    `Normais:         ${report.braePriceAnalysis.normal.length}`
);

console.log('');

console.log(
    'PRIMEIROS PREÇOS MUITO SUSPEITOS:'
);

report.braePriceAnalysis.verySuspicious
    .slice(0, 30)
    .forEach(item => {
        console.log(
            `  linha=${item.line} | ` +
            `SKU=${item.sku} | ` +
            `${item.name} | ` +
            `raw=${item.raw} | ` +
            `numeric=${item.numeric}`
        );
    });

console.log('');

console.log(
    '------------------------------------------------------------'
);

console.log(
    'PROBLEMAS DO JSON NORMALIZADO'
);

console.log(
    `Total: ${report.normalized.total}`
);

console.log(
    `Problemas: ${report.normalized.problems.length}`
);

report.normalized.problems
    .slice(0, 20)
    .forEach(problem => {
        console.log(
            `  índice=${problem.index} | ` +
            `SKU=${problem.sku} | ` +
            `${problem.name} | ` +
            `${problem.problems.join(', ')}`
        );
    });

console.log('');

console.log(
    '------------------------------------------------------------'
);

console.log(
    'MANIFESTO'
);

console.log(
    `Existe: ${report.manifest.exists}`
);

console.log(
    `JSON válido: ${report.manifest.validJson}`
);

if (report.manifest.error) {
    console.log(
        `Erro: ${report.manifest.error}`
    );
}

console.log('');

console.log(
    '------------------------------------------------------------'
);

console.log(
    'CSV x NORMALIZADO'
);

for (const [sourceId, data] of Object.entries(
    report.comparisons
)) {
    console.log(
        `${sourceId}: CSV=${data.csvRows} | ` +
        `normalizado=${data.normalizedRows} | ` +
        `diferença=${data.difference}`
    );
}

console.log('');

console.log(
    '------------------------------------------------------------'
);

console.log(
    'CONCLUSÕES'
);

report.conclusions.forEach(
    conclusion =>
        console.log(`- ${conclusion}`)
);

console.log('');

console.log(
    '------------------------------------------------------------'
);

console.log(
    `RELATÓRIO COMPLETO: ${REPORT_FILE}`
);

console.log(
    'MODO: SOMENTE LEITURA'
);

console.log(
    'CSVs alterados: NÃO'
);

console.log(
    'Catálogo oficial alterado: NÃO'
);

console.log(
    'Checkout alterado: NÃO'
);

console.log(
    'PIX alterado: NÃO'
);

console.log(
    'Pedidos alterados: NÃO'
);

console.log(
    'server.js alterado: NÃO'
);

console.log('');
console.log('============================================================');
console.log(' FIM DO DIAGNÓSTICO FORENSE');
console.log('============================================================');
