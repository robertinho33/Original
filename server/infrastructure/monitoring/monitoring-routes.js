'use strict';

const express =
  require('express');

const metrics =
  require('../../observability/metrics');

const {
  getReadiness
} = require('../../observability/readiness');

const router =
  express.Router();

router.get(
  '/metrics',
  (req, res) => {
    res.json({
      success: true,
      data: metrics.snapshot()
    });
  }
);

router.get(
  '/readiness',
  (req, res) => {
    const result =
      getReadiness();

    res
      .status(
        result.ready
          ? 200
          : 503
      )
      .json({
        success:
          result.ready,
        data:
          result
      });
  }
);

module.exports = router;
