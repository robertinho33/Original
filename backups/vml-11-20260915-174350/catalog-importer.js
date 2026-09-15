'use strict';

import {
    catalogSources,
    getEnabledCatalogSources
} from './catalog-source-registry.js';

import {
    loadCatalogSources,
    mergeSourceProducts
} from './catalog-source-service.js';

import {
    normalizeCatalogProducts
} from './catalog-normalizer.js';

function normalizeSourceProducts(
    result,
    source
) {
    if (!result?.success) {
        return [];
    }

    if (!Array.isArray(result.products)) {
        return [];
    }

    return normalizeCatalogProducts(
        result.products,
        source
    );
}

function attachSourceMetadata(
    products,
    source
) {
    return products.map(product => ({
        ...product,

        sourceId:
            product.sourceId ||
            source.id,

        sourceName:
            product.sourceName ||
            source.name,

        active:
            product.active !== false,

        featured:
            product.featured === true,

        priority:
            Number(product.priority || 0)
    }));
}

function findSourceForResult(
    result
) {
    return catalogSources.find(
        source =>
            source.name === result?.source
    ) || null;
}

export async function importCatalog() {
    const enabledSources =
        getEnabledCatalogSources();

    const results =
        await loadCatalogSources(
            enabledSources
        );

    const products = [];

    for (const result of results) {
        const source =
            findSourceForResult(result);

        if (!source) continue;

        const normalized =
            normalizeSourceProducts(
                result,
                source
            );

        products.push(
            ...attachSourceMetadata(
                normalized,
                source
            )
        );
    }

    return {
        success: true,
        sources: results,
        products
    };
}

export async function importCatalogSource(
    sourceName
) {
    const normalizedName =
        String(sourceName || '')
            .trim()
            .toLowerCase();

    const source =
        catalogSources.find(
            item =>
                String(
                    item?.name || ''
                )
                    .trim()
                    .toLowerCase() ===
                normalizedName
        );

    if (!source) {
        throw new Error(
            `Fonte de catálogo não encontrada: ${sourceName}`
        );
    }

    const results =
        await loadCatalogSources([
            source
        ]);

    const result =
        results[0];

    const products =
        normalizeSourceProducts(
            result,
            source
        );

    return {
        success: true,
        source: source.name,
        results,
        products:
            attachSourceMetadata(
                products,
                source
            )
    };
}
