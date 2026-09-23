'use strict';

import {
    collection,
    getDocs,
    writeBatch,
    doc
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

import { db } from '../firebase-config.js';

const SOURCES = [
    '../data/catalog/sources/Brae.csv',
    '../data/catalog/sources/EcoBelle.csv',
    '../data/catalog/sources/Inovax.csv'
];

const COLLECTION = 'products';

const EXPECTED_HEADERS = [
    'sku',
    'name',
    'weight',
    'price',
    'category',
    'stock',
    'description',
    'image'
];

let validationResult = null;

const $ = selector => document.querySelector(selector);

function cleanText(value) {
    return String(value ?? '')
        .replace(/^\uFEFF/, '')
        .replace(/\r/g, '')
        .trim();
}

/*
 * CSV:
 *   sku;name;weight;price;category;stock;description;image
 *
 * O parser respeita aspas e separadores dentro de campos.
 */
function parseCSVLine(line, delimiter = ';') {
    const result = [];
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
            result.push(current);
            current = '';
            continue;
        }

        current += char;
    }

    result.push(current);

    return result.map(cleanText);
}

function parseCSV(text) {
    const lines = String(text || '')
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .filter(line => line.trim() !== '');

    if (!lines.length) {
        return {
            headers: [],
            rows: []
        };
    }

    const headers = parseCSVLine(lines[0]).map(header =>
        cleanText(header).toLowerCase()
    );

    const rows = [];

    for (let index = 1; index < lines.length; index++) {
        const values = parseCSVLine(lines[index]);

        const row = {};

        headers.forEach((header, columnIndex) => {
            row[header] = values[columnIndex] ?? '';
        });

        row.__line = index + 1;

        rows.push(row);
    }

    return {
        headers,
        rows
    };
}

/*
 * Converte números brasileiros e formatos mistos com segurança.
 *
 * Exemplos:
 *  "64,90"       -> 64.90
 *  "64.90"       -> 64.90
 *  "1.299,90"    -> 1299.90
 *  "1299.90"     -> 1299.90
 *  "1.299"       -> 1299
 *
 * Importante:
 * NÃO assume automaticamente que todo ponto é decimal.
 */
function parseNumber(value, options = {}) {
    const allowZero = options.allowZero !== false;

    let raw = cleanText(value);

    if (!raw) {
        return null;
    }

    raw = raw
        .replace(/R\$/gi, '')
        .replace(/\s+/g, '')
        .replace(/[^\d,.\-]/g, '');

    if (!raw) {
        return null;
    }

    const commaCount = (raw.match(/,/g) || []).length;
    const dotCount = (raw.match(/\./g) || []).length;

    /*
     * 1.234,56
     */
    if (commaCount > 0 && dotCount > 0) {
        if (raw.lastIndexOf(',') > raw.lastIndexOf('.')) {
            raw = raw.replace(/\./g, '').replace(',', '.');
        } else {
            raw = raw.replace(/,/g, '');
        }
    }

    /*
     * 1234,56
     */
    else if (commaCount > 0) {
        const parts = raw.split(',');

        if (parts.length === 2 && parts[1].length <= 2) {
            raw = parts[0] + '.' + parts[1];
        } else {
            raw = raw.replace(/,/g, '');
        }
    }

    /*
     * 1.234
     *
     * Para preço, isso pode representar 1234.
     * Para peso, veremos a unidade separadamente.
     */
    else if (dotCount > 0) {
        const parts = raw.split('.');

        if (
            parts.length === 2 &&
            parts[1].length <= 2
        ) {
            raw = parts[0] + '.' + parts[1];
        } else {
            raw = raw.replace(/\./g, '');
        }
    }

    const number = Number(raw);

    if (!Number.isFinite(number)) {
        return null;
    }

    if (!allowZero && number === 0) {
        return null;
    }

    return number;
}

/*
 * Peso:
 *
 * Aceita:
 *  500
 *  500g
 *  500 g
 *  0,5kg
 *  0.5 kg
 *  1kg
 *
 * O valor armazenado será em gramas.
 */
