'use strict';

const { requireAdmin } = require('../../core/admin-auth');
const { adminRateLimit } = require('../../core/admin-rate-limit');

const express =
  require('express');

const controller =
  require('./inventory-controller');

const router =
  express.Router();

router.get(
  '/',
  controller.list
);

router.get(
  '/reservations',
  controller.reservations
);

module.exports = router;

