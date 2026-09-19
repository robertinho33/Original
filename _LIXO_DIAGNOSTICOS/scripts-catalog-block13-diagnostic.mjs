'use strict';

import fs from 'node:fs';
import path from 'node:path';

const sourceDir = path.resolve('data/catalog/sources');
const reportDir = path.resolve('data/catalog/manifests');
const reportPath = path.join(reportDir, 'csv-diagnostic.json');

const files = fs.readdirSync(sourceDir)
    .filter(file => file.toLowerCase().endsWith('.csv'))
    .sort();

if (!files.length) {
    console.error('ERRO: nenhum CSV encontrado em data/catalog/sources.');
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

function cleanHeader(value) {
    return String(value || '')
        .replace(/^\uFEFF/, '')
        .trim();
}

function detectDelimiter(line) {
    const candidates = [
        { delimiter: ';', count: (line.match(/;/g) || []).length },
        { delimiter: ',', count: (line.match(/,/g) || []).length },
        { delimiter: '\t', count: (line.match(/\t/g) || []).length },
        { delimiter: '|', count: (line.match(/\|/g) || []).length }
    ];

    candidates.sort((a, b) => b.count - a.count);

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
            if (quoted && line[i + 1] === '"') {
                current += '"';
                i++;
                continue;
            }

            quoted = !quoted;
            continue;
        }

        if (char === delimiter && !quoted) {
            values.push(current);
            current = '';
            continue;
        }

        current += char;
    }

    values.push(current);

    return values;
}

function normalizeKey(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
}

