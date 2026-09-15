'use strict';

export function sortCatalogProducts(
    products = []
) {
    return [...products].sort(
        (a, b) => {
            const priorityA =
                Number(a.priority) || 0;

            const priorityB =
                Number(b.priority) || 0;

            if (
                priorityA !==
                priorityB
            ) {
                return (
                    priorityB -
                    priorityA
                );
            }

            return String(a.name)
                .localeCompare(
                    String(b.name),
                    'pt-BR'
                );
        }
    );
}

export function selectHomeProducts(
    products = [],
    {
        limit = 12,
        featuredOnly = false
    } = {}
) {
    const available =
        featuredOnly
            ? products.filter(
                product =>
                    product.featured === true
            )
            : products;

    return sortCatalogProducts(
        available
    ).slice(
        0,
        Math.max(0, Number(limit) || 0)
    );
}

export function markFeaturedProducts(
    products = [],
    selectedSkus = []
) {
    const selected =
        new Set(
            selectedSkus.map(
                sku =>
                    String(sku)
                        .trim()
            )
        );

    return products.map(product => ({
        ...product,
        featured:
            selected.has(
                String(product.sku)
                    .trim()
            )
    }));
}
