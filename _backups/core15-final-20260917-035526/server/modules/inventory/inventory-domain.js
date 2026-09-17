'use strict';

const { AppError } = require('../../core/app-error');
const {
  reserveStock,
  releaseStock
} = require('./inventory-service');

function reserveProductStock(product, quantity) {
  if (!product) {
    throw new AppError(
      'Produto não encontrado.',
      {
        code: 'PRODUCT_NOT_FOUND',
        status: 404
      }
    );
  }

  return {
    ...product,
    stock: reserveStock({
      available: product.stock,
      quantity
    })
  };
}

function releaseProductStock(product, quantity) {
  if (!product) {
    throw new AppError(
      'Produto não encontrado.',
      {
        code: 'PRODUCT_NOT_FOUND',
        status: 404
      }
    );
  }

  return {
    ...product,
    stock: releaseStock({
      available: product.stock,
      quantity
    })
  };
}

module.exports = {
  reserveProductStock,
  releaseProductStock
};