function classifyHeader(header) {
    const key = normalizeKey(header);

    if (
        key.includes('sku') ||
        key.includes('codigo') ||
        key.includes('codigoproduto') ||
        key === 'idproduto'
    ) {
        return 'sku';
    }

    if (
        key === 'produto' ||
        key === 'nome' ||
        key === 'nomeproduto' ||
        key.includes('productname')
    ) {
        return 'name';
    }

    if (
        key === 'preco' ||
        key === 'valor' ||
        key === 'precovenda' ||
        key === 'price'
    ) {
        return 'price';
    }

    if (
        key.includes('estoque') ||
        key.includes('stock') ||
        key.includes('quantidade')
    ) {
        return 'stock';
    }

    if (
        key.includes('categoria') ||
        key.includes('category') ||
        key.includes('departamento')
    ) {
        return 'category';
    }

    if (
        key.includes('descricao') ||
        key.includes('description') ||
        key.includes('detalhe')
    ) {
        return 'description';
    }

    if (
        key.includes('imagem') ||
        key.includes('image') ||
        key.includes('foto') ||
        key.includes('urlimagem')
    ) {
        return 'image';
    }

    if (
        key === 'peso' ||
        key.includes('peso') ||
        key.includes('volume') ||
        key.includes('tamanho')
    ) {
        return 'weight';
    }

    return 'extra';
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

function parsePrice(value) {
    const raw = String(value || '').trim();

    if (!raw) {
        return null;
    }

    let normalized = raw
        .replace(/[R$\s]/gi, '');

    if (normalized.includes(',') && normalized.includes('.')) {
        const lastComma = normalized.lastIndexOf(',');
        const lastDot = normalized.lastIndexOf('.');

        if (lastComma > lastDot) {
            normalized = normalized
                .replace(/\./g, '')
                .replace(',', '.');
        } else {
            normalized = normalized.replace(/,/g, '');
        }
    } else if (normalized.includes(',')) {
        normalized = normalized.replace(',', '.');
    }

    normalized = normalized.replace(/[^0-9.-]/g, '');

    const number = Number(normalized);

    return Number.isFinite(number)
        ? number
        : null;
}

const diagnostics = [];

for (const fileName of files) {
    const filePath = path.join(sourceDir, fileName);
    const buffer = fs.readFileSync(filePath);

    const encoding = detectEncoding(buffer);
    const text = decodeBuffer(buffer, encoding)
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');

    const lines = text
        .split('\n')
        .filter(line => line.trim().length > 0);

    if (!lines.length) {
        diagnostics.push({
            file: fileName,
            encoding,
            delimiter: null,
            columns: [],
            totalRows: 0,
            empty: true
        });

        continue;
    }

    const delimiter = detectDelimiter(lines[0]);

    const headers = parseCsvLine(lines[0], delimiter)
        .map(cleanHeader);

    const rows = lines
        .slice(1)
        .map(line => parseCsvLine(line, delimiter));

    const headerMap = headers.map(header => ({
        original: header,
        normalized: normalizeKey(header),
        role: classifyHeader(header)
    }));

    const roleSummary = {
        sku: [],
        name: [],
        price: [],
        stock: [],
        category: [],
        description: [],
        image: [],
        weight: [],
        extra: []
    };

    for (const item of headerMap) {
        roleSummary[item.role].push(item.original);
    }

    const samples = rows
        .slice(0, 5)
        .map(values => {
            const row = {};

            headers.forEach((header, index) => {
                row[header || `column_${index + 1}`] =
                    String(values[index] ?? '').trim();
            });

            return row;
        });

    const priceHeaders = roleSummary.price;

    let priceStats = null;

    if (priceHeaders.length) {
        const priceHeader = priceHeaders[0];
        const priceIndex = headers.indexOf(priceHeader);

        const prices = rows
            .map(row => parsePrice(row[priceIndex]))
            .filter(value => value !== null);

        if (prices.length) {
            priceStats = {
                field: priceHeader,
                validValues: prices.length,
                min: Math.min(...prices),
                max: Math.max(...prices)
            };
        }
    }

    const duplicateCandidates = {};

    for (const role of ['sku', 'name']) {
        const header = roleSummary[role][0];

        if (!header) {
            duplicateCandidates[role] = [];
            continue;
        }

        const index = headers.indexOf(header);
        const groups = new Map();

        for (const row of rows) {
            const value = String(row[index] ?? '').trim();

            if (!value) {
                continue;
            }

            const key = value.toLowerCase();

            if (!groups.has(key)) {
                groups.set(key, 0);
            }

            groups.set(key, groups.get(key) + 1);
        }

        duplicateCandidates[role] = [...groups.entries()]
            .filter(([, count]) => count > 1)
            .map(([value, count]) => ({
                value,
                count
            }))
            .slice(0, 20);
    }

    diagnostics.push({
        file: fileName,
        encoding,
        delimiter:
            delimiter === '\t'
                ? 'TAB'
                : delimiter,

        totalRows: rows.length,

        columnCount: headers.length,

        columns: headerMap,

        mappedFields: roleSummary,

        priceStats,

        duplicateCandidates,

        samples
    });
}

fs.mkdirSync(reportDir, {
    recursive: true
});

fs.writeFileSync(
    reportPath,
    JSON.stringify(
        {
            generatedAt: new Date().toISOString(),
            sourceDirectory: 'data/catalog/sources',
            files: diagnostics
        },
        null,
        2
    ),
    'utf8'
);

console.log('');
console.log('============================================================');
console.log(' BLOCO 13 — DIAGNÓSTICO DOS CSVs');
console.log('============================================================');
console.log('');

for (const item of diagnostics) {
    console.log(`ARQUIVO: ${item.file}`);
    console.log(`Codificação: ${item.encoding}`);
    console.log(`Delimitador: ${item.delimiter}`);
    console.log(`Linhas de produtos: ${item.totalRows}`);
    console.log(`Colunas: ${item.columnCount}`);

    console.log('');
    console.log('Mapeamento detectado:');

    for (const [role, fields] of Object.entries(item.mappedFields)) {
        if (fields.length) {
            console.log(
                `  ${role.padEnd(12)} -> ${fields.join(', ')}`
            );
        }
    }

    if (item.priceStats) {
        console.log('');
        console.log(
            `Preços: ${item.priceStats.validValues} válidos | mínimo R$ ${item.priceStats.min.toFixed(2)} | máximo R$ ${item.priceStats.max.toFixed(2)}`
        );
    }

    console.log('');
    console.log('Amostra:');

    for (const sample of item.samples.slice(0, 2)) {
        console.log(
            `  ${JSON.stringify(sample)}`
        );
    }

    console.log('');
    console.log('------------------------------------------------------------');
}

console.log('');
console.log('============================================================');
console.log(' BLOCO 13 CONCLUÍDO');
console.log('============================================================');
console.log('');

console.log(`Relatório: ${reportPath}`);

console.log('');
console.log('CSV ORIGINAL: PRESERVADO');
console.log('CATÁLOGO OFICIAL: PRESERVADO');
console.log('CARRINHO: PRESERVADO');
console.log('CHECKOUT: PRESERVADO');
console.log('PIX: PRESERVADO');
console.log('PEDIDOS: PRESERVADOS');
console.log('SERVER.JS: PRESERVADO');
console.log('');
