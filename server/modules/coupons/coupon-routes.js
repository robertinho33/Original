'use strict';

const express = require('express');
const {
  validateCoupon
} = require('./coupon-service');

const router = express.Router();

router.get('/validate', async (req, res) => {
  try {
    const result = await validateCoupon(req.query.code);

    if (!result.valid) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error(
      '[NEFER COUPON] erro ao validar cupom:',
      error
    );

    return res.status(500).json({
      valid: false,
      message: 'Não foi possível validar o cupom.'
    });
  }
});

module.exports = router;
