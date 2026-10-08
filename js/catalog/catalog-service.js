'use strict';

import {
    filterFeaturedProducts,
    getCatalogStats
} from './catalog-visibility.js';

import {
    selectHomeProducts
} from './catalog-curation.js';
import { sortCatalogProducts } from './catalog-sorting.js';

const RUNTIME_CATALOG_PATH =
    '/data/catalog/catalog-runtime.json';
const PUBLIC_CATALOG_PATH = '/api/storefront/catalog';

const MANIFEST_PATH =
    '/data/catalog/manifests/catalog-sources.json';
const SOURCES_API_PATH = '/api/storefront/catalog-sources';
const VISIBILITY_PATH =
    '/api/storefront/catalog-visibility';

let catalogCache = null;
let sourceCache = null;
let visibilityCache = null;
let visibilityCacheAt = 0;
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

async function loadVisibilityOverrides() {
    if (visibilityCache && Date.now() - visibilityCacheAt < 30000) {
        return visibilityCache;
    }

    try {
        const response = await fetch(VISIBILITY_PATH, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        visibilityCache = payload?.data || {};
    } catch (error) {
        console.warn('[CATALOG] Não foi possível carregar as preferências de visibilidade:', error?.message || error);
        visibilityCache = {};
    }

    visibilityCacheAt = Date.now();
    return visibilityCache;
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

    let data;
    try {
        data = await fetchJson(PUBLIC_CATALOG_PATH);
    } catch {
        data = await fetchJson(RUNTIME_CATALOG_PATH);
    }

    const rawProducts =
        Array.isArray(data)
            ? data
            : Array.isArray(data?.products)
                ? data.products
                : Array.isArray(data?.data?.products)
                    ? data.data.products
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
    const [products, visibility] = await Promise.all([
        loadRawCatalog(),
        loadVisibilityOverrides()
    ]);
    const inactiveSkus = new Set(
        (Array.isArray(visibility.inactiveProductSkus)
            ? visibility.inactiveProductSkus
            : []).map(value => String(value).trim().toLowerCase())
    );
    const visibleSources = Array.isArray(visibility.visibleSources)
        ? new Set(visibility.visibleSources.map(value => String(value).trim().toLowerCase()))
        : null;

    return products.filter(
        product => {
            const sku = String(product?.sku || '').trim().toLowerCase();
            const sourceId = String(product?.sourceId || '').trim().toLowerCase();
            return product?.active !== false &&
                !inactiveSkus.has(sku) &&
                (!visibleSources || !sourceId || visibleSources.has(sourceId));
        }
    );
}

export async function loadAllProducts() {
    return loadRawCatalog();
}

export async function loadSources() {
    if (sourceCache) {
        return sourceCache;
    }

    let data;
    try {
        data = await fetchJson(SOURCES_API_PATH);
    } catch {
        data = await fetchJson(MANIFEST_PATH);
    }

    if (Array.isArray(data)) {
        sourceCache = data;
    } else if (Array.isArray(data?.data)) {
        sourceCache = data.data;
    } else if (
        Array.isArray(data?.sources)
    ) {
        sourceCache = data.sources;
    } else if (Array.isArray(data?.data?.sources)) {
        sourceCache = data.data.sources;
    } else {
        sourceCache = [];
    }

    const visibility = await loadVisibilityOverrides();
    const visibleSources = Array.isArray(visibility.visibleSources)
        ? new Set(visibility.visibleSources.map(value => String(value).trim().toLowerCase()))
        : null;
    if (visibleSources) {
        sourceCache = sourceCache.map(source => ({
            ...source,
            visible: source.visible !== false && visibleSources.has(String(source.id || '').trim().toLowerCase())
        }));
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
        pageSize = 24,
        sort = 'priority'
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
        sortCatalogProducts(filtered, {
            sort,
            query: normalizedQuery
        });

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
