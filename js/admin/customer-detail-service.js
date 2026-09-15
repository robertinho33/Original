'use strict';


function getOrderDate(order) {

    const timestamp =
        new Date(
            order?.createdAt || 0
        ).getTime();

    return Number.isFinite(timestamp)
        ? timestamp
        : 0;
}


function normalizeOrder(order) {

    const total =
        Number(order?.total || 0);

    return {
        id:
            String(
                order?.id ||
                order?.orderId ||
                ''
            ).trim(),

        createdAt:
            order?.createdAt || null,

        total:
            Number.isFinite(total)
                ? total
                : 0,

        status:
            order?.status || 'new',

        paymentStatus:
            order?.payment?.status || 'pending',

        logisticsStatus:
            order?.logistics?.status || 'new',

        items:
            Array.isArray(order?.items)
                ? order.items
                : []
    };
}


export function getCustomerDetail(
    customer,
    orders
) {

    if (!customer) {
        return null;
    }

    const customerOrders =
        (Array.isArray(orders)
            ? orders
            : []
        )
        .filter(order => {

            const emailA =
                String(
                    order?.customer?.email || ''
                )
                    .trim()
                    .toLowerCase();

            const emailB =
                String(
                    customer.email || ''
                )
                    .trim()
                    .toLowerCase();

            if (
                emailA &&
                emailB &&
                emailA === emailB
            ) {
                return true;
            }

            const nameA =
                String(
                    order?.customer?.name || ''
                )
                    .trim()
                    .toLowerCase();

            const nameB =
                String(
                    customer.name || ''
                )
                    .trim()
                    .toLowerCase();

            const phoneA =
                String(
                    order?.customer?.phone || ''
                )
                    .replace(/\D/g, '');

            const phoneB =
                String(
                    customer.phone || ''
                )
                    .replace(/\D/g, '');

            return (
                nameA === nameB &&
                phoneA === phoneB
            );
        })
        .map(normalizeOrder)
        .sort(
            (a, b) =>
                getOrderDate(b) -
                getOrderDate(a)
        );

    const totalSpent =
        customerOrders.reduce(
            (sum, order) =>
                sum + order.total,
            0
        );

    return {
        id:
            customer.id || '',

        name:
            customer.name ||
            'Cliente não informado',

        email:
            customer.email || '',

        phone:
            customer.phone || '',

        ordersCount:
            customerOrders.length,

        totalSpent,

        lastOrder:
            customerOrders[0] || null,

        orders:
            customerOrders
    };
}
