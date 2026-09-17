const adminService = require("../services/admin-service");

async function dashboard(req, res, next) {
    try {
        res.json({
            success: true,
            data: await adminService.getDashboard()
        });
    } catch (error) {
        next(error);
    }
}

async function orders(req, res, next) {
    try {
        res.json({
            success: true,
            data: await adminService.getOrders()
        });
    } catch (error) {
        next(error);
    }
}

async function products(req, res, next) {
    try {
        res.json({
            success: true,
            data: await adminService.getProducts()
        });
    } catch (error) {
        next(error);
    }
}

async function categories(req, res, next) {
    try {
        res.json({
            success: true,
            data: await adminService.getCategories()
        });
    } catch (error) {
        next(error);
    }
}

async function inventory(req, res, next) {
    try {
        res.json({
            success: true,
            data: await adminService.getInventory()
        });
    } catch (error) {
        next(error);
    }
}

async function customers(req, res, next) {
    try {
        res.json({
            success: true,
            data: await adminService.getCustomers()
        });
    } catch (error) {
        next(error);
    }
}

async function finance(req, res, next) {
    try {
        res.json({
            success: true,
            data: await adminService.getFinance()
        });
    } catch (error) {
        next(error);
    }
}

async function coupons(req, res, next) {
    try {
        res.json({
            success: true,
            data: await adminService.getCoupons()
        });
    } catch (error) {
        next(error);
    }
}

async function logistics(req, res, next) {
    try {
        res.json({
            success: true,
            data: await adminService.getLogistics()
        });
    } catch (error) {
        next(error);
    }
}

async function reports(req, res, next) {
    try {
        res.json({
            success: true,
            data: await adminService.getReports()
        });
    } catch (error) {
        next(error);
    }
}

async function audit(req, res, next) {
    try {
        res.json({
            success: true,
            data: await adminService.getAudit()
        });
    } catch (error) {
        next(error);
    }
}

async function settings(req, res, next) {
    try {
        res.json({
            success: true,
            data: await adminService.getSettings()
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    dashboard,
    orders,
    products,
    categories,
    inventory,
    customers,
    finance,
    coupons,
    logistics,
    reports,
    audit,
    settings
};
