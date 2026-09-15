'use strict';

import {
    normalizeCatalogProducts
} from '../catalog-normalizer.js';

/**
 * Adaptador da fonte EcoBelle.
 *
 * A EcoBelle utiliza dados estruturados da Yampi
 * embutidos no HTML das páginas.
 *
 * Fluxo:
 *
 * LISTAGEM
 *   ↓
 * :product
 *   ↓
 * produtos únicos
 *   ↓
 * página individual
 *   ↓
 * enriquecimento
 *   ↓
 * contrato AURÉA
 *
 * Este módulo permanece isolado do:
 * - carrinho;
 * - checkout;
 * - PIX;
 * - pedidos;
 * - rastreamento.
 */

const ECOBELLE_PRODUCTS_URL =
    'https://www.grupoecobelle.com.br/produtos';

const MAX_CONCURRENT_REQUESTS = 4;

/**
 * Decodifica entidades HTML sem depender de DOMParser.
 *
 * Funciona tanto no navegador quanto no Node.js.
 */
function decodeHtmlEntities(value) {

    return String(value || '')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&apos;/gi, "'")
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&#(\d+);/g, (_, code) => {
            return String.fromCodePoint(
                Number(code)
            );
        })
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
            return String.fromCodePoint(
                parseInt(code, 16)
            );
        });
}

/**
 * Converte um atributo :product
 * em objeto JavaScript.
 */
function parseProductAttribute(rawValue) {

    if (!rawValue) {
        return null;
    }

    try {

        const decoded =
            decodeHtmlEntities(rawValue);

        const payload =
            JSON.parse(decoded);

        return payload?.data || payload;

    } catch {

        return null;
    }
}

/**
 * Extrai todos os atributos :product
 * existentes no HTML.
 */
export function extractProductObjects(html) {

    const source =
        String(html || '');

    const matches =
        source.matchAll(
            /:product="([^"]+)"/gi
        );

    const products = [];

    for (const match of matches) {

        const product =
            parseProductAttribute(match[1]);

        if (product?.id || product?.sku) {
            products.push(product);
        }
    }

    return products;
}

/**
 * Remove produtos duplicados.
 */
export function deduplicateProducts(
    products = []
) {

    if (!Array.isArray(products)) {
        return [];
    }

    const seen = new Set();

    return products.filter(product => {

        const key =
            product?.id ??
            product?.sku ??
            product?.url;

        if (!key) {
            return false;
        }

        const normalizedKey =
            String(key);

        if (seen.has(normalizedKey)) {
            return false;
        }

        seen.add(normalizedKey);

        return true;
    });
}

/**
 * Extrai o primeiro SKU disponível.
 */
function getPrimarySku(product) {

    return product?.skus?.data?.[0] || null;
}

/**
 * Extrai o preço comercial.
 *
 * O preço PIX da EcoBelle NÃO é usado.
 */
function getPrice(product) {

    const sku =
        getPrimarySku(product);

    return (
        sku?.price_sale ??
        sku?.prices?.data?.price_sale ??
        product?.prices?.data?.price_sale ??
        0
    );
}

/**
 * Extrai estoque real.
 */
function getStock(product) {

    const sku =
        getPrimarySku(product);

    return (
        sku?.total_in_stock ??
        product?.extras?.data?.total_in_stock ??
        ''
    );
}

/**
 * Extrai categoria comercial.
 *
 * "Produtos" é uma categoria técnica.
 */
function getCategory(product) {

    const categories =
        Array.isArray(product?.categories?.data)
            ? product.categories.data
            : [];

    const category =
        categories.find(item =>
            item?.name &&
            String(item.name)
                .trim()
                .toLowerCase() !== 'produtos'
        );

    return String(
        category?.name ||
        categories[0]?.name ||
        ''
    ).trim();
}

/**
 * Remove HTML da descrição.
 */
