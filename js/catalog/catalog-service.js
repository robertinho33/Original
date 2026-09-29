'use strict';

import {
    filterFeaturedProducts,
    getCatalogStats
} from './catalog-visibility.js';

import {
    selectHomeProducts,
    sortCatalogProducts
} from './catalog-curation.js';

const RUNTIME_CATALOG_PATH =
    'data/catalog/catalog-runtime.json';

const MANIFEST_PATH =
    'data/catalog/manifests/catalog-sources.json';

let catalogCache = null;
let sourceCache = null;
let catalogListeners = new Set();

function normalizeProduct(product, documentId = '') {
    const source =
        product && typeof product === 'object'
            ? product
            : {};

    const stockValue =
        Number(source.stock);

    const normalizedStock =
        Number.isFinite(stockValue)
            ? Math.max(0, Math.floor(stockValue))
            : 0;

    const priceValue =
        Number(source.price);

    const id =
        String(
            source.id ||
            source.productId ||
            documentId ||
            source.sku ||
            ''
        ).trim();

    return {
        ...source,

        id,

        productId:
            String(
                source.productId ||
                documentId ||
                source.id ||
                source.sku ||
                ''
            ).trim(),

        sku:
            String(
                source.sku || ''
            ).trim(),

        name:
            String(
                source.name || ''
            ).trim(),

        price:
            Number.isFinite(priceValue)
                ? priceValue
                : 0,

        stock:
            normalizedStock
    };
}

async function fetchJson(path) {
    const response =
        await fetch(
            path,
            {
                cache: 'no-cache'
            }
        );

    if (!response.ok) {
        throw new Error(
            `Não foi possível carregar ${path}. HTTP ${response.status}`
        );
    }

    return response.json();
}

/*
 * Catálogo público:
 *
 * NÃO consulta Firestore.
 *
 * O Firestore continua sendo a fonte administrativa.
 * O runtime JSON é a fonte de leitura pública.
 */
async function loadRawCatalog() {
    if (catalogCache) {
        return catalogCache;
    }

    const data =
        await fetchJson(
            RUNTIME_CATALOG_PATH
        );

    const rawProducts =
        Array.isArray(data)
            ? data
            : Array.isArray(data?.products)
                ? data.products
                : [];

    catalogCache =
        rawProducts
            .map(product =>
                normalizeProduct(product)
            )
            .filter(product =>
                product.sku
            );

    return catalogCache;
}

export async function loadCatalog() {
    return loadRawCatalog();
}

export async function loadProducts() {
    const products =
        await loadRawCatalog();

    return products.filter(
        product =>
            product?.active !== false
    );
}

export async function loadAllProducts() {
    return loadRawCatalog();
}

export async function loadSources() {
    if (sourceCache) {
        return sourceCache;
    }

    const data =
        await fetchJson(
            MANIFEST_PATH
        );

    if (Array.isArray(data)) {
        sourceCache = data;
    } else if (
        Array.isArray(data?.sources)
    ) {
        sourceCache = data.sources;
    } else {
        sourceCache = [];
    }

    return sourceCache;
}

export async function loadHomeProducts({
    limit = 12
} = {}) {
    const products =
        await loadProducts();

    const sources =
        await loadSources();

    const featured =
        filterFeaturedProducts(
            products,
            sources
        );

    const base =
        featured.length
            ? featured
            : products;

    return selectHomeProducts(
        base,
        {
            limit,
            featuredOnly: false
        }
    );
}

export async function searchProducts(
    query = '',
    {
        category = '',
        sourceId = '',
        page = 1,
        pageSize = 24
    } = {}
) {
    const products =
        await loadProducts();

    const normalizedQuery =
        String(query)
            .trim()
            .toLowerCase();

    const normalizedCategory =
        String(category)
            .trim()
            .toLowerCase();

    const normalizedSource =
        String(sourceId)
            .trim()
            .toLowerCase();

    const filtered =
        products.filter(product => {
            const text = [
                product.name,
                product.sku,
                product.category,
                product.description,
                product.sourceName
            ]
                .join(' ')
                .toLowerCase();

            const matchesQuery =
                !normalizedQuery ||
                text.includes(
                    normalizedQuery
                );

            const matchesCategory =
                !normalizedCategory ||
                String(
                    product.category || ''
                )
                    .trim()
                    .toLowerCase() ===
                normalizedCategory;

            const matchesSource =
                !normalizedSource ||
                String(
                    product.sourceId || ''
                )
                    .trim()
                    .toLowerCase() ===
                normalizedSource;

            return (
                matchesQuery &&
                matchesCategory &&
                matchesSource
            );
        });

    const sorted =
        sortCatalogProducts(
            filtered
        );

    const safePage =
        Math.max(
            1,
            Number(page) || 1
        );

    const safePageSize =
        Math.max(
            1,
            Number(pageSize) || 24
        );

    const total =
        sorted.length;

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                total / safePageSize
            )
        );

    const currentPage =
        Math.min(
            safePage,
            totalPages
        );

    const start =
        (currentPage - 1) *
        safePageSize;

    const items =
        sorted.slice(
            start,
            start + safePageSize
        );

    return {
        items,
        products: items,
        total,
        page: currentPage,
        pageSize: safePageSize,
        totalPages,
        hasNextPage:
            currentPage < totalPages,
        hasPreviousPage:
            currentPage > 1
    };
}

export async function getCatalogStatsAsync() {
    const products =
        await loadAllProducts();

    const sources =
        await loadSources();

    return getCatalogStats(
        products,
        sources
    );
}

export function clearCatalogCache() {
    catalogCache = null;
    sourceCache = null;
}

export function subscribeCatalog(callback) {
    if (typeof callback !== 'function') {
        throw new TypeError(
            'subscribeCatalog exige uma função.'
        );
    }

    catalogListeners.add(callback);

    /*
     * O catálogo público não mantém listener
     * em /products do Firestore.
     *
     * Entregamos imediatamente o catálogo
     * estático disponível.
     */
    loadProducts()
        .then(products => {
            try {
                callback(products);
            } catch (error) {
                console.error(
                    '[CATALOG] Listener error:',
                    error
                );
            }
        })
        .catch(error => {
            console.error(
                '[CATALOG] Runtime catalog error:',
                error
            );
        });

    return () => {
        catalogListeners.delete(callback);
    };
}
