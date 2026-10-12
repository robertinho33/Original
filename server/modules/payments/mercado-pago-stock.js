'use strict';
const { AppError } = require('../../core/app-error');
const { getProductPrice, getProductStock, getProductSku } = require('../catalog/catalog-service');
const { normalizePrice, normalizeStock } = require('../catalog/product-resolver');

function aggregateItems(items) {
  const grouped = new Map();
  for (const item of items || []) {
    const sku = String(item?.sku || item?.SKU || '').trim();
    const quantity = Number(item?.quantity);
    if (!sku || sku.length > 180 || !Number.isInteger(quantity) || quantity < 1) {
      throw new AppError('Produto ou quantidade inválidos.', { status: 400 });
    }
    grouped.set(sku, (grouped.get(sku) || 0) + quantity);
  }
  if (!grouped.size) throw new AppError('Selecione pelo menos um produto.', { status: 400 });
  return [...grouped].map(([sku, quantity]) => ({ sku, quantity }));
}

async function prepareReservation(db, order, mode) {
  if (!['production', 'production_inventory'].includes(mode)) return [];
  const plans = [];
  let fallback;
  for (const item of order.items) {
    const query = await db.collection('products').where('sku', '==', item.sku).limit(1).get();
    let document = query.docs[0];
    if (!document) {
      fallback ||= await db.collection('products').get();
      document = fallback.docs.find(doc => String(getProductSku({ id: doc.id, ...doc.data() })) === item.sku);
    }
    if (!document) throw new AppError('Um produto não está mais disponível.', { status: 409 });
    plans.push({ ref: document.ref, documentId: document.id, sku: item.sku,
      ...(mode === 'production_inventory' ? { inventoryRef: db.collection('inventory').doc(item.sku), publicRef: db.collection('settings').doc('publicStock') } : {}),
      quantity: item.quantity, unitPrice: item.unitPrice });
  }
  return plans;
}

async function reserveInTransaction(tx, plans) {
  if (!plans.length) return { status: 'not_reserved' };
  const snapshots = await Promise.all(plans.map(plan => tx.get(plan.ref)));
  const inventorySnapshots = await Promise.all(plans.map(plan => plan.inventoryRef ? tx.get(plan.inventoryRef) : null));
  const reservations = plans.map((plan, index) => {
    const snapshot = snapshots[index];
    if (!snapshot.exists) throw new AppError('Produto indisponível.', { status: 409 });
    const product = { id: plan.documentId, ...snapshot.data() };
    const inventory = inventorySnapshots[index]?.exists ? inventorySnapshots[index].data() : null;
    const stock = normalizeStock(inventory?.quantity ?? getProductStock(product));
    const reserved = Number(inventory?.reserved ?? 0);
    const price = normalizePrice(getProductPrice(product));
    if (String(getProductSku(product)) !== plan.sku || !Number.isFinite(stock) || !Number.isInteger(reserved) || reserved < 0 || stock - reserved < plan.quantity) {
      throw new AppError('Estoque insuficiente. Atualize sua sacola.', { status: 409 });
    }
    if (Math.round(price * 100) !== Math.round(plan.unitPrice * 100)) {
      throw new AppError('O preço foi atualizado. Confira sua sacola antes de pagar.', { status: 409 });
    }
    const field = ['Estoque', 'estoque', 'stock', 'Stock'].find(key => product[key] !== null && product[key] !== undefined);
    return { sku: plan.sku, documentId: plan.documentId, field, quantity: plan.quantity,
      ...(plan.inventoryRef ? { kind: 'inventory', physicalStock: stock, reserved: reserved + plan.quantity } : {}),
      remainingStock: stock - reserved - plan.quantity };
  });
  // Fazer todas as leituras e validações antes de qualquer escrita.
  reservations.forEach((item, index) => {
    if (item.kind === 'inventory') {
      tx.set(plans[index].inventoryRef, { sku: item.sku, productId: item.documentId,
        quantity: item.physicalStock, reserved: item.reserved, available: item.remainingStock,
        updatedAt: new Date().toISOString() }, { merge: true });
      tx.set(plans[index].publicRef, { stockAvailability: { [item.sku]: item.remainingStock } }, { merge: true });
    } else tx.update(plans[index].ref, { [item.field]: item.remainingStock });
  });
  return { status: 'reserved', reservedAt: new Date().toISOString(), reservations };
}

function validatePilot(order, env = process.env) {
  if (env.MP_REAL_SALE_TEST_ONLY !== 'true') {
    throw new AppError('Pagamento real ainda não está disponível.', { status: 503 });
  }
  const selectedSku = String(env.MP_REAL_SALE_TEST_SKU || '').trim();
  const maxTotal = Number(env.MP_REAL_SALE_TEST_MAX_TOTAL);
  const total = Number(order.totals.total);
  if (!selectedSku || !Number.isFinite(maxTotal) || maxTotal <= 0 ||
      !Number.isFinite(total) || total <= 0 ||
      order.items.length !== 1 || order.items[0].sku !== selectedSku || order.items[0].quantity !== 1 ||
      total > maxTotal) {
    throw new AppError('Confira os produtos e o valor autorizado para esta compra.', { status: 409 });
  }
}

async function releaseInTransaction(tx, db, reservation) {
  if (reservation?.status !== 'reserved') return false;
  const items = reservation.reservations;
  if (!Array.isArray(items) || !items.length) throw new Error('Reserva inválida.');
  if (items.every(item => item.kind === 'inventory')) {
    const refs = items.map(item => db.collection('inventory').doc(item.sku));
    const snapshots = await Promise.all(refs.map(ref => tx.get(ref)));
    const patches = items.map((item, index) => {
      const current = snapshots[index].exists ? snapshots[index].data() : null;
      if (!current || current.sku !== item.sku || !Number.isInteger(item.quantity) || item.quantity < 1 ||
          !Number.isInteger(current.reserved) || current.reserved < item.quantity || !Number.isInteger(current.quantity)) throw new Error('Reserva incompatível.');
      const reserved = current.reserved - item.quantity;
      return { reserved, available: current.quantity - reserved, updatedAt: new Date().toISOString() };
    });
    refs.forEach((ref, index) => {
      tx.set(ref, patches[index], { merge: true });
      tx.set(db.collection('settings').doc('publicStock'), { stockAvailability: { [items[index].sku]: patches[index].available } }, { merge: true });
    });
    return true;
  }
  const refs = items.map(item => db.collection('products').doc(item.documentId));
  const snapshots = await Promise.all(refs.map(ref => tx.get(ref)));
  const patches = items.map((item, index) => {
    const snapshot = snapshots[index];
    const product = snapshot.exists ? { id: item.documentId, ...snapshot.data() } : null;
    if (!product || String(getProductSku(product)) !== item.sku ||
        !['Estoque', 'estoque', 'stock', 'Stock'].includes(item.field) ||
        !Number.isInteger(item.quantity) || item.quantity < 1) throw new Error('Reserva incompatível.');
    const current = normalizeStock(getProductStock(product));
    if (!Number.isFinite(current) || current < 0 || product[item.field] === undefined) throw new Error('Estoque inválido.');
    return { [item.field]: current + item.quantity };
  });
  refs.forEach((ref, index) => tx.update(ref, patches[index]));
  return true;
}
module.exports = { aggregateItems, prepareReservation, reserveInTransaction, validatePilot, releaseInTransaction };
