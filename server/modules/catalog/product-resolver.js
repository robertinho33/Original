'use strict';

const {isProductAuthorized}=require('../../../js/catalog/source-authorization');
const {loadCatalog}=require('./catalog-service');
let sourceBySku;
function assertAuthorizedProduct(product){
 if(!sourceBySku)sourceBySku=new Map(loadCatalog().map(p=>[String(p.sku||p.SKU||'').trim().toLowerCase(),p.sourceId]));
 const sourceId=product.sourceId||sourceBySku.get(String(product.sku||product.SKU||'').trim().toLowerCase());
 if(product.active===false||!isProductAuthorized({...product,sourceId}))throw new AppError('Este produto não está disponível para venda na loja.',{code:'PRODUCT_NOT_AVAILABLE',status:409});
 return product;
}
const { AppError } = require('../../core/app-error');

const {
  getFirestore
} = require('../../infrastructure/firebase/firebase-admin');

const {
  getProductSku,
  getProductPrice,
  getProductStock
} = require('./catalog-service');

function normalizePrice(value) {
  if (typeof value === 'number') {
    return value;
  }

  const normalized = String(value ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(/^R\$/i, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const price = Number(normalized);

  return Number.isFinite(price) ? price : NaN;
}

function normalizeStock(value) {
  const stock = Number(value);

  return Number.isInteger(stock) && stock >= 0
    ? stock
    : NaN;
}

async function findProductBySku(sku) {
  const db = getFirestore();

  const snapshot = await db
    .collection('products')
    .where('sku', '==', String(sku))
    .limit(1)
    .get();

  if (!snapshot.empty) {
    const doc = snapshot.docs[0];

    return {
      id: doc.id,
      ...doc.data()
    };
  }

  const fallbackSnapshot = await db
    .collection('products')
    .get();

  const product = fallbackSnapshot.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    .find(item => {
      return String(getProductSku(item)) === String(sku);
    });

  return product || null;
}

async function resolveProduct(sku, quantity) {
  const product = await findProductBySku(sku);

  if (!product) {
    throw new AppError(
      `Produto ${sku} não encontrado.`,
      {
        code: 'PRODUCT_NOT_FOUND',
        status: 404
      }
    );
  }

  assertAuthorizedProduct(product);

  const unitPrice = normalizePrice(
    getProductPrice(product)
  );

  const stock = normalizeStock(
    getProductStock(product)
  );

  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new AppError(
      `Preço inválido para ${sku}.`,
      {
        code: 'PRODUCT_PRICE_INVALID',
        status: 500
      }
    );
  }

  if (!Number.isInteger(stock)) {
    throw new AppError(
      `Estoque inválido para ${sku}.`,
      {
        code: 'PRODUCT_STOCK_INVALID',
        status: 500
      }
    );
  }

  if (quantity > stock) {
    throw new AppError(
      `Estoque insuficiente para ${sku}.`,
      {
        code: 'INSUFFICIENT_STOCK',
        status: 409,
        details: {
          sku,
          available: stock,
          requested: quantity
        }
      }
    );
  }

  return {
    sku: getProductSku(product),
    name:
      product.name ??
      product.nome ??
      product.Produto ??
      product.produto ??
      '',
    quantity,
    unitPrice,
    stock
  };
}

module.exports = {
  findProductBySku,
  assertAuthorizedProduct,
  resolveProduct,
  normalizePrice,
  normalizeStock
};
