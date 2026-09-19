const express = require("express");

const adminAuth =
    require("./admin-auth");

const adminController =
    require("./controllers/admin-controller");

const overviewController =
    require("./controllers/admin-overview-controller");

const reportsRepository =
    require("./repositories/final-admin-repository");

const operationsRepository =
    require("./repositories/operations-overview-repository");

const commercialRepository =
    require("./repositories/commercial-history-repository");

const router = express.Router();

router.use(adminAuth);

/* ============================================================
   PRINCIPAIS MÓDULOS
   ============================================================ */

router.get(
    "/dashboard",
    adminController.dashboard
);

router.get(
    "/orders",
    adminController.orders
);

router.get(
    "/products",
    adminController.products
);

router.get(
    "/categories",
    adminController.categories
);

router.get(
    "/inventory",
    adminController.inventory
);

router.get(
    "/customers",
    adminController.customers
);

router.get(
    "/finance",
    adminController.finance
);

router.get(
    "/coupons",
    adminController.coupons
);

router.get(
    "/logistics",
    adminController.logistics
);

router.get(
    "/reports",
    adminController.reports
);

router.get(
    "/audit",
    adminController.audit
);

router.get(
    "/settings",
    adminController.settings
);

/* ============================================================
   DASHBOARD OPERACIONAL
   ============================================================ */

router.get(
    "/overview",
    overviewController.overview
);

router.get(
    "/overview/timeline",
    overviewController.timeline
);

router.get(
    "/overview/alerts",
    overviewController.alerts
);

/* ============================================================
   RELATÓRIOS
   ============================================================ */

router.get(
    "/reports/sales",
    async (req, res) => {
        try {
            res.json({
                success: true,
                data:
                    await reportsRepository.salesReport()
            });
        } catch (error) {
            console.error(
                "[ADMIN REPORT SALES]",
                error
            );

            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

router.get(
    "/reports/products",
    async (req, res) => {
        try {
            res.json({
                success: true,
                data:
                    await reportsRepository.productReport()
            });
        } catch (error) {
            console.error(
                "[ADMIN REPORT PRODUCTS]",
                error
            );

            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

router.get(
    "/reports/customers",
    async (req, res) => {
        try {
            res.json({
                success: true,
                data:
                    await reportsRepository.customerReport()
            });
        } catch (error) {
            console.error(
                "[ADMIN REPORT CUSTOMERS]",
                error
            );

            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/* ============================================================
   HISTÓRICO
   ============================================================ */

router.get(
    "/orders/:id/history",
    async (req, res) => {
        try {
            res.json({
                success: true,
                data:
                    await commercialRepository
                        .getOrderHistory(
                            req.params.id
                        )
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

router.get(
    "/customers/:id/history",
    async (req, res) => {
        try {
            res.json({
                success: true,
                data:
                    await commercialRepository
                        .getCustomerCommercialHistory(
                            req.params.id
                        )
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/* ============================================================
   ESTOQUE
   ============================================================ */

router.get(
    "/inventory/movements",
    async (req, res) => {
        try {
            res.json({
                success: true,
                data:
                    await operationsRepository
                        .getInventoryMovements()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/* ============================================================
   LOGÍSTICA
   ============================================================ */

router.get(
    "/logistics/queue",
    async (req, res) => {
        try {
            res.json({
                success: true,
                data:
                    await operationsRepository
                        .getShippingQueue()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/* ============================================================
   FINANCEIRO
   ============================================================ */

router.get(
    "/finance/overview",
    async (req, res) => {
        try {
            res.json({
                success: true,
                data:
                    await operationsRepository
                        .getFinancialOverview()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/* ============================================================
   BUSCA GLOBAL
   ============================================================ */

router.get(
    "/search",
    async (req, res) => {
        try {
            const term =
                String(
                    req.query.q || ""
                ).trim();

            if (term.length < 2) {
                return res.json({
                    success: true,
                    data: {
                        products: [],
                        customers: [],
                        orders: []
                    }
                });
            }

            res.json({
                success: true,
                data:
                    await reportsRepository
                        .globalSearch(term)
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

module.exports = router;
