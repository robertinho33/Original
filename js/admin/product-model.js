'use strict';

const PRODUCT_FIELDS = Object.freeze({
    sku: 'string',
    name: 'string',
    description: 'string',
    price: 'number',
    promotionalPrice: 'number|null',
    categoryId: 'string',
    categoryName: 'string',
    image: 'string',
    weight: 'number',
    active: 'boolean',
    stock: 'number',
    minimumStock: 'number',
    createdAt: 'string',
    updatedAt: 'string'
});

function normalizeProduct(input = {}) {

    const price =
        Number(input.price);

    const promotionalPrice =
        input.promotionalPrice === null ||
        input.promotionalPrice === undefined ||
        input.promotionalPrice === ''
            ? null
            : Number(input.promotionalPrice);

    return {
        sku:
            String(input.sku || '')
                .trim()
                .toUpperCase(),

        name:
            String(input.name || '')
                .trim(),

        description:
            String(input.description || '')
                .trim(),

        price:
            Number.isFinite(price)
                ? price
                : 0,

        promotionalPrice:
            promotionalPrice !== null &&
            Number.isFinite(promotionalPrice)
                ? promotionalPrice
                : null,

        categoryId:
            String(input.categoryId || '')
                .trim(),

        categoryName:
            String(input.categoryName || '')
                .trim(),

        image:
            String(input.image || '')
                .trim(),

        weight:
            Number.isFinite(Number(input.weight))
                ? Number(input.weight)
                : 0,

        active:
            input.active !== false,

        stock:
            Number.isFinite(Number(input.stock))
                ? Number(input.stock)
                : 0,

        minimumStock:
            Number.isFinite(Number(input.minimumStock))
                ? Number(input.minimumStock)
                : 0
    };
}

function validateProduct(product) {

    const errors = [];

    if (!product.sku) {
        errors.push(
            'SKU é obrigatório.'
        );
    }

    if (!product.name) {
        errors.push(
            'Nome do produto é obrigatório.'
        );
    }

    if (
        !Number.isFinite(product.price) ||
        product.price < 0
    ) {
        errors.push(
            'Preço deve ser maior ou igual a zero.'
        );
    }

    if (
        product.promotionalPrice !== null &&
        (
            !Number.isFinite(
                product.promotionalPrice
            ) ||
            product.promotionalPrice < 0
        )
    ) {
        errors.push(
            'Preço promocional inválido.'
        );
    }

    if (
        product.promotionalPrice !== null &&
        product.promotionalPrice > product.price
    ) {
        errors.push(
            'Preço promocional não pode ser maior que o preço normal.'
        );
    }

    if (
        !Number.isFinite(product.stock) ||
        product.stock < 0
    ) {
        errors.push(
            'Estoque inválido.'
        );
    }

    if (
        !Number.isFinite(product.minimumStock) ||
        product.minimumStock < 0
    ) {
        errors.push(
            'Estoque mínimo inválido.'
        );
    }

    if (
        !Number.isFinite(product.weight) ||
        product.weight < 0
    ) {
        errors.push(
            'Peso inválido.'
        );
    }

    return {
        valid:
            errors.length === 0,

        errors
    };
}

export {
    PRODUCT_FIELDS,
    normalizeProduct,
    validateProduct
};
