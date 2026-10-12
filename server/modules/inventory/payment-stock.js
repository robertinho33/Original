'use strict';

// Called only after the provider has authenticated and verified the payment.
// All reads precede writes; the order marker belongs to the same transaction.
async function commitPaidStock(db, tx, order, { testMode = false } = {}) {
  if (testMode || order.stockCommitted === true) return {};
  const quantities = new Map();
  for (const item of order.items || []) {
    const sku = String(item.sku || '').trim();
    const quantity = Number(item.quantity);
    if (!sku || !Number.isSafeInteger(quantity) || quantity <= 0) return { 'stock.status': 'review_required', 'stock.reviewRequired': true, 'stock.reviewReason': 'Item inválido para baixa de estoque.' };
    quantities.set(sku, (quantities.get(sku) || 0) + quantity);
  }
  if (!quantities.size) return { 'stock.status': 'review_required', 'stock.reviewRequired': true, 'stock.reviewReason': 'Pedido sem itens.' };
  const reads = [];
  for (const [sku, quantity] of quantities) {
    const products = await tx.get(db.collection('products').where('sku', '==', sku).limit(2));
    if (products.docs.length !== 1) return { 'stock.status': 'review_required', 'stock.reviewRequired': true, 'stock.reviewReason': `Produto ausente ou duplicado: ${sku}.` };
    const product = products.docs[0];
    const inventoryRef = db.collection('inventory').doc(sku);
    const inventory = await tx.get(inventoryRef);
    const data = inventory.exists ? inventory.data() : {};
    const stock = Number(data.quantity ?? product.data().stock);
    const reserved = Number(data.reserved ?? 0);
    const owned = order.stock?.status === 'reserved' ? (order.stock.reservations || [])
      .filter(item => item.kind === 'inventory' && item.sku === sku).reduce((sum, item) => sum + Number(item.quantity), 0) : 0;
    if (!Number.isSafeInteger(stock) || !Number.isSafeInteger(reserved) || reserved < 0 ||
        !Number.isSafeInteger(owned) || (owned && owned !== quantity) || reserved < owned || stock - reserved + owned < quantity) {
      return { 'stock.status': 'review_required', 'stock.reviewRequired': true,
        'stock.reviewReason': `Estoque insuficiente ou inconsistente: ${sku}.` };
    }
    reads.push({ sku, quantity, product, inventoryRef, stock, reserved: reserved - owned });
  }
  const timestamp = new Date().toISOString();
  for (const item of reads) {
    const stock = item.stock - item.quantity;
    tx.update(item.product.ref, { stock, updatedAt: timestamp });
    tx.set(item.inventoryRef, { sku: item.sku, productId: item.product.id,
      quantity: stock, reserved: item.reserved, available: stock - item.reserved,
      updatedAt: timestamp }, { merge: true });
    tx.set(db.collection('settings').doc('publicStock'), { stockAvailability: { [item.sku]: stock - item.reserved } }, { merge: true });
    tx.set(db.collection('inventoryMovements').doc(), { type: 'VENDA', sku: item.sku,
      quantity: -item.quantity, previousStock: item.stock, newStock: stock,
      orderId: order.orderNumber, createdAt: timestamp, source: 'verified-payment' });
  }
  return { stockCommitted: true, stockCommittedAt: timestamp, 'stock.status': 'committed' };
}

module.exports = { commitPaidStock };
