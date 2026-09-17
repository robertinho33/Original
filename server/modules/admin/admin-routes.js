const express = require("express");

const controller = require("./controllers/admin-controller");

const router = express.Router();

router.get("/dashboard", controller.dashboard);
router.get("/orders", controller.orders);
router.get("/products", controller.products);
router.get("/categories", controller.categories);
router.get("/inventory", controller.inventory);
router.get("/customers", controller.customers);
router.get("/finance", controller.finance);
router.get("/coupons", controller.coupons);
router.get("/logistics", controller.logistics);
router.get("/reports", controller.reports);
router.get("/audit", controller.audit);
router.get("/settings", controller.settings);

module.exports = router;
