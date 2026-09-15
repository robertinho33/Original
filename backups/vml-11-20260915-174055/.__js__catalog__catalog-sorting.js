'use strict';

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLocaleLowerCase('pt-BR');
}

function getNumericPrice(product) {
    const value = Number(product?.price);
    return Number.isFinite(value) ? value : 0;
}

function getPriority(product) {
    const value = Number(product?.priority);
    return Number.isFinite(value) ? value : 0;
}

function relevanceScore(product, query) {
    const normalizedQuery = normalizeText(query);

    if (!normalizedQuery) {
        return 0;
    }

    const name = normalizeText(product?.name);
    const sku = normalizeText(product?.sku);
    const description = normalizeText(product?.description);
    const source = normalizeText(product?.sourceName);

    let score = 0;

    if (name === normalizedQuery) {
        score += 1000;
    }

    if (sku === normalizedQuery) {
        score += 900;
    }

    if (name.startsWith(normalizedQuery)) {
        score += 500;
    }

    if (sku.startsWith(normalizedQuery)) {
        score += 400;
    }

    if (name.includes(normalizedQuery)) {
        score += 250;
    }

    if (description.includes(normalizedQuery)) {
        score += 100;
    }

    if (source.includes(normalizedQuery)) {
        score += 50;
    }

    return score;
}

export function sortCatalogProducts(
    products = [],
    {
        sort = 'relevance',
        query = ''
    } = {}
) {
    const list = Array.isArray(products)
        ? [...products]
        : [];

    return list.sort((a, b) => {

        switch (sort) {

            case 'price-asc':
                return (
                    getNumericPrice(a) -
                    getNumericPrice(b)
                );

            case 'price-desc':
                return (
                    getNumericPrice(b) -
                    getNumericPrice(a)
                );

            case 'name-asc':
                return normalizeText(a?.name)
                    .localeCompare(
                        normalizeText(b?.name),
                        'pt-BR'
                    );

            case 'priority':
                return (
                    getPriority(b) -
                    getPriority(a)
                );

            case 'relevance':
            default: {
                const scoreA =
                    relevanceScore(a, query);

                const scoreB =
                    relevanceScore(b, query);

                if (scoreA !== scoreB) {
                    return scoreB - scoreA;
                }

                const priorityA =
                    getPriority(a);

                const priorityB =
                    getPriority(b);

                if (priorityA !== priorityB) {
                    return priorityB - priorityA;
                }

                return normalizeText(a?.name)
                    .localeCompare(
                        normalizeText(b?.name),
                        'pt-BR'
                    );
            }
        }
    });
}
