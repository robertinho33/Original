'use strict';

import { db } from '../firebase-config.js';

import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    addDoc,
    runTransaction,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const PRODUCTS_COLLECTION = 'products';
const MOVEMENTS_COLLECTION = 'inventoryMovements';

function normalizeStock(value) {
    const stock = Number(value);
    return Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : 0;
}

function normalizeMinimumStock(value) {
    const minimum = Number(value);
    return Number.isFinite(minimum)
        ? Math.max(0, Math.floor(minimum))
        : 0;
}

function getStatus(stock, minimumStock) {
    if (stock <= 0) return 'ZERADO';
    if (stock <= minimumStock) return 'BAIXO';
    return 'OK';
}

function serialize(value) {
    if (
        value &&
        typeof value.toDate === 'function'
    ) {
        return value.toDate().toISOString();
    }

    if (Array.isArray(value)) {
        return value.map(serialize);
    }

    if (
        value &&
        typeof value === 'object'
    ) {
        return Object.fromEntries(
            Object.entries(value).map(
                ([key, item]) => [
                    key,
                    serialize(item)
                ]
            )
        );
    }

    return value;
}

export async function listInventory() {
    const snapshot = await getDocs(
        collection(
            db,
            PRODUCTS_COLLECTION
        )
    );

    return snapshot.docs
        .map(item => {
            const data = item.data();

            const stock =
                normalizeStock(data.stock);

            const minimumStock =
                normalizeMinimumStock(
                    data.minimumStock
                );

            return {
                id: item.id,
                sku: data.sku ?? '',
                name: data.name ?? '',
                stock,
                minimumStock,
                status: getStatus(
                    stock,
                    minimumStock
                )
            };
        })
        .sort((a, b) =>
            a.name.localeCompare(
                b.name,
                'pt-BR'
            )
        );
}

export async function getInventoryItem(
    productId
) {
    const reference = doc(
        db,
        PRODUCTS_COLLECTION,
        productId
    );

    const snapshot =
        await getDoc(reference);

    if (!snapshot.exists()) {
        return null;
    }

    const data = snapshot.data();

    const stock =
        normalizeStock(data.stock);

    const minimumStock =
        normalizeMinimumStock(
            data.minimumStock
        );

    return {
        id: snapshot.id,
        sku: data.sku ?? '',
        name: data.name ?? '',
        stock,
        minimumStock,
        status: getStatus(
            stock,
            minimumStock
        )
    };
}

/**
 * Ajuste manual de estoque pelo Admin.
 *
 * quantity:
 *   positivo = entrada
 *   negativo = saída
 */
export async function updateInventory(
    productId,
    quantity,
    type = 'AJUSTE',
    reason = ''
) {
    const amount = Number(quantity);

    if (!Number.isFinite(amount) || amount === 0) {
        throw new Error(
            'Quantidade de estoque inválida.'
        );
    }

    const productReference = doc(
        db,
        PRODUCTS_COLLECTION,
        productId
    );

    const result =
        await runTransaction(
            db,
            async transaction => {
                const snapshot =
                    await transaction.get(
                        productReference
                    );

                if (!snapshot.exists()) {
                    throw new Error(
                        'Produto não encontrado.'
                    );
                }

                const data =
                    snapshot.data();

                const currentStock =
                    normalizeStock(
                        data.stock
                    );

                const newStock =
                    currentStock + amount;

                if (newStock < 0) {
                    throw new Error(
                        `Estoque insuficiente. Atual: ${currentStock}.`
                    );
                }

                transaction.update(
                    productReference,
                    {
                        stock: newStock,
                        updatedAt:
                            new Date().toISOString()
                    }
                );

                return {
                    currentStock,
                    newStock,
                    sku: data.sku ?? '',
                    name: data.name ?? ''
                };
            }
        );

    await addDoc(
        collection(
            db,
            MOVEMENTS_COLLECTION
        ),
        {
            productId,
            sku: result.sku,
            productName: result.name,
            quantity: amount,
            stockBefore:
                result.currentStock,
            stockAfter:
                result.newStock,
            type,
            reason,
            createdAt:
                serverTimestamp()
        }
    );

    return {
        productId,
        quantity: amount,
        stock: result.newStock
    };
}

/**
 * Baixa de estoque após pagamento confirmado.
 *
 * IMPORTANTE:
 * A operação é idempotente através do documento
 * do pedido. O mesmo pedido nunca pode baixar
 * o estoque duas vezes.
 */
