'use strict';

function normalizeEmail(email) {
    return String(email || '')
        .trim()
        .toLowerCase();
}

function getCustomerKey(order) {
    const email = normalizeEmail(order?.customer?.email);

    if (email) {
        return `email:${email}`;
    }

    const name = String(
        order?.customer?.name || ''
    )
        .trim()
        .toLowerCase();

    const phone = String(
        order?.customer?.phone || ''
    )
        .replace(/\D/g, '');

    return `fallback:${name}|${phone}`;
}

export function buildCustomerSummaries(orders) {
    const customers = new Map();

    for (const order of Array.isArray(orders) ? orders : []) {
        const customer = order?.customer;

        if (!customer) {
            continue;
        }

        const key = getCustomerKey(order);

        if (!customers.has(key)) {
            customers.set(key, {
                id: key,
                name: String(
                    customer.name || 'Cliente não informado'
                ).trim(),
                email: normalizeEmail(customer.email),
                phone: String(
                    customer.phone || ''
                ).trim(),
                ordersCount: 0,
                totalSpent: 0,
                lastOrderAt: null,
                lastOrderId: null,
                orders: []
            });
        }

        const summary = customers.get(key);

        const total = Number(order?.total || 0);

        summary.ordersCount += 1;
        summary.totalSpent += Number.isFinite(total)
            ? total
            : 0;

        summary.orders.push({
            id: order?.id || order?.orderId || '',
            createdAt: order?.createdAt || null,
            total: Number.isFinite(total) ? total : 0,
            status: order?.status || 'new',
            paymentStatus:
                order?.payment?.status || 'pending',
            logisticsStatus:
                order?.logistics?.status || 'new'
        });

        const orderDate = new Date(
            order?.createdAt || 0
        );

        const lastOrderDate = summary.lastOrderAt
            ? new Date(summary.lastOrderAt)
            : null;

        if (
            orderDate.getTime() &&
            (
                !lastOrderDate ||
                orderDate.getTime() > lastOrderDate.getTime()
            )
        ) {
            summary.lastOrderAt =
                order.createdAt || null;

            summary.lastOrderId =
                order?.id ||
                order?.orderId ||
                null;
        }
    }

    return [...customers.values()]
        .map(customer => ({
            ...customer,
            orders: [...customer.orders].sort(
                (a, b) => {
                    const dateA =
                        new Date(a.createdAt || 0).getTime();

                    const dateB =
                        new Date(b.createdAt || 0).getTime();

                    return dateB - dateA;
                }
            )
        }))
        .sort((a, b) => {
            const dateA =
                new Date(a.lastOrderAt || 0).getTime();

            const dateB =
                new Date(b.lastOrderAt || 0).getTime();

            return dateB - dateA;
        });
}