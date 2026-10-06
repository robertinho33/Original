"use strict";

const express = require("express");

const adminAuth =
    require("./admin-auth");

const adminCoreController = require("./controllers/admin-core-controller");

const adminController =
    require("./controllers/admin-controller");

const overviewController =
    require("./controllers/admin-overview-controller");

const influencerController =
    require("./controllers/influencer-controller");

const partnershipController = require("./controllers/partnership-controller");
const contractController = require("./controllers/influencer-contract-controller");
const commissionController = require("./controllers/commission-controller");
const marketingController = require("./controllers/marketing-controller");

const globalSearchController =
    require("./controllers/admin-global-search-controller");

const firestoreRepository =
    require("./repositories/admin-firestore-report-repository");

const router = express.Router();

const adminWriteController = require("./controllers/admin-write-controller");
router.use(adminAuth);
/* COLLABORATOR_SCOPE */
router.use((req, res, next) => {
    if (req.admin?.role !== "collaborator") return next();
    const readOnlyPaths = new Set(["/access", "/partnerships/overview", "/contracts", "/influencers", "/commissions", "/marketing/hero", "/marketing/campaigns", "/catalog/visibility"]);
    const mayPrepareDraft = (req.method === "POST" && ["/contracts", "/marketing/audience", "/marketing/campaigns"].includes(req.path)) || (req.method === "PUT" && req.path === "/marketing/hero");
    if ((req.method === "GET" && readOnlyPaths.has(req.path)) || mayPrepareDraft) return next();
    return res.status(403).json({ success: false, error: "Colaboradores podem consultar e preparar rascunhos. A ativação e o encerramento cabem ao administrador." });
});

/* ============================================================
   PRINCIPAIS MÓDULOS
   ============================================================ */

router.get("/dashboard", adminController.dashboard);
router.get("/core/dashboard", adminCoreController.dashboard);
router.get("/core/orders", adminCoreController.orders);
router.get("/core/products", adminCoreController.products);
router.get("/core/customers", adminCoreController.customers);
router.get("/core/tracking", adminCoreController.tracking);
router.get("/orders", adminController.orders);
router.get("/products", adminController.products);
router.get("/categories", adminController.categories);
router.get("/inventory", adminController.inventory);
router.get("/customers", adminController.customers);
router.get("/finance", adminController.finance);
router.get("/coupons", adminController.coupons);

router.get("/access", (req, res) => res.json({ success: true, data: { role: req.admin?.role || "admin", email: req.admin?.email || "" } }));
router.get("/partnerships/overview", partnershipController.overview);
router.get("/commissions", commissionController.list);
router.post("/commissions/sync", commissionController.sync);
router.put("/commissions/:id/paid", commissionController.markPaid);
router.get("/contracts", contractController.list);
router.post("/contracts", contractController.create);
router.put("/contracts/:id/activate", contractController.activate);
router.put("/contracts/:id/end", contractController.end);
router.get("/influencers", influencerController.list);
router.get("/influencers/:id", influencerController.get);
router.post("/influencers", influencerController.create);
router.put("/influencers/:id", influencerController.update);
router.delete("/influencers/:id", influencerController.remove);
router.get("/marketing/hero", marketingController.hero);
router.put("/marketing/hero", marketingController.saveHero);
router.put("/marketing/hero/activate", marketingController.activateHero);
router.get("/marketing/campaigns", marketingController.campaigns);
router.post("/marketing/audience", marketingController.previewAudience);
router.post("/marketing/campaigns", marketingController.createCampaign);
router.put("/marketing/campaigns/:id/launch", marketingController.launchCampaign);
router.post("/coupons",adminController.createCoupon);
router.post(
    "/inventory/movement",
    adminWriteController.createInventoryMovement
);
router.put("/coupons/:id",adminController.updateCoupon);
router.delete("/coupons/:id",adminController.deleteCoupon);
router.get("/logistics", adminController.logistics);
router.get("/reports", adminController.reports);
router.get("/audit", adminController.audit);
router.get("/settings", adminController.settings);
const catalogVisibilityController = require("../catalog/catalog-visibility-controller");
router.get("/catalog/visibility", catalogVisibilityController.adminRead);
router.put("/catalog/sources/:id/visibility", catalogVisibilityController.updateSource);
router.put("/catalog/products/:id/visibility", catalogVisibilityController.updateProduct);

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
   RELATÓRIOS — FIRESTORE
   ============================================================ */

router.get(
    "/reports/sales",
    async (req, res) => {
        try {
            res.json({
                success: true,
                data: await firestoreRepository.salesReport()
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
                data: await firestoreRepository.productReport()
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
                data: await firestoreRepository.customerReport()
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
                data: await firestoreRepository.getOrderHistory(
                    req.params.id
                )
            });
        } catch (error) {
            console.error(
                "[ADMIN ORDER HISTORY]",
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
    "/customers/:id/history",
    async (req, res) => {
        try {
            res.json({
                success: true,
                data:
                    await firestoreRepository
                        .getCustomerCommercialHistory(
                            req.params.id
                        )
            });
        } catch (error) {
            console.error(
                "[ADMIN CUSTOMER HISTORY]",
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
   ESTOQUE
   ============================================================ */

router.get(
    "/inventory/movements",
    async (req, res) => {
        try {
            res.json({
                success: true,
                data:
                    await firestoreRepository
                        .getInventoryMovements()
            });
        } catch (error) {
            console.error(
                "[ADMIN INVENTORY MOVEMENTS]",
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
   LOGÍSTICA
   ============================================================ */

router.get(
    "/logistics/queue",
    async (req, res) => {
        try {
            res.json({
                success: true,
                data:
                    await firestoreRepository
                        .getShippingQueue()
            });
        } catch (error) {
            console.error(
                "[ADMIN SHIPPING QUEUE]",
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
   FINANCEIRO
   ============================================================ */

router.get(
    "/finance/overview",
    async (req, res) => {
        try {
            res.json({
                success: true,
                data:
                    await firestoreRepository
                        .getFinancialOverview()
            });
        } catch (error) {
            console.error(
                "[ADMIN FINANCE OVERVIEW]",
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
   BUSCA GLOBAL
   ============================================================ */

router.get(
    "/search",
    globalSearchController.search
);

module.exports = router;
