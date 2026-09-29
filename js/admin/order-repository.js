'use strict';

import { db } from '../firebase-config.js';

import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    runTransaction,
    where,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
    normalizeOrder,
    validateOrder
} from './order-model.js';

const ORDERS_COLLECTION = 'orders';
const PRODUCTS_COLLECTION = 'products';
const TRACKING_COLLECTION = 'orderTracking';
const INVENTORY_MOVEMENTS_COLLECTION = 'inventoryMovements';

function nowIso() {
    return new Date().toISOString();
}

function buildTracking(order, previousTracking = null) {
    const previousHistory =
        Array.isArray(previousTracking?.history)
            ? previousTracking.history
            : [];

    const orderHistory =
        Array.isArray(order.history)
            ? order.history
            : [];

    return {
        id: order.id,
        orderId: order.orderId || order.id,
        status: order.status || 'new',
        paymentStatus: order.payment?.status || 'pending',
        total: Number(order.total || 0),
        logisticsStatus: order.logistics?.status || 'new',
        history: orderHistory.length
            ? orderHistory
            : previousHistory,
        updatedAt: nowIso()
    };
}

function buildStatusHistoryEvent(
    order,
    previousStatus
) {
    return {
        type: 'status_changed',
        previousStatus: previousStatus || null,
        status: order.status || null,
        createdAt: nowIso(),
        source: 'admin'
    };
}

function buildPaymentHistoryEvent(
    order,
    previousPaymentStatus
) {
    return {
        type: 'payment_status_changed',
        previousPaymentStatus:
            previousPaymentStatus || null,
        paymentStatus:
            order.payment?.status || null,
        createdAt: nowIso(),
        source: 'admin'
    };
}

function normalizeSku(value) {
    return String(value ?? '').trim();
}

function normalizeQuantity(value) {
    const quantity = Number(value);

    if (
        !Number.isInteger(quantity) ||
        quantity <= 0
    ) {
        throw new Error(
            'Quantidade de produto inválida no pedido.'
        );
    }

    return quantity;
}

async function findProductBySkuTransaction(
    transaction,
    sku
) {
    const normalizedSku = normalizeSku(sku);

    if (!normalizedSku) {
        throw new Error(
            'SKU do produto não informada.'
        );
    }

    const productsQuery = query(
        collection(db, PRODUCTS_COLLECTION),
        where('sku', '==', normalizedSku),
        limit(2)
    );

    const snapshot =
        await transaction.get(productsQuery);

    if (snapshot.empty) {
        throw new Error(
            `Produto ${normalizedSku} não encontrado no Firestore.`
        );
    }

    if (snapshot.size > 1) {
        throw new Error(
            `SKU duplicada no Firestore: ${normalizedSku}.`
        );
    }

    return snapshot.docs[0];
}

function shouldCommitStock(
    currentOrder,
    nextOrder
) {
    const paymentChangedToPaid =
        nextOrder.payment?.status === 'paid' &&
        currentOrder.payment?.status !== 'paid';

    const alreadyCommitted =
        currentOrder.stockCommitted === true;

    return paymentChangedToPaid &&
        !alreadyCommitted;
}

function appendHistory(
    history,
    event
) {
    return [
        ...(Array.isArray(history) ? history : []),
        event
    ];
}

export async function createOrder(orderData) {
    const order = normalizeOrder(orderData);

    validateOrder(order);

    const payload = {
        ...order,
        updatedAt: nowIso()
    };

    const orderRef = await addDoc(
        collection(db, ORDERS_COLLECTION),
        payload
    );

    const trackingRef = doc(
        db,
        TRACKING_COLLECTION,
        order.id
    );

    await writeBatch(db)
        .set(
            trackingRef,
            buildTracking(order)
        )
        .commit();

    return {
        success: true,
        id: orderRef.id,
        data: order
    };
}

async function getProductBySku(sku) {
    const normalizedSku = normalizeSku(sku);

    if (!normalizedSku) {
        return null;
    }

    const productsQuery = query(
        collection(db, PRODUCTS_COLLECTION),
        where('sku', '==', normalizedSku),
        limit(1)
    );

    const snapshot =
        await getDocs(productsQuery);

    if (snapshot.empty) {
        return null;
    }

    const productDocument =
        snapshot.docs[0];

    return {
        id: productDocument.id,
        ...productDocument.data()
    };
}

