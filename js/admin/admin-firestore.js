'use strict';

export { db } from '../firebase-config.js';
import { db } from '../firebase-config.js';

import {
    collection,
    getDocs,
    getDoc,
    doc
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const COLLECTIONS = Object.freeze([
    'products',
    'categories',
    'orders',
    'customers',
    'inventory',
    'coupons',
    'finance',
    'logistics',
    'audit',
    'settings'
]);

function serializeValue(value) {

    if (
        value &&
        typeof value.toDate === 'function'
    ) {
        return value.toDate().toISOString();
    }

    if (Array.isArray(value)) {
        return value.map(serializeValue);
    }

    if (
        value &&
        typeof value === 'object'
    ) {
        const result = {};

        for (const [key, item] of Object.entries(value)) {
            result[key] = serializeValue(item);
        }

        return result;
    }

    return value;
}

export async function getCollection(
    collectionName
) {

    if (!COLLECTIONS.includes(collectionName)) {
        throw new Error(
            `Coleção administrativa inválida: ${collectionName}`
        );
    }

    const snapshot = await getDocs(
        collection(db, collectionName)
    );

    return snapshot.docs.map(item => ({
        id: item.id,
        ...serializeValue(item.data())
    }));
}

export async function getDocument(
    collectionName,
    documentId
) {

    if (!COLLECTIONS.includes(collectionName)) {
        throw new Error(
            `Coleção administrativa inválida: ${collectionName}`
        );
    }

    const snapshot = await getDoc(
        doc(
            db,
            collectionName,
            documentId
        )
    );

    if (!snapshot.exists()) {
        return null;
    }

    return {
        id: snapshot.id,
        ...serializeValue(snapshot.data())
    };
}

export async function getAdminFirestoreHealth() {

    const results = {};

    for (const collectionName of COLLECTIONS) {

        try {

            const items =
                await getCollection(collectionName);

            results[collectionName] = {
                ok: true,
                count: items.length
            };

        } catch (error) {

            results[collectionName] = {
                ok: false,
                count: 0,
                error: error?.message ||
                    'Erro desconhecido'
            };
        }
    }

    return {
        ok: true,
        projectId: 'base-total',
        collections: results,
        checkedAt: new Date().toISOString()
    };
}

export {
    COLLECTIONS
};
