'use strict';

const { requireAdmin } = require('../../core/admin-auth');
const { adminRateLimit } = require('../../core/admin-rate-limit');

const express =
  require('express');

const { inventoryRoutes } = require('../inventory');

const controller =
  require('./controllers/admin-controller');

const router =
  express.Router();

router.get(
  '/dashboard',
  controller.dashboard
);

router.get(
  '/orders',
  controller.orders
);

router.get(
  '/orders/:orderNumber',
  controller.order
);

router.get(
  '/audit',
  controller.audit
);

router.get(
  '/orders/:orderNumber/timeline',
  controller.orderTimeline
);

module.exports = router;