async function enrichOrderItems(order) {
    if (
        !order ||
        !Array.isArray(order.items) ||
        !order.items.length
    ) {
        return order;
    }

    const items = await Promise.all(
        order.items.map(async item => {
            const product =
                await getProductBySku(item?.sku);

            if (!product) {
                return item;
            }

            const currentName =
                String(item?.name ?? '').trim();

            return {
                ...item,

                name:
                    currentName &&
                    currentName !== 'Produto'
                        ? currentName
                        : (
                            product.name ??
                            product.title ??
                            item?.sku ??
                            'Produto'
                        ),

                image:
                    item?.image ??
                    product.image ??
                    null,

                unitPrice:
                    Number(
                        item?.unitPrice ??
                        item?.price ??
                        product.price ??
                        0
                    )
            };
        })
    );

    return {
        ...order,
        items
    };
}

export async function getOrder(orderId) {
    const normalizedOrderId =
        String(orderId ?? '').trim();

    if (!normalizedOrderId) {
        return null;
    }

    const orderRef = doc(
        db,
        ORDERS_COLLECTION,
        normalizedOrderId
    );

    const documentSnapshot =
        await getDoc(orderRef);

    if (documentSnapshot.exists()) {
        return await enrichOrderItems({
            id: documentSnapshot.id,
            ...documentSnapshot.data()
        });
    }

    const orderQuery = query(
        collection(db, ORDERS_COLLECTION),
        where(
            'orderNumber',
            '==',
            normalizedOrderId
        ),
        limit(1)
    );

    const querySnapshot =
        await getDocs(orderQuery);

    if (!querySnapshot.empty) {
        const orderDocument =
            querySnapshot.docs[0];

        return await enrichOrderItems({
            id: orderDocument.id,
            ...orderDocument.data()
        });
    }

    const legacyQuery = query(
        collection(db, ORDERS_COLLECTION),
        where(
            'order_number',
            '==',
            normalizedOrderId
        ),
        limit(1)
    );

    const legacySnapshot =
        await getDocs(legacyQuery);

    if (!legacySnapshot.empty) {
        const orderDocument =
            legacySnapshot.docs[0];

        return await enrichOrderItems({
            id: orderDocument.id,
            ...orderDocument.data()
        });
    }

    return null;
}
export async function listOrders(
    maxResults = 100
) {
    const safeLimit = Math.max(
        1,
        Math.min(
            Number(maxResults) || 100,
            200
        )
    );

    const ordersQuery = query(
        collection(db, ORDERS_COLLECTION),
        orderBy('createdAt', 'desc'),
        limit(safeLimit)
    );

    const snapshot =
        await getDocs(ordersQuery);

    return snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
    }));
}

export async function listOrdersByStatus(
    status,
    maxResults = 100
) {
    if (!status) {
        return listOrders(maxResults);
    }

    const safeLimit = Math.max(
        1,
        Math.min(
            Number(maxResults) || 100,
            200
        )
    );

    const ordersQuery = query(
        collection(db, ORDERS_COLLECTION),
        where('status', '==', status),
        orderBy('createdAt', 'desc'),
        limit(safeLimit)
    );

    const snapshot =
        await getDocs(ordersQuery);

    return snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
    }));
}

