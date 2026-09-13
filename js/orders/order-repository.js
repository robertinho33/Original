'use strict';

const ORDER_STORAGE_KEY = 'aurea-orders';

export function saveOrder(order) {
    const orders = loadOrders();

    orders.push(order);

    localStorage.setItem(
        ORDER_STORAGE_KEY,
        JSON.stringify(orders)
    );

    return order;
}

export function loadOrders() {
    try {
        const stored = JSON.parse(
            localStorage.getItem(ORDER_STORAGE_KEY) || '[]'
        );

        return Array.isArray(stored)
            ? stored
            : [];

    } catch (error) {
        console.error(
            'Erro ao carregar pedidos:',
            error
        );

        return [];
    }
}

export function findOrderById(orderId) {
    return loadOrders().find(
        order => order.id === orderId
    ) || null;
}
