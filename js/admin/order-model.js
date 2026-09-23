'use strict';

const ORDER_STATUSES = Object.freeze([
    'new',
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled'
]);

const PAYMENT_STATUSES = Object.freeze([
    'pending',
    'paid',
    'failed',
    'cancelled'
]);

const LOGISTICS_STATUSES = Object.freeze([
    'new',
    'pending',
    'processing',
    'shipped',
    'delivered',
    'cancelled'
]);

function normalizeText(value) {
    if (value === null || value === undefined) {
        return '';
    }

    return String(value).trim();
}

function normalizeMoney(value) {
    const number = Number(value);

    if (!Number.isFinite(number) || number < 0) {
        throw new Error('Valor monetário inválido.');
    }

    return Number(number.toFixed(2));
}

function normalizeQuantity(value) {
    const number = Number(value);

    if (!Number.isInteger(number) || number <= 0) {
        throw new Error('Quantidade inválida.');
    }

    return number;
}

function normalizeOrderItem(item) {
    if (!item || typeof item !== 'object') {
        throw new Error('Item do pedido inválido.');
    }

    const sku = normalizeText(item.sku);
    const name = normalizeText(item.name);
    const quantity = normalizeQuantity(item.quantity);
    const unitPrice = normalizeMoney(item.unitPrice);

    if (!sku) {
        throw new Error('SKU do item é obrigatório.');
    }

    if (!name) {
        throw new Error('Nome do item é obrigatório.');
    }

    const total = normalizeMoney(
        item.total ?? (unitPrice * quantity)
    );

    if (total !== normalizeMoney(unitPrice * quantity)) {
        throw new Error(
            `Total inválido para o item ${sku}.`
        );
    }

    return {
        sku,
        name,
        image: normalizeText(item.image),
        quantity,
        unitPrice,
        total
    };
}

function normalizeCustomer(customer = {}) {
    return {
        name: normalizeText(customer.name),
        email: normalizeText(customer.email),
        phone: normalizeText(customer.phone)
    };
}

function normalizeDelivery(delivery = {}) {
    const address =
        delivery.address &&
        typeof delivery.address === 'object'
            ? { ...delivery.address }
            : normalizeText(delivery.address);

    return {
        method: normalizeText(delivery.method),
        address,
        number: normalizeText(delivery.number),
        complement: normalizeText(delivery.complement),
        neighborhood: normalizeText(delivery.neighborhood),
        city: normalizeText(delivery.city),
        state: normalizeText(delivery.state),
        zipCode: normalizeText(delivery.zipCode)
    };
}

function normalizePayment(payment = {}) {
    const status =
        normalizeText(payment.status) || 'pending';

    if (!PAYMENT_STATUSES.includes(status)) {
        throw new Error('Status do pagamento inválido.');
    }

    return {
        method:
            normalizeText(payment.method) || 'pix',
        status,
        transactionId:
            normalizeText(payment.transactionId),
        pixCode:
            normalizeText(payment.pixCode),
        pixGeneratedAt:
            normalizeText(payment.pixGeneratedAt)
    };
}

function normalizeLogistics(logistics = {}) {
    const status =
        normalizeText(logistics.status) || 'new';

    if (!LOGISTICS_STATUSES.includes(status)) {
        throw new Error(
            'Status logístico inválido.'
        );
    }

    return {
        status,
        trackingCode:
            normalizeText(logistics.trackingCode)
    };
}

function normalizeOrder(data = {}) {
    if (!data || typeof data !== 'object') {
        throw new Error('Pedido inválido.');
    }

    const id =
        normalizeText(data.id) ||
        normalizeText(data.orderId);

    if (!id) {
        throw new Error(
            'Identificador do pedido é obrigatório.'
        );
    }

    const items = Array.isArray(data.items)
        ? data.items.map(normalizeOrderItem)
        : [];

    if (!items.length) {
        throw new Error(
            'O pedido precisa ter pelo menos um item.'
        );
    }

    const subtotal = normalizeMoney(data.subtotal);
    const discount = normalizeMoney(
        data.discount ?? 0
    );
    const shipping = normalizeMoney(
        data.shipping ?? 0
    );
    const total = normalizeMoney(data.total);

    const expectedTotal = normalizeMoney(
        subtotal - discount + shipping
    );

    if (total !== expectedTotal) {
        throw new Error(
            'Total do pedido não corresponde ao subtotal - desconto + frete.'
        );
    }

    const status =
        normalizeText(data.status) || 'new';

    if (!ORDER_STATUSES.includes(status)) {
        throw new Error(
            'Status do pedido inválido.'
        );
    }

    return {
        id,
        orderId: id,

        status,

        createdAt:
            normalizeText(data.createdAt) ||
            new Date().toISOString(),

        currency:
            normalizeText(data.currency) ||
            'BRL',

        source:
            normalizeText(data.source) ||
            'website',

        subtotal,
        discount,
        shipping,
        total,

        customer:
            normalizeCustomer(data.customer),

        delivery:
            normalizeDelivery(data.delivery),

        items,

        payment:
            normalizePayment(data.payment),

        logistics:
            normalizeLogistics(data.logistics),

        coupon:
            data.coupon &&
            typeof data.coupon === 'object'
                ? { ...data.coupon }
                : null,

        notes:
            normalizeText(data.notes),

        history:
            Array.isArray(data.history)
                ? data.history
                : []
    };
}

function validateOrder(data) {
    const errors = [];

    if (!data || typeof data !== 'object') {
        return {
            valid: false,
            errors: ['Pedido inválido.']
        };
    }

    if (!data.id) {
        errors.push(
            'Identificador do pedido obrigatório.'
        );
    }

    if (
        !Array.isArray(data.items) ||
        !data.items.length
    ) {
        errors.push(
            'Pedido sem itens.'
        );
    }

    if (
        typeof data.subtotal !== 'number'
    ) {
        errors.push(
            'Subtotal inválido.'
        );
    }

    if (
        typeof data.discount !== 'number'
    ) {
        errors.push(
            'Desconto inválido.'
        );
    }

    if (
        typeof data.shipping !== 'number'
    ) {
        errors.push(
            'Frete inválido.'
        );
    }

    if (
        typeof data.total !== 'number'
    ) {
        errors.push(
            'Total inválido.'
        );
    }

    if (
        !data.customer ||
        !data.customer.name
    ) {
        errors.push(
            'Nome do cliente obrigatório.'
        );
    }

    if (
        !data.customer ||
        !data.customer.email
    ) {
        errors.push(
            'E-mail do cliente obrigatório.'
        );
    }

    if (
        !data.payment ||
        !data.payment.method
    ) {
        errors.push(
            'Método de pagamento obrigatório.'
        );
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

export {
    ORDER_STATUSES,
    PAYMENT_STATUSES,
    LOGISTICS_STATUSES,
    normalizeOrder,
    normalizeOrderItem,
    validateOrder
};
