"use strict";

const service = require("../services/admin-core-service");

async function dashboard(req, res, next) {
    try {
        const data = await service.getDashboard();

        res.json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
}

async function orders(req, res, next) {
    try {
        const data = await service.getOrders();

        res.json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
}

async function products(req, res, next) {
    try {
        const data = await service.getProducts();

        res.json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
}

async function customers(req, res, next) {
    try {
        const data = await service.getCustomers();

        res.json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
}

async function tracking(req, res, next) {
    try {
        const data = await service.getTracking();

        res.json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    dashboard,
    orders,
    products,
    customers,
    tracking
};