'use strict';

const fs = require('fs');
const path = require('path');

function findCatalogFile() {
  const candidates = [
    path.resolve(process.cwd(), 'data/catalog/catalog-runtime.json'),
    path.resolve(process.cwd(), 'data/catalog.json'),
    path.resolve(process.cwd(), 'produtos.json')
  ];

  return candidates.find(fs.existsSync) || null;
}

function loadCatalog() {
  const file = findCatalogFile();

  if (!file) {
    return [];
  }

  const raw = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(raw);

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data.products)) {
    return data.products;
  }

  if (Array.isArray(data.produtos)) {
    return data.produtos;
  }

  return [];
}

function getProductSku(product) {
  return product?.SKU ??
         product?.sku ??
         product?.Sku ??
         product?.id ??
         null;
}

function getProductPrice(product) {
  return product?.Preço ??
         product?.preco ??
         product?.price ??
         product?.Price ??
         null;
}

function getProductStock(product) {
  return product?.Estoque ??
         product?.estoque ??
         product?.stock ??
         product?.Stock ??
         null;
}

function findProductBySku(sku) {
  const catalog = loadCatalog();

  return catalog.find(product => {
    return String(getProductSku(product)) === String(sku);
  }) || null;
}

module.exports = {
  findCatalogFile,
  loadCatalog,
  findProductBySku,
  getProductSku,
  getProductPrice,
  getProductStock
};
