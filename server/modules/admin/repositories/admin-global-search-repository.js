"use strict";

const {
    getFirestore
} = require("../../../infrastructure/firebase/firebase-admin");

const COLLECTIONS = [
    "orders",
    "products",
    "users",
    "categories"
];

function db() {
    return getFirestore();
}

async function getCollection(name) {
    const snapshot = await db()
        .collection(name)
        .get();

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

function normalize(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function matches(item, term) {
    const search = normalize(term);

    if (!search) {
        return false;
    }

    return normalize(JSON.stringify(item)).includes(search);
}

async function search(term) {
    const results = [];

    for (const collection of COLLECTIONS) {
        const items = await getCollection(collection);

        for (const item of items) {
            if (!matches(item, term)) {
                continue;
            }

            results.push({
                ...item,
                collection
            });
        }
    }

    return results;
}

module.exports = {
    search
};
