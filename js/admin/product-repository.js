'use strict';

import { db } from '../firebase-config.js';

import {
    collection,
    addDoc,
    getDocs,
    getDoc,
    doc,
    query,
    where,
    limit,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

import {
    normalizeProduct,
    validateProduct
} from './product-model.js';

const PRODUCTS_COLLECTION = 'products';

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
        const result = {};

        for (
            const [key, item]
            of Object.entries(value)
        ) {
            result[key] =
                serialize(item);
        }

        return result;
    }

    return value;
}

async function skuExists(
    sku,
    ignoreId = null
) {

    const normalizedSku =
        String(sku || '')
            .trim()
            .toUpperCase();

    if (!normalizedSku) {
        return false;
    }

    const snapshot =
        await getDocs(
            query(
                collection(
                    db,
                    PRODUCTS_COLLECTION
                ),
                where(
                    'sku',
                    '==',
                    normalizedSku
                ),
                limit(2)
            )
        );

    return snapshot.docs.some(
        item => item.id !== ignoreId
    );
}

export async function createProduct(
    input
) {

    const product =
        normalizeProduct(input);

    const validation =
        validateProduct(product);

    if (!validation.valid) {
        throw new Error(
            validation.errors.join(' ')
        );
    }

    if (
        await skuExists(product.sku)
    ) {
        throw new Error(
            `SKU já cadastrado: ${product.sku}`
        );
    }

    const now =
        new Date().toISOString();

    const payload = {
        ...product,

        createdAt: now,
        updatedAt: now
    };

    const reference =
        await addDoc(
            collection(
                db,
                PRODUCTS_COLLECTION
            ),
            payload
        );

    return {
        id: reference.id,
        ...payload
    };
}

export async function listProducts() {

    const snapshot =
        await getDocs(
            collection(
                db,
                PRODUCTS_COLLECTION
            )
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

export async function getProduct(
    productId
) {

    const snapshot =
        await getDoc(
            doc(
                db,
                PRODUCTS_COLLECTION,
                productId
            )
        );

    if (!snapshot.exists()) {
        return null;
    }

    return {
        id: snapshot.id,
        ...serialize(
            snapshot.data()
        )
    };
}

export async function updateProduct(
    productId,
    input
) {

    const existing =
        await getProduct(productId);

    if (!existing) {
        throw new Error(
            'Produto não encontrado.'
        );
    }

    const product =
        normalizeProduct({
            ...existing,
            ...input
        });

    const validation =
        validateProduct(product);

    if (!validation.valid) {
        throw new Error(
            validation.errors.join(' ')
        );
    }

    if (
        product.sku !== existing.sku &&
        await skuExists(
            product.sku,
            productId
        )
    ) {
        throw new Error(
            `SKU já cadastrado: ${product.sku}`
        );
    }

    const payload = {
        ...product,
        updatedAt:
            new Date().toISOString()
    };

    await updateDoc(
        doc(
            db,
            PRODUCTS_COLLECTION,
            productId
        ),
        payload
    );

    return {
        id: productId,
        ...payload
    };
}

export async function deleteProduct(
    productId
) {

    const existing =
        await getProduct(productId);

    if (!existing) {
        throw new Error(
            'Produto não encontrado.'
        );
    }

    await deleteDoc(
        doc(
            db,
            PRODUCTS_COLLECTION,
            productId
        )
    );

    return {
        id: productId,
        deleted: true
    };
}

export async function setProductActive(
    productId,
    active
) {

    const existing =
        await getProduct(productId);

    if (!existing) {
        throw new Error(
            'Produto não encontrado.'
        );
    }

    await updateDoc(
        doc(
            db,
            PRODUCTS_COLLECTION,
            productId
        ),
        {
            active:
                Boolean(active),

            updatedAt:
                new Date().toISOString()
        }
    );

    return {
        id: productId,
        active:
            Boolean(active)
    };
}
