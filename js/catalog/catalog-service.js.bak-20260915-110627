'use strict';

const CATALOG_PATH = 'data/produtos.csv';

/**
 * Converte preço brasileiro para nÃºmero.
 *
 * Exemplos:
 * "64,9"      -> 64.9
 * "64,90"     -> 64.9
 * "1.234,90"  -> 1234.9
 * "R$ 64,90"  -> 64.9
 */
function parsePrice(value) {
    if (value === null || value === undefined) {
        return 0;
    }

    let text = String(value).trim();

    if (!text) {
        return 0;
    }

    text = text
        .replace(/\s/g, '')
        .replace(/^R\$/i, '');

    /*
     * Formato brasileiro:
     * 1.234,56
     */
    if (text.includes(',')) {
        text = text.replace(/\./g, '').replace(',', '.');
    }

    const number = Number(text);

    return Number.isFinite(number) ? number : 0;
}

/**
 * Divide uma linha CSV respeitando campos entre aspas.
 */
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        const next = line[i + 1];

        if (char === '"' && insideQuotes && next === '"') {
            current += '"';
            i += 1;
            continue;
        }

        if (char === '"') {
            insideQuotes = !insideQuotes;
            continue;
        }

        if (char === ',' && !insideQuotes) {
            values.push(current);
            current = '';
            continue;
        }

        current += char;
    }

    values.push(current);

    return values;
}

/**
 * Divide o conteÃºdo em linhas sem quebrar campos
 * que contenham quebras de linha dentro de aspas.
 */
function parseCSV(text) {
    const rows = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        const next = text[i + 1];

        if (char === '"' && insideQuotes && next === '"') {
            current += '""';
            i += 1;
            continue;
        }

        if (char === '"') {
            insideQuotes = !insideQuotes;
            current += char;
            continue;
        }

        if ((char === '\n' || char === '\r') && !insideQuotes) {
            if (char === '\r' && next === '\n') {
                i += 1;
            }

            if (current.trim()) {
                rows.push(current);
            }

            current = '';
            continue;
        }

        current += char;
    }

    if (current.trim()) {
        rows.push(current);
    }

    if (!rows.length) {
        return [];
    }

    const headers = parseCSVLine(rows[0]).map(header =>
        header.trim().replace(/^\uFEFF/, '')
    );

    return rows.slice(1).map(line => {
        const values = parseCSVLine(line);
        const row = {};

        headers.forEach((header, index) => {
            row[header] = values[index] ?? '';
        });

        return row;
    });
}

/**
 * Normaliza um produto vindo do CSV.
 */
function normalizeProduct(row) {
    return {
        sku: String(row.SKU || '').trim(),
        name: String(row.Produto || '').trim(),
        weight: String(row.Peso || '').trim(),
        price: parsePrice(row.Preço),
        category: String(row.Categoria || '').trim(),
        stock: String(row.Estoque || '').trim(),
        description: String(row.Descrição || '').trim(),
        image: String(row.Imagem || '').trim()
    };
}

/**
 * Carrega todos os produtos.
 */
export async function loadProducts() {
    const response = await fetch(CATALOG_PATH, {
        cache: 'no-store'
    });

    if (!response.ok) {
        throw new Error(
            `Não foi possÃ­vel carregar o catálogo. HTTP ${response.status}`
        );
    }

    const text = await response.text();

    const rows = parseCSV(text);

    const products = rows
        .map(normalizeProduct)
        .filter(product => product.sku && product.name);

    return products;
}

export {
    parsePrice,
    parseCSV,
    normalizeProduct
};