export async function processSaleStock(
    order
) {
    if (!order?.id) {
        throw new Error(
            'Pedido inválido para baixa de estoque.'
        );
    }

    if (
        !Array.isArray(order.items) ||
        !order.items.length
    ) {
        throw new Error(
            'Pedido sem itens.'
        );
    }

    const orderReference = doc(
        db,
        'orders',
        order.id
    );

    const result =
        await runTransaction(
            db,
            async transaction => {
                const orderSnapshot =
                    await transaction.get(
                        orderReference
                    );

                if (!orderSnapshot.exists()) {
                    throw new Error(
                        'Pedido não encontrado.'
                    );
                }

                const currentOrder =
                    orderSnapshot.data();

                if (
                    currentOrder.inventoryProcessed === true
                ) {
                    return {
                        alreadyProcessed: true
                    };
                }

                const productReferences =
                    order.items.map(item =>
                        doc(
                            db,
                            PRODUCTS_COLLECTION,
                            item.productId ||
                            item.id ||
                            ''
                        )
                    );

                const uniqueReferences =
                    [
                        ...new Map(
                            productReferences.map(
                                reference => [
                                    reference.path,
                                    reference
                                ]
                            )
                        ).values()
                    ];

                const productSnapshots =
                    await Promise.all(
                        uniqueReferences.map(
                            reference =>
                                transaction.get(
                                    reference
                                )
                        )
                    );

                const productsByPath =
                    new Map();

                productSnapshots.forEach(
                    snapshot => {
                        if (snapshot.exists()) {
                            productsByPath.set(
                                snapshot.ref.path,
                                {
                                    snapshot,
                                    data:
                                        snapshot.data()
                                }
                            );
                        }
                    }
                );

                const changes = [];

                for (
                    const item of order.items
                ) {
                    const productId =
                        item.productId ||
                        item.id;

                    if (!productId) {
                        throw new Error(
                            `Item sem productId: ${
                                item.sku || 'SKU desconhecido'
                            }`
                        );
                    }

                    const reference =
                        doc(
                            db,
                            PRODUCTS_COLLECTION,
                            productId
                        );

                    const product =
                        productsByPath.get(
                            reference.path
                        );

                    if (!product) {
                        throw new Error(
                            `Produto não encontrado: ${
                                item.sku || productId
                            }`
                        );
                    }

                    const quantity =
                        Math.max(
                            1,
                            Number(
                                item.quantity
                            ) || 1
                        );

                    const currentStock =
                        normalizeStock(
                            product.data.stock
                        );

                    if (
                        currentStock < quantity
                    ) {
                        throw new Error(
                            `Estoque insuficiente para ${
                                product.data.name ||
                                item.name ||
                                item.sku
                            }. Disponível: ${
                                currentStock
                            }. Solicitado: ${
                                quantity
                            }.`
                        );
                    }

                    changes.push({
                        reference,
                        sku:
                            product.data.sku ||
                            item.sku ||
                            '',
                        name:
                            product.data.name ||
                            item.name ||
                            '',
                        quantity,
                        stockBefore:
                            currentStock,
                        stockAfter:
                            currentStock -
                            quantity
                    });
                }

                for (const change of changes) {
                    transaction.update(
                        change.reference,
                        {
                            stock:
                                change.stockAfter,
                            updatedAt:
                                new Date().toISOString()
                        }
                    );
                }

                transaction.update(
                    orderReference,
                    {
                        inventoryProcessed: true,
                        inventoryProcessedAt:
                            new Date().toISOString()
                    }
                );

                return {
                    alreadyProcessed: false,
                    changes
                };
            }
        );

    if (
        result.alreadyProcessed
    ) {
        return {
            success: true,
            alreadyProcessed: true,
            changes: []
        };
    }

    for (
        const change of result.changes
    ) {
        await addDoc(
            collection(
                db,
                MOVEMENTS_COLLECTION
            ),
            {
                productId:
                    change.reference.id,
                sku: change.sku,
                productName:
                    change.name,
                quantity:
                    -change.quantity,
                stockBefore:
                    change.stockBefore,
                stockAfter:
                    change.stockAfter,
                type: 'VENDA',
                reason:
                    `Venda ${order.id}`,
                orderId:
                    order.id,
                createdAt:
                    serverTimestamp()
            }
        );
    }

    return {
        success: true,
        alreadyProcessed: false,
        changes: result.changes
    };
}

export async function listInventoryMovements(
    productId = null,
    maxResults = 100
) {
    let movementQuery;

    if (productId) {
        movementQuery = query(
            collection(
                db,
                MOVEMENTS_COLLECTION
            ),
            where(
                'productId',
                '==',
                productId
            ),
            orderBy(
                'createdAt',
                'desc'
            ),
            limit(maxResults)
        );
    } else {
        movementQuery = query(
            collection(
                db,
                MOVEMENTS_COLLECTION
            ),
            orderBy(
                'createdAt',
                'desc'
            ),
            limit(maxResults)
        );
    }

    const snapshot =
        await getDocs(
            movementQuery
        );

    return snapshot.docs.map(
        item => ({
            id: item.id,
            ...serialize(
                item.data()
            )
        })
    );
}
