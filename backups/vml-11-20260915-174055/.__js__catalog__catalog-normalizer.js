'use strict';

function clean(value) {
    return String(value ?? '').trim();
}

function parsePrice(value) {
    if (
        typeof value === 'number' &&
        Number.isFinite(value)
    ) {
        return Number(value.toFixed(2));
    }

    let text = clean(value);

    if (!text) {
        return 0;
    }

    text = text
        .replace(/R\$/gi, '')
        .replace(/\s/g, '');

    if (
        text.includes(',') &&
        text.includes('.')
    ) {
        if (
            text.lastIndexOf(',') >
            text.lastIndexOf('.')
        ) {
            text = text
                .replace(/\./g, '')
                .replace(',', '.');
        } else {
            text = text.replace(/,/g, '');
        }
    } else if (text.includes(',')) {
        text = text.replace(',', '.');
    }

    text = text.replace(/[^\d.-]/g, '');

    const number = Number(text);

    return Number.isFinite(number)
        ? Number(number.toFixed(2))
        : 0;
}

function normalizeBraePrice(value) {
    const price = parsePrice(value);

    if (
        Number.isInteger(price) &&
        price >= 1000
    ) {
        return Number(
            (price / 100).toFixed(2)
        );
    }

    return price;
}

export function normalizePrice(
    value,
    sourceId = ''
) {
    const normalizedSource =
        clean(sourceId).toLowerCase();

    if (
        normalizedSource === 'brae'
    ) {
        return normalizeBraePrice(value);
    }

    return parsePrice(value);
}

export function normalizeProduct(
    product = {},
    source = {}
) {
    const sourceId =
        clean(
            product.sourceId ||
            source.id
        ).toLowerCase();

    const sourceName =
        clean(
            product.sourceName ||
            source.name
        );

    const normalized = {
        sku: clean(product.sku),
        name: clean(product.name),
        weight: clean(product.weight),

        price: normalizePrice(
            product.price,
            sourceId
        ),

        category: clean(product.category),
        stock: clean(product.stock),
        description: clean(product.description),
        image: clean(product.image),

        sourceId,
        sourceName,

        sourceUrl:
            clean(
                product.sourceUrl ||
                source.url
            ),

        active:
            product.active !== false,

        featured:
            product.featured === true,

        priority:
            Number.isFinite(
                Number(product.priority)
            )
                ? Number(product.priority)
                : 0
    };

    /*
     * Produto sem imagem não é apagado.
     * Ele permanece no catálogo interno,
     * mas não participa da vitrine pública.
     */
    if (!normalized.image) {
        normalized.active = false;
        normalized.featured = false;
    }

    return normalized;
}

export function normalizeProducts(
    products = [],
    source = {}
) {
    if (!Array.isArray(products)) {
        return [];
    }

    return products
        .map(product =>
            normalizeProduct(
                product,
                source
            )
        )
        .filter(product =>
            product.sku &&
            product.name &&
            product.price > 0 &&
            product.sourceId
        );
}
