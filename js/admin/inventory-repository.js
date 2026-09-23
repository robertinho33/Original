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
    runTransaction,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const PRODUCTS_COLLECTION = 'products';
const MOVEMENTS_COLLECTION = 'inventoryMovements';

function normalizeQuantity(value) {
    const quantity = Number(value);

    if (!Number.isFinite(quantity)) {
        throw new Error('Quantidade inválida.');
    }

    if (!Number.isInteger(quantity)) {
        throw new Error('A quantidade deve ser um número inteiro.');
    }

    if (quantity < 0) {
        throw new Error('A quantidade não pode ser negativa.');
    }

    return quantity;
}

function getStockStatus(stock, minimumStock) {
    if (stock <= 0) {
        return 'ZERADO';
    }

    if (stock <= minimumStock) {
        return 'BAIXO';
    }

    return 'OK';
}

function serialize(value) {
    if (value && typeof value.toDate === 'function') {
        return value.toDate().toISOString();
    }

    return value;
}

export async function listInventory() {
    const snapshot = await getDocs(
        collection(db, PRODUCTS_COLLECTION)
    );

    return snapshot.docs
        .map(item => {
            const data = item.data();

            const stock = Number(data.stock) || 0;
            const minimumStock =
                Number(data.minimumStock) || 0;

            return {
                id: item.id,
                sku: data.sku || '',
                name: data.name || '',
                image: data.image || '',
                categoryId: data.categoryId || '',
                categoryName: data.categoryName || '',
                active: data.active !== false,
                stock,
                minimumStock,
                status: getStockStatus(
                    stock,
                    minimumStock
                )
            };
        })
        .sort(
            (a, b) =>
                a.name.localeCompare(
                    b.name,
                    'pt-BR'
                )
        );
}

export async function getInventoryItem(productId) {
    const reference = doc(
        db,
        PRODUCTS_COLLECTION,
        productId
    );

    const snapshot = await getDoc(reference);

    if (!snapshot.exists()) {
        throw new Error('Produto não encontrado.');
    }

    const data = snapshot.data();

    const stock = Number(data.stock) || 0;
    const minimumStock =
        Number(data.minimumStock) || 0;

    return {
        id: snapshot.id,
        sku: data.sku || '',
        name: data.name || '',
        image: data.image || '',
        categoryId: data.categoryId || '',
        categoryName: data.categoryName || '',
        active: data.active !== false,
        stock,
        minimumStock,
        status: getStockStatus(
            stock,
            minimumStock
        )
    };
}

export async function updateInventory(
    productId,
    quantity,
    type = 'adjustment',
    reason = ''
) {
    const normalizedQuantity =
        normalizeQuantity(quantity);

    const validTypes = [
        'entry',
        'exit',
        'adjustment'
    ];

    if (!validTypes.includes(type)) {
        throw new Error(
            'Tipo de movimentação inválido.'
        );
    }

    const productReference = doc(
        db,
        PRODUCTS_COLLECTION,
        productId
    );

    const movementReference = doc(
        collection(
            db,
            MOVEMENTS_COLLECTION
        )
    );

    return runTransaction(
        db,
        async transaction => {
            const productSnapshot =
                await transaction.get(
                    productReference
                );

            if (!productSnapshot.exists()) {
                throw new Error(
                    'Produto não encontrado.'
                );
            }

            const product =
                productSnapshot.data();

            const previousStock =
                Number(product.stock) || 0;

            let finalStock;

            if (type === 'entry') {
                finalStock =
                    previousStock +
                    normalizedQuantity;
            }

            if (type === 'exit') {
                finalStock =
                    previousStock -
                    normalizedQuantity;

                if (finalStock < 0) {
                    throw new Error(
                        `Estoque insuficiente. Disponível: ${previousStock}.`
                    );
                }
            }

            if (type === 'adjustment') {
                finalStock =
                    normalizedQuantity;
            }

            const minimumStock =
                Number(product.minimumStock) || 0;

            const now =
                new Date().toISOString();

            transaction.update(
                productReference,
                {
                    stock: finalStock,
                    updatedAt: now
                }
            );

            transaction.set(
                movementReference,
                {
                    productId,
                    sku: product.sku || '',
                    productName:
                        product.name || '',
                    type,
                    quantity:
                        normalizedQuantity,
                    previousStock,
                    finalStock,
                    minimumStock,
                    reason:
                        String(
                            reason || ''
                        ).trim(),
                    createdAt:
                        serverTimestamp()
                }
            );

            return {
                productId,
                sku: product.sku || '',
                name: product.name || '',
                previousStock,
                quantity:
                    normalizedQuantity,
                finalStock,
                minimumStock,
                status:
                    getStockStatus(
                        finalStock,
                        minimumStock
                    )
            };
        }
    );
}

export async function listInventoryMovements(
    productId = null,
    maxResults = 100
) {
    const safeLimit =
        Math.max(
            1,
            Math.min(
                Number(maxResults) || 100,
                500
            )
        );

    const movementsReference =
        collection(
            db,
            MOVEMENTS_COLLECTION
        );

    const constraints = [];

    if (productId) {
        constraints.push(
            where(
                'productId',
                '==',
                productId
            )
        );
    }

    constraints.push(
        orderBy(
            'createdAt',
            'desc'
        )
    );

    constraints.push(
        limit(safeLimit)
    );

    const snapshot =
        await getDocs(
            query(
                movementsReference,
                ...constraints
            )
        );

    return snapshot.docs.map(item => ({
        id: item.id,
        ...Object.fromEntries(
            Object.entries(item.data())
                .map(
                    ([key, value]) => [
                        key,
                        serialize(value)
                    ]
                )
        )
    }));
}