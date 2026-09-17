'use strict';

import {
    filterVisibleProducts,
    filterFeaturedProducts,
    getCatalogStats
} from './catalog-visibility.js';

import {
    selectHomeProducts,
    sortCatalogProducts
} from './catalog-curation.js';

const CATALOG_PATH = 'data/catalog/catalog-runtime.json';

const MANIFEST_PATH =
    'data/catalog/manifests/catalog-sources.json';

let catalogCache = null;
let sourceCache = null;

async function fetchJson(
    path
) {
    const response =
        await fetch(
            path,
            {
                cache: 'no-store'
            }
        );

    if (!response.ok) {
        throw new Error(
            `Não foi possível carregar ${path}. HTTP ${response.status}`
        );
    }

    return response.json();
}

async function loadRawCatalog() {
    if (catalogCache) {
        return catalogCache;
    }

    const data =
        await fetchJson(
            CATALOG_PATH
        );

    if (
        !data ||
        !Array.isArray(data.products)
    ) {
        throw new Error(
            'Catálogo inválido: products[] não encontrado.'
        );
    }

    catalogCache =
        data.products.map(
            product => ({
                ...product,
                sku:
                    String(
                        product.sku || ''
                    ).trim(),
                name:
                    String(
                        product.name || ''
                    ).trim(),
                price:
                    Number(product.price) || 0
            })
        );

    return catalogCache;
}

export async function loadCatalog() {
    return loadRawCatalog();
}

export async function loadProducts() {
    const products =
        await loadRawCatalog();

    const sources =
        await loadSources();

    return filterVisibleProducts(
        products,
        sources
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

    if (
        Array.isArray(data)
    ) {
        sourceCache = data;
    } else if (
        Array.isArray(data.sources)
    ) {
        sourceCache = data.sources;
    } else {
        throw new Error(
            'Manifesto de fontes inválido.'
        );
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

    /*
     * Se ainda não houver produtos
     * marcados como featured,
     * a Home recebe uma seleção
     * inicial ordenada.
     */
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
                    .toLowerCase() ===
                normalizedCategory;

            const matchesSource =
                !normalizedSource ||
                String(
                    product.sourceId || ''
                )
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

    const start =
        (safePage - 1) *
        safePageSize;

    const items =
        sorted.slice(
            start,
            start + safePageSize
        );

    return {
        items,

        total:
            sorted.length,

        page:
            safePage,

        pageSize:
            safePageSize,

        totalPages:
            Math.ceil(
                sorted.length /
                safePageSize
            )
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