function parseWeight(value) {
    let raw = cleanText(value).toLowerCase();

    if (!raw) {
        return null;
    }

    raw = raw.replace(/\s+/g, '');

    const hasKg = /kg$/.test(raw);
    const hasG = /g$/.test(raw);

    raw = raw.replace(/kg$/i, '');
    raw = raw.replace(/g$/i, '');

    const number = parseNumber(raw);

    if (number === null || number < 0) {
        return null;
    }

    if (hasKg) {
        return number * 1000;
    }

    if (hasG) {
        return number;
    }

    /*
     * Sem unidade:
     * assumimos que o catálogo trabalha em gramas.
     */
    return number;
}

function parseStock(value) {
    const raw = cleanText(value);

    if (!raw) {
        return 0;
    }

    const number = parseNumber(raw);

    if (number === null || number < 0) {
        return null;
    }

    return Math.round(number);
}

function parsePrice(value, source = '') {
    if (value === null || value === undefined) {
        return null;
    }

    let text = String(value).trim();

    if (!text) {
        return null;
    }

    text = text
        .replace(/R\$/gi, '')
        .replace(/\s/g, '')
        .replace(/[^\d,.\-]/g, '');

    if (!text) {
        return null;
    }

    const lastComma = text.lastIndexOf(',');
    const lastDot = text.lastIndexOf('.');

    let normalized;

    /*
     * Formatos:
     *
     * 1.299,90  -> 1299.90
     * 1,299.90  -> 1299.90
     * 399,90    -> 399.90
     * 399.90    -> 399.90
     *
     * Para a fonte Brae existe ainda a escala observada
     * em valores como 29584.00, 29386.00, 27988.00.
     *
     * Esses valores representam centavos deslocados:
     * 29584.00 -> 295.84
     *
     * A correção é aplicada SOMENTE:
     * - fonte Brae
     * - valor >= 1000
     * - parte decimal exatamente .00
     */

    if (lastComma >= 0 && lastDot >= 0) {

        if (lastComma > lastDot) {
            normalized = text
                .replace(/\./g, '')
                .replace(',', '.');
        } else {
            normalized = text.replace(/,/g, '');
        }

    } else if (lastComma >= 0) {

        const decimalPart = text.slice(lastComma + 1);

        if (decimalPart.length <= 2) {
            normalized = text
                .replace(/\./g, '')
                .replace(',', '.');
        } else {
            normalized = text.replace(/,/g, '');
        }

    } else if (lastDot >= 0) {

        const decimalPart = text.slice(lastDot + 1);

        if (decimalPart.length <= 2) {
            normalized = text.replace(/,/g, '');
        } else {
            normalized = text.replace(/\./g, '');
        }

    } else {
        normalized = text;
    }

    let number = Number(normalized);

    if (!Number.isFinite(number)) {
        return null;
    }

    /*
     * CORREÇÃO DA ESCALA BRAE
     *
     * Não altera o CSV.
     * Atua somente durante a importação.
     */
    if (
        String(source).toLowerCase().includes('brae') &&
        number >= 1000 &&
        /\.00$/.test(text)
    ) {
        number = number / 100;
    }

    return Number(number.toFixed(2));
}

function normalizeSku(value) {
    return cleanText(value);
}

function normalizeCategory(value) {
    const category = cleanText(value);

    return category || 'Sem categoria';
}

