'use strict';

const crypto = require('crypto');

const { AppError } = require('../../core/app-error');
const repository = require('./inventory-repository');

function normalizeQuantity(value) {
    const quantity = Number(value);

    if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new AppError(
            'Quantidade de estoque inválida.',
            400,
            'INVALID_QUANTITY'
        );
    }

    return quantity;
}

async function ensureStockItem({
    sku,
    product = null,
    stock = 0
}) {
    const normalizedSku = String(sku || '').trim();

    if (!normalizedSku) {
        throw new AppError(
            'SKU obrigatória.',
            400,
            'INVALID_SKU'
        );
    }

    const existing = await repository.getItem(normalizedSku);

    if (existing) {
        return existing;
    }

    return repository.saveItem({
        sku: normalizedSku,
        product,
        stock: Number(stock || 0),
        reserved: 0
    });
}

async function getAvailableStock(sku) {
    const item = await repository.getItem(sku);

    if (!item) {
        return 0;
    }

    return Math.max(
        0,
        Number(item.stock) - Number(item.reserved)
    );
}

async function reserve({
    sku,
    quantity,
    orderNumber = null,
    product = null
}) {
    const normalizedSku = String(sku || '').trim();
    const normalizedQuantity = normalizeQuantity(quantity);

    const item = await repository.getItem(normalizedSku);

    if (!item) {
        throw new AppError(
            `Produto ${normalizedSku} não encontrado no estoque.`,
            404,
            'STOCK_ITEM_NOT_FOUND'
        );
    }

    const available =
        Number(item.stock) -
        Number(item.reserved);

    if (available < normalizedQuantity) {
        throw new AppError(
            `Estoque insuficiente para ${normalizedSku}.`,
            409,
            'INSUFFICIENT_STOCK'
        );
    }

    const reservationId = crypto.randomUUID();

    await repository.updateItem(
        normalizedSku,
        {
            reserved:
                Number(item.reserved) +
                normalizedQuantity
        }
    );

    return repository.saveReservation({
        id: reservationId,
        orderNumber,
        sku: normalizedSku,
        quantity: normalizedQuantity,
        status: 'reserved',
        product
    });
}

async function release(reservationId) {
    const reservation =
        await repository.getReservation(
            reservationId
        );

    if (!reservation) {
        throw new AppError(
            'Reserva não encontrada.',
            404,
            'RESERVATION_NOT_FOUND'
        );
    }

    if (reservation.status !== 'reserved') {
        return reservation;
    }

    const item =
        await repository.getItem(
            reservation.sku
        );

    if (item) {
        await repository.updateItem(
            reservation.sku,
            {
                reserved: Math.max(
                    0,
                    Number(item.reserved) -
                    Number(reservation.quantity)
                )
            }
        );
    }

    return repository.saveReservation({
        ...reservation,
        status: 'released'
    });
}

async function commit(reservationId) {
    const reservation =
        await repository.getReservation(
            reservationId
        );

    if (!reservation) {
        throw new AppError(
            'Reserva não encontrada.',
            404,
            'RESERVATION_NOT_FOUND'
        );
    }

    if (reservation.status === 'committed') {
        return reservation;
    }

    if (reservation.status !== 'reserved') {
        throw new AppError(
            'Reserva não está disponível para confirmação.',
            409,
            'INVALID_RESERVATION_STATE'
        );
    }

    const item =
        await repository.getItem(
            reservation.sku
        );

    if (!item) {
        throw new AppError(
            'Produto não encontrado no estoque.',
            404,
            'STOCK_ITEM_NOT_FOUND'
        );
    }

    const quantity =
        Number(reservation.quantity);

    if (
        Number(item.stock) < quantity ||
        Number(item.reserved) < quantity
    ) {
        throw new AppError(
            'Estoque inconsistente para confirmação da reserva.',
            409,
            'STOCK_INCONSISTENCY'
        );
    }

    await repository.updateItem(
        reservation.sku,
        {
            stock:
                Number(item.stock) -
                quantity,
            reserved:
                Number(item.reserved) -
                quantity
        }
    );

    return repository.saveReservation({
        ...reservation,
        status: 'committed'
    });
}

module.exports = {
    normalizeQuantity,
    ensureStockItem,
    getAvailableStock,
    reserve,
    release,
    commit
};

