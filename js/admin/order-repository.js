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
        orderNumber: order.orderNumber || order.orderId || order.id,
        status: order.status || 'new',
        paymentStatus: order.payment?.status || 'pending',
        paymentConfirmedAt: order.payment?.confirmedAt || order.payment?.paidAt || null,
        createdAt: order.createdAt || null,
        total: Number(order.total || 0),
        logisticsStatus: order.logistics?.status || 'new',
        carrier: order.logistics?.carrier || order.logistics?.shippingCarrier || '',
        trackingCode: order.logistics?.trackingCode || '',
        postedAt: order.logistics?.postedAt || order.logistics?.shippedAt || null,
        estimatedDelivery: order.logistics?.estimatedDelivery || null,
        deliveredAt: order.logistics?.deliveredAt || null,
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
            'Quantidade de produto invÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡lida no pedido.'
        );
    }

    return quantity;
}

async function findProductBySku(
    sku
) {
    const normalizedSku = normalizeSku(sku);

    if (!normalizedSku) {
        throw new Error(
            'SKU do produto ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© obrigatÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ria.'
        );
    }

    const productsQuery = query(
        collection(db, PRODUCTS_COLLECTION),
        where('sku', '==', normalizedSku),
        limit(2)
    );

    const snapshot =
        await getDocs(productsQuery);

    if (snapshot.empty) {
        throw new Error(
            `Produto ${normalizedSku} nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o encontrado no Firestore.`
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
    const paymentChangedToConfirmed =
        nextOrder.payment?.status === 'confirmed' &&
        currentOrder.payment?.status !== 'confirmed';

    const paymentChangedToPaid =
        nextOrder.payment?.status === 'paid' &&
        currentOrder.payment?.status !== 'paid';

    const paymentChanged =
        paymentChangedToConfirmed ||
        paymentChangedToPaid;

    const alreadyCommitted =
        currentOrder.stockCommitted === true;

    return paymentChanged &&
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

    if (order.publicTrackingToken) {
        await setDoc(
            doc(db, TRACKING_COLLECTION, order.publicTrackingToken),
            buildTracking(order),
            { merge: true }
        );
    }

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
            'ID do pedido nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o informado.'
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
                    'Pedido nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o encontrado.'
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

    let trackingSnapshot = null;
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

                /*
                 * Todas as leituras da transaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o acontecem
                 * antes de qualquer escrita.
                 */
                for (const item of items) {
                    const sku =
                        normalizeSku(item?.sku);

                    const quantity =
                        normalizeQuantity(
                            item?.quantity
                        );

                    if (!sku) {
                        throw new Error(
                            'SKU do produto nÃƒÆ’Ã‚Â£o informada.'
                        );
                    }

                    if (
                        !Number.isInteger(quantity) ||
                        quantity <= 0
                    ) {
                        throw new Error(
                            `Quantidade invÃƒÆ’Ã‚Â¡lida para ${sku}.`
                        );
                    }

                    const productDoc =
                        await findProductBySku(sku);

                    const productSnapshot =
                        await transaction.get(
                            productDoc.ref
                        );

                    productReads.push({
                        item,
                        sku,
                        quantity,
                        ref:
                            productSnapshot.ref,
                        data:
                            productSnapshot.data()
                    });
                }

                /*
                 * ValidaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o dos estoques.
                 * Nenhuma escrita ocorre neste ponto.
                 */
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
                            `Estoque invÃƒÆ’Ã‚Â¡lido para ${product.sku}.`
                        );
                    }

                    if (
                        currentStock <
                        product.quantity
                    ) {
                        throw new Error(
                            `Estoque insuficiente para ${product.sku}. DisponÃƒÆ’Ã‚Â­vel: ${currentStock}. Solicitado: ${product.quantity}.`
                        );
                    }
                }

            trackingSnapshot =
                await transaction.get(
                    trackingRef
                );

                const committedAt =
                    nowIso();

                /*
                 * Somente depois de todas as leituras
                 * e validaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes comeÃƒÆ’Ã‚Â§am as escritas.
                 */
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

                    const movementRef =
                        doc(
                            collection(
                                db,
                                INVENTORY_MOVEMENTS_COLLECTION
                            )
                        );

                    transaction.set(
                        movementRef,
                        {
                            type: 'VENDA',
                            sku:
                                product.sku,
                            quantity:
                                -product.quantity,
                            previousStock:
                                currentStock,
                            newStock:
                                currentStock -
                                product.quantity,
                            orderId,
                            createdAt:
                                committedAt,
                            source:
                                'admin'
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

            const previousTracking =
                trackingSnapshot &&
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

            if (nextOrder.publicTrackingToken) {
                const publicTrackingRef = doc(
                    db,
                    TRACKING_COLLECTION,
                    nextOrder.publicTrackingToken
                );
                transaction.set(
                    publicTrackingRef,
                    {
                        ...tracking,
                        id: nextOrder.orderNumber || nextOrder.orderId || nextOrder.id,
                        updatedAt,
                        history: (Array.isArray(nextOrder.history) ? nextOrder.history : [])
                            .filter(event => event && [
                                'ORDER_CREATED',
                                'PAYMENT_CONFIRMED',
                                'PREPARING',
                                'PACKED',
                                'SHIPPED',
                                'IN_TRANSIT',
                                'OUT_FOR_DELIVERY',
                                'DELIVERED',
                                'status_changed',
                                'payment_status_changed',
                                'logistics_status_changed'
                            ].includes(String(event.type || '')))
                            .map(event => ({
                                type: String(event.type || ''),
                                label: String(event.label || '').slice(0, 120),
                                status: String(event.status || ''),
                                paymentStatus: String(event.paymentStatus || ''),
                                createdAt: event.createdAt || null
                            }))
                    },
                    { merge: true }
                );
            }

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