function normalizeProduct(row, source, line) {

    /*
     * Algumas fontes possuem uma linha técnica de metadados
     * dentro do CSV, apresentada como se fosse um produto.
     *
     * Exemplo encontrado no Inovax.csv:
     * SKU vazio
     * Nome = Inovax
     * Preço vazio
     * Categoria = categoria-id-23792243 borda-principal"">
     *
     * Essa linha não representa produto comercial.
     * O CSV original permanece intocado.
     */
    const rawSku = cleanText(row.sku);
    const rawName = cleanText(row.name);
    const rawPrice = cleanText(row.price);
    const rawCategory = cleanText(row.category);

    const isSourceMetadata =
        !rawSku &&
        !rawPrice &&
        rawName &&
        (
            rawName.toLowerCase() === 'inovax' ||
            rawCategory.includes('categoria-id-23792243')
        );

    if (isSourceMetadata) {
        return {
            ok: true,
            skip: true,
            source,
            line,
            reason: 'registro de metadados da fonte'
        };
    }

    const sku = normalizeSku(row.sku);
    const name = cleanText(row.name);
    const description = cleanText(row.description);
    const image = cleanText(row.image);
    const categoryName = normalizeCategory(row.category);

    const weight = parseWeight(row.weight);
    const price = parsePrice(row.price, source);
    const stock = parseStock(row.stock);

    const errors = [];

    if (!sku) {
        errors.push('SKU ausente');
    }

    if (!name) {
        errors.push('nome ausente');
    }

    /*
     * Peso ausente não bloqueia a importação.
     * As fontes originais não fornecem esse dado
     * de forma consistente.
     */
    if (
        weight !== null &&
        (!Number.isFinite(weight) || weight < 0)
    ) {
        errors.push(`peso inválido (${JSON.stringify(row.weight)})`);
    }

    /*
     * Preço é obrigatório.
     */
    if (
        price === null ||
        !Number.isFinite(price) ||
        price < 0
    ) {
        errors.push(`preço inválido (${JSON.stringify(row.price)})`);
    }

    /*
     * Estoque desconhecido não bloqueia.
     * parseStock() converte disponibilidade textual
     * ou ausência de quantidade para 0.
     */
    if (
        stock !== null &&
        (!Number.isFinite(stock) || stock < 0)
    ) {
        errors.push(`estoque inválido (${JSON.stringify(row.stock)})`);
    }

    if (errors.length) {
        return {
            ok: false,
            source,
            line,
            errors
        };
    }

    return {
        ok: true,
        product: {
            sku,
            name,
            description,
            price,
            promotionalPrice: null,
            categoryId: '',
            categoryName,
            image,
            weight,
            active: true,
            stock,
            minimumStock: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
    };
}

async function loadSource(source) {
    const response = await fetch(source, {
        cache: 'no-store'
    });

    if (!response.ok) {
        throw new Error(
            `Falha ao carregar ${source}: HTTP ${response.status}`
        );
    }

    return response.text();
}

async function getExistingSkus() {
    const snapshot = await getDocs(collection(db, COLLECTION));

    return new Set(
        snapshot.docs.map(item => cleanText(item.data()?.sku))
    );
}

function updateMetrics(result) {
    $('#validCount').textContent = result.products.length;
    $('#errorCount').textContent = result.errors.length;
    $('#duplicateCount').textContent = result.duplicates.length;
    $('#existingCount').textContent = result.existing.length;
}

function renderPreview(products) {
    const tbody = $('#previewBody');

    tbody.innerHTML = '';

    const preview = products.slice(0, 100);

    for (const product of preview) {
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td>${escapeHTML(product.sku)}</td>
            <td>${escapeHTML(product.name)}</td>
            <td>${escapeHTML(product.categoryName)}</td>
            <td>${formatBRL(product.price)}</td>
            <td>${product.stock}</td>
        `;

        tbody.appendChild(tr);
    }
}

function renderErrors(errors) {
    const container = $('#errorList');

    if (!errors.length) {
        container.innerHTML = `
            <div class="success-message">
                Nenhum erro encontrado.
            </div>
        `;

        return;
    }

    container.innerHTML = errors
        .slice(0, 500)
        .map(error => `
            <div class="error-item">
                ${escapeHTML(error)}
            </div>
        `)
        .join('');
}

function renderDuplicates(duplicates) {
    const container = $('#duplicateList');

    if (!duplicates.length) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = duplicates
        .map(sku => `
            <div class="error-item">
                SKU duplicado: ${escapeHTML(sku)}
            </div>
        `)
        .join('');
}

function renderExisting(existing) {
    const container = $('#existingList');

    if (!existing.length) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = existing
        .map(sku => `
            <div class="warning-item">
                Já existe no Firestore: ${escapeHTML(sku)}
            </div>
        `)
        .join('');
}

function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatBRL(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

async function validateCatalog() {
    const button = $('#validateButton');

    button.disabled = true;
    button.textContent = 'Validando...';

    $('#resultMessage').textContent = 'Lendo fontes oficiais...';

    try {
        const allProducts = [];
        const errors = [];
        const skuMap = new Map();

        for (const source of SOURCES) {
            const text = await loadSource(source);
            const { headers, rows } = parseCSV(text);

            const missingHeaders = EXPECTED_HEADERS.filter(
                header => !headers.includes(header)
            );

            if (missingHeaders.length) {
                errors.push(
                    `${source}: colunas ausentes: ${missingHeaders.join(', ')}`
                );

                continue;
            }

            for (const row of rows) {
                const result = normalizeProduct(
                    row,
                    source.split('/').pop(),
                    row.__line
                );

                /*
                 * Registros de metadados da fonte são ignorados.
                 * Eles não representam produtos comerciais.
                 */
                if (result.skip) {
                    continue;
                }

                if (!result.ok) {
                    errors.push(
                        `${result.source} linha ${result.line}: ${result.errors.join('; ')}`
                    );

                    continue;
                }

                /*
                 * Proteção estrutural:
                 * um resultado válido precisa conter product.
                 */
                if (!result.product) {
                    errors.push(
                        `${result.source} linha ${result.line}: produto normalizado sem objeto product`
                    );

                    continue;
                }

                const product = result.product;

                if (!skuMap.has(product.sku)) {
                    skuMap.set(product.sku, []);
                }

                skuMap.get(product.sku).push({
                    source,
                    product
                });

                allProducts.push(product);
            }
        }

        const duplicates = [];

        for (const [sku, entries] of skuMap.entries()) {
            if (entries.length > 1) {
                duplicates.push(sku);
            }
        }

        const existingSet = await getExistingSkus();

        const existing = allProducts
            .filter(product => existingSet.has(product.sku))
            .map(product => product.sku);

        const uniqueExisting = [...new Set(existing)];

        validationResult = {
            products: allProducts,
            errors,
            duplicates,
            existing: uniqueExisting
        };

        updateMetrics(validationResult);
        renderPreview(allProducts);
        renderErrors(errors);
        renderDuplicates(duplicates);
        renderExisting(uniqueExisting);

        const blocked =
            errors.length > 0 ||
            duplicates.length > 0;

        $('#importButton').disabled = blocked;

        if (blocked) {
            $('#resultMessage').textContent =
                `Validação encontrou ${errors.length} erro(s) e ${duplicates.length} duplicidade(s). Importação bloqueada.`;
        } else {
            $('#resultMessage').textContent =
                `Validação concluída. ${allProducts.length} produto(s) pronto(s) para importação.`;
        }

    } catch (error) {
        console.error(error);

        $('#resultMessage').textContent =
            `Falha na validação: ${error.message}`;

        $('#importButton').disabled = true;

    } finally {
        button.disabled = false;
        button.textContent = 'Validar catálogo';
    }
}

async function importCatalog() {
    if (!validationResult) {
        alert('Valide o catálogo antes de importar.');
        return;
    }

    if (
        validationResult.errors.length ||
        validationResult.duplicates.length
    ) {
        alert(
            'A importação está bloqueada porque a validação encontrou inconsistências.'
        );

        return;
    }

    const confirmed = confirm(
        `Importar ${validationResult.products.length} produtos para o Firestore?`
    );

    if (!confirmed) {
        return;
    }

    const button = $('#importButton');

    button.disabled = true;
    button.textContent = 'Importando...';

    try {
        const products = validationResult.products;
        const existingSet = new Set(validationResult.existing);

        const toImport = products.filter(
            product => !existingSet.has(product.sku)
        );

        let imported = 0;

        for (let index = 0; index < toImport.length; index += 400) {
            const chunk = toImport.slice(index, index + 400);

            const batch = writeBatch(db);

            for (const product of chunk) {
                const ref = doc(collection(db, COLLECTION));

                batch.set(ref, product);

                imported++;
            }

            await batch.commit();
        }

        $('#resultMessage').textContent =
            `Importação concluída: ${imported} produto(s) gravado(s) no Firestore.`;

        alert(
            `Importação concluída com sucesso.\n\nProdutos importados: ${imported}`
        );

    } catch (error) {
        console.error(error);

        $('#resultMessage').textContent =
            `Falha na importação: ${error.message}`;

        alert(
            `Falha na importação:\n${error.message}`
        );

    } finally {
        button.disabled = false;
        button.textContent = 'Importar para Firestore';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    $('#validateButton').addEventListener(
        'click',
        validateCatalog
    );

    $('#importButton').addEventListener(
        'click',
        importCatalog
    );

    $('#importButton').disabled = true;
});