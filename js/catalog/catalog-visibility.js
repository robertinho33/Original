'use strict';

function normalizedId(value) {
    return String(value ?? '')
        .trim()
        .toLowerCase();
}

export function isSourceEnabled(source) {
    return source?.enabled === true;
}

export function isSourceVisible(source) {
    return (
        isSourceEnabled(source) &&
        source?.visible === true
    );
}

export function isSourceFeatured(source) {
    return (
        isSourceVisible(source) &&
        source?.featured === true
    );
}

export function isProductActive(product) {
    return product?.active !== false;
}

export function isProductFeatured(product) {
    return (
        isProductActive(product) &&
        product?.featured === true
    );
}

export function filterActiveProducts(
    products = []
) {
    return products.filter(
        product =>
            isProductActive(product)
    );
}

export function filterVisibleProducts(
    products = [],
    sources = []
) {
    const sourceMap = new Map(
        sources.map(source => [
            normalizedId(source.id),
            source
        ])
    );

    return products.filter(product => {
        if (!isProductActive(product)) {
            return false;
        }

        const source =
            sourceMap.get(
                normalizedId(
                    product.sourceId
                )
            );

        return (
            source &&
            isSourceVisible(source)
        );
    });
}

export function filterFeaturedProducts(
    products = [],
    sources = []
) {
    const sourceMap = new Map(
        sources.map(source => [
            normalizedId(source.id),
            source
        ])
    );

    return products.filter(product => {
        if (!isProductFeatured(product)) {
            return false;
        }

        const source =
            sourceMap.get(
                normalizedId(
                    product.sourceId
                )
            );

        return (
            source &&
            isSourceFeatured(source)
        );
    });
}

export function getCatalogStats(
    products = [],
    sources = []
) {
    const visible =
        filterVisibleProducts(
            products,
            sources
        );

    const active =
        filterActiveProducts(products);

    const featured =
        filterFeaturedProducts(
            products,
            sources
        );

    return {
        total: products.length,
        active: active.length,
        visible: visible.length,
        featured: featured.length,

        sources: sources.length,

        enabledSources:
            sources.filter(
                source =>
                    isSourceEnabled(source)
            ).length,

        visibleSources:
            sources.filter(
                source =>
                    isSourceVisible(source)
            ).length
    };
}
