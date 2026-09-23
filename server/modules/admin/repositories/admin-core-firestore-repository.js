"use strict";

const { getFirestore } = require("../../../infrastructure/firebase/firebase-admin");

const db = getFirestore();

async function getCollection(name) {
    const snapshot = await db.collection(name).get();

    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
    }));
}

async function getDashboardData() {
    const [
        orders,
        products,
        users,
        tracking
    ] = await Promise.all([
        getCollection("orders"),
        getCollection("products"),
        getCollection("users"),
        getCollection("orderTracking")
    ]);

    return {
        orders,
        products,
        users,
        tracking
    };
}

async function getOrders() {
    return getCollection("orders");
}

async function getProducts() {
    return getCollection("products");
}

async function getCustomers() {
    return getCollection("users");
}

async function getTracking() {
    return getCollection("orderTracking");
}

module.exports = {
    getCollection,
    getDashboardData,
    getOrders,
    getProducts,
    getCustomers,
    getTracking
};