export async function updateOrder(
    orderId,
    changes = {}
) {
    if (!orderId) {
        throw new Error(
            'ID do pedido não informado.'
        );
    }

    const orderRef = doc(
        db,
        ORDERS_COLLECTION,
        orderId
    );

    const trackingRef = doc(
        db,
        TRACKING_COLLECTION,
        orderId
    );

    return runTransaction(
        db,
        async transaction => {
            const orderSnapshot =
                await transaction.get(orderRef);

            if (!orderSnapshot.exists()) {
                throw new Error(
                    'Pedido não encontrado.'
                );
            }

            const currentOrder = {
                id: orderSnapshot.id,
                ...orderSnapshot.data()
            };

            const previousStatus =
                currentOrder.status;

            const previousPaymentStatus =
                currentOrder.payment?.status ||
                'pending';

            const nextOrder =
                normalizeOrder({
                    ...currentOrder,
                    ...changes
                });

            if (
                changes.payment &&
                typeof changes.payment === 'object'
            ) {
                nextOrder.payment = {
                    ...(currentOrder.payment || {}),
                    ...changes.payment
                };
            }

            if (
                changes.status &&
                changes.status !== previousStatus
            ) {
                nextOrder.history =
                    appendHistory(
                        nextOrder.history,
                        buildStatusHistoryEvent(
                            nextOrder,
                            previousStatus
                        )
                    );
            }

            if (
                nextOrder.payment?.status &&
                nextOrder.payment.status !==
                    previousPaymentStatus
            ) {
                nextOrder.history =
                    appendHistory(
                        nextOrder.history,
                        buildPaymentHistoryEvent(
                            nextOrder,
                            previousPaymentStatus
                        )
                    );
            }

            const committingStock =
                shouldCommitStock(
                    currentOrder,
                    nextOrder
                );

            if (committingStock) {
                const items =
                    Array.isArray(
                        nextOrder.items
                    )
                        ? nextOrder.items
                        : [];

                if (!items.length) {
                    throw new Error(
                        'Pedido sem itens para baixa de estoque.'
                    );
                }

                const productReads = [];

                for (const item of items) {
                    const sku =
                        normalizeSku(item?.sku);

                    const quantity =
                        normalizeQuantity(
                            item?.quantity
                        );

                    const productDoc =
                        await findProductBySkuTransaction(
                            transaction,
                            sku
                        );

                    productReads.push({
                        item,
                        sku,
                        quantity,
                        ref: productDoc.ref,
                        data: productDoc.data()
                    });
                }

                for (
                    const product of productReads
                ) {
                    const currentStock =
                        Number(
                            product.data.stock
                        );

                    if (
                        !Number.isFinite(
                            currentStock
                        )
                    ) {
                        throw new Error(
                            `Estoque inválido para ${product.sku}.`
                        );
                    }

                    if (
                        currentStock <
                        product.quantity
                    ) {
                        throw new Error(
                            `Estoque insuficiente para ${product.sku}. Disponível: ${currentStock}. Solicitado: ${product.quantity}.`
                        );
                    }
                }

                const committedAt =
                    nowIso();

                for (
                    const product of productReads
                ) {
                    const currentStock =
                        Number(
                            product.data.stock
                        );

                    transaction.update(
                        product.ref,
                        {
                            stock:
                                currentStock -
                                product.quantity,
                            updatedAt:
                                committedAt
                        }
                    );

                    const movementRef = doc(
                        collection(
                            db,
                            INVENTORY_MOVEMENTS_COLLECTION
                        )
                    );

                    transaction.set(
                        movementRef,
                        {
                            type: 'VENDA',
                            orderId,
                            productId: product.ref.id,
                            sku: product.sku,
                            quantity: -product.quantity,
                            previousStock: currentStock,
                            remainingStock:
                                currentStock -
                                product.quantity,
                            reason:
                                `Venda ${orderId}`,
                            createdAt:
                                committedAt
                        }
                    );
                }

                nextOrder.stockCommitted = true;

                nextOrder.stockCommittedAt =
                    committedAt;

                nextOrder.stockCommitId =
                    `${orderId}:${committedAt}`;

                nextOrder.history =
                    appendHistory(
                        nextOrder.history,
                        {
                            type:
                                'STOCK_COMMITTED',
                            createdAt:
                                committedAt,
                            source:
                                'admin',
                            details: {
                                items:
                                    productReads.map(
                                        product => ({
                                            sku:
                                                product.sku,
                                            quantity:
                                                product.quantity,
                                            previousStock:
                                                Number(
                                                    product.data.stock
                                                ),
                                            remainingStock:
                                                Number(
                                                    product.data.stock
                                                ) -
                                                product.quantity
                                        })
                                    )
                            }
                        }
                    );
            }

            const updatedAt = nowIso();

            nextOrder.updatedAt =
                updatedAt;

            const trackingSnapshot =
                await transaction.get(
                    trackingRef
                );

            const previousTracking =
                trackingSnapshot.exists()
                    ? trackingSnapshot.data()
                    : null;

            const tracking =
                buildTracking(
                    nextOrder,
                    previousTracking
                );

            transaction.update(
                orderRef,
                {
                    ...nextOrder,
                    updatedAt
                }
            );

            transaction.set(
                trackingRef,
                tracking,
                { merge: true }
            );

            return {
                success: true,
                id: orderId,
                data: nextOrder,
                tracking,
                stockCommitted:
                    committingStock
            };
        }
    );
}

export async function countOrders() {
    const snapshot = await getDocs(
        collection(db, ORDERS_COLLECTION)
    );

    return snapshot.size;
}



