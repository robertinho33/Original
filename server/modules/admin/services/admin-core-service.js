"use strict";

const repository = require("../repositories/admin-core-firestore-repository");

async function getDashboard() {
    return repository.getDashboardData();
}

async function getOrders() {
    return repository.getOrders();
}

async function getProducts() {
    return repository.getProducts();
}

async function getCustomers() {
    return repository.getCustomers();
}

async function getTracking() {
    return repository.getTracking();
}

module.exports = {
    getDashboard,
    getOrders,
    getProducts,
    getCustomers,
    getTracking
};