function stripHtml(value) {

    return decodeHtmlEntities(
        String(value || '')
            .replace(/<br\s*\/?>/gi, ' ')
            .replace(/<\/p>/gi, ' ')
            .replace(/<\/div>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
    )
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Extrai descrição.
 */
function getDescription(product) {

    return stripHtml(
        product?.texts?.data?.description || ''
    );
}

/**
 * Extrai imagem principal.
 */
function getImage(product) {

    return String(
        product?.images?.data?.[0]?.url ||
        ''
    ).trim();
}

/**
 * Extrai peso somente quando a fonte
 * disponibiliza essa informação.
 */
function getWeight(product) {

    const metadata =
        product?.metadata?.data;

    if (
        metadata &&
        typeof metadata === 'object'
    ) {

        for (const key of [
            'weight',
            'peso',
            'product_weight'
        ]) {

            if (metadata[key]) {
                return String(
                    metadata[key]
                ).trim();
            }
        }
    }

    return '';
}

/**
 * Converte um produto EcoBelle
 * para o contrato interno da AURÉA.
 */
export function mapEcoBelleProduct(
    product = {}
) {

    return {

        sku: String(
            product?.sku ||
            getPrimarySku(product)?.sku ||
            ''
        ).trim(),

        name: String(
            product?.name ||
            getPrimarySku(product)?.title ||
            ''
        ).trim(),

        weight:
            getWeight(product),

        price:
            getPrice(product),

        category:
            getCategory(product),

        stock:
            String(
                getStock(product)
            ).trim(),

        description:
            getDescription(product),

        image:
            getImage(product)
    };
}

/**
 * Extrai o primeiro objeto de produto
 * encontrado em uma página individual.
 */
function extractSingleProduct(html) {

    const products =
        extractProductObjects(html);

    return products[0] || null;
}

/**
 * Carrega os dados completos da página
 * individual de um produto.
 */
async function loadProductDetails(
    product
) {

    const url =
        String(product?.url || '')
            .trim();

    if (!url) {
        throw new Error(
            'Produto sem URL individual.'
        );
    }

    const response =
        await fetch(
            url,
            {
                method: 'GET',
                cache: 'no-store',
                headers: {
                    Accept: 'text/html'
                }
            }
        );

    if (!response.ok) {
        throw new Error(
            `HTTP ${response.status}`
        );
    }

    const html =
        await response.text();

    const detailedProduct =
        extractSingleProduct(html);

    if (!detailedProduct) {
        throw new Error(
            'Dados do produto não encontrados.'
        );
    }

    return detailedProduct;
}

/**
 * Enriquece um produto da listagem
 * com os dados da página individual.
 */
async function enrichProduct(
    product
) {

    const details =
        await loadProductDetails(
            product
        );

    return {
        ...product,
        ...details
    };
}

/**
 * Processa produtos em pequenos lotes,
 * evitando dezenas de requisições simultâneas.
 */
async function enrichProducts(
    products
) {

    const enriched = [];

    for (
        let index = 0;
        index < products.length;
        index += MAX_CONCURRENT_REQUESTS
    ) {

        const batch =
            products.slice(
                index,
                index + MAX_CONCURRENT_REQUESTS
            );

        const results =
            await Promise.all(
                batch.map(async product => {

                    try {

                        return await enrichProduct(
                            product
                        );

                    } catch (error) {

                        console.warn(
                            '[ECOBELLE] Produto não enriquecido:',
                            product?.sku ||
                            product?.name ||
                            '(sem identificação)',
                            '-',
                            error?.message || error
                        );

                        return product;
                    }
                })
            );

        enriched.push(...results);
    }

    return enriched;
}

/**
 * Carrega produtos EcoBelle.
 *
 * 1. Carrega a listagem.
 * 2. Extrai produtos estruturados.
 * 3. Remove duplicados.
 * 4. Enriquece pela página individual.
 * 5. Normaliza para o contrato AURÉA.
 */
export async function loadEcoBelleProducts() {

    const response =
        await fetch(
            ECOBELLE_PRODUCTS_URL,
            {
                method: 'GET',
                cache: 'no-store',
                headers: {
                    Accept: 'text/html'
                }
            }
        );

    if (!response.ok) {
        throw new Error(
            `EcoBelle: HTTP ${response.status}`
        );
    }

    const html =
        await response.text();

    const extracted =
        extractProductObjects(html);

    const unique =
        deduplicateProducts(
            extracted
        );

    if (!unique.length) {
        return [];
    }

    console.log(
        `[ECOBELLE] Produtos encontrados: ${unique.length}`
    );

    const enriched =
        await enrichProducts(
            unique
        );

    const normalized =
        normalizeCatalogProducts(
            enriched.map(
                mapEcoBelleProduct
            )
        );

    console.log(
        `[ECOBELLE] Produtos normalizados: ${normalized.length}`
    );

    return normalized;
}

export {
    ECOBELLE_PRODUCTS_URL,
    getPrice,
    getStock,
    getCategory,
    getDescription,
    getImage,
    getWeight,
    stripHtml,
    loadProductDetails,
    enrichProduct
};
