"use strict";

const {
    getFirestore
} = require("../../../infrastructure/firebase/firebase-admin");

const {
    calculateIndicators
} = require("./firestore-admin-indicators");

const ORDERS = "orders";
const TRACKING = "orderTracking";
const USERS = "users";
const PRODUCTS = "products";

function db() {
    return getFirestore();
}

function money(value) {
    const number = Number(value || 0);

    return Number.isFinite(number)
        ? number
        : 0;
}

function normalizeDate(value) {
    if (!value) {
        return null;
    }

    if (typeof value.toDate === "function") {
        return value.toDate().toISOString();
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (typeof value === "string") {
        return value;
    }

    return null;
}

function normalizeOrder(data, id) {
    return {
        ...data,
        id: data.id || id,
        total: money(data.total),
        createdAt: normalizeDate(data.createdAt),
        updatedAt: normalizeDate(data.updatedAt)
    };
}

async function getCollection(name) {
    const snapshot = await db()
        .collection(name)
        .get();

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

async function getOrders() {
    const orders = await getCollection(ORDERS);

    return orders
        .map(order => normalizeOrder(order, order.id))
        .sort((a, b) => {
            const da = new Date(a.createdAt || 0).getTime();
            const db = new Date(b.createdAt || 0).getTime();

            return db - da;
        });
}

async function getProducts() {
    return getCollection(PRODUCTS);
}

async function getCategories() {
    return getCollection("categories");
}

async function getInventory() {
    return getCollection("inventory");
}

async function getCustomers() {
    const [users, orders] = await Promise.all([
        getCollection(USERS),
        getOrders()
    ]);
    const byKey = new Map();
    const byEmail = new Map();
    const byPhone = new Map();

    for (const user of users) {
        const email = String(user.email || "").trim().toLowerCase();
        const phone = String(user.phone || user.whatsapp || "").replace(/\D/g, "");
        const profile = {
            ...user,
            createdAt: normalizeDate(user.createdAt),
            updatedAt: normalizeDate(user.updatedAt),
            email,
            phone,
            ordersCount: 0,
            paidOrders: 0,
            totalSpent: 0,
            lastPurchaseAt: null,
            couponsUsed: [],
            activityHistory: []
        };
        byKey.set(`id:${user.id}`, profile);
        if (email) byEmail.set(email, profile);
        if (phone) byPhone.set(phone, profile);
    }

    for (const order of orders) {
        const email = String(order.customer?.email || order.email || "").trim().toLowerCase();
        const phone = String(order.customer?.phone || order.phone || "").replace(/\D/g, "");
        const userId = String(order.userId || order.customerId || order.customer?.id || "").trim();
        let profile = (email && byEmail.get(email)) || (phone && byPhone.get(phone)) || (userId && byKey.get(`id:${userId}`));
        if (!profile) {
            const key = email ? `email:${email}` : phone ? `phone:${phone}` : `order:${order.id}`;
            profile = byKey.get(key);
        }
        if (!profile) {
            const key = email ? `email:${email}` : phone ? `phone:${phone}` : `order:${order.id}`;
            profile = {
                id: email || order.id,
                name: order.customer?.name || order.customerName || "Cliente",
                email,
                phone,
                createdAt: order.createdAt || null,
                ordersCount: 0,
                paidOrders: 0,
                totalSpent: 0,
                lastPurchaseAt: null,
                couponsUsed: [],
                activityHistory: []
            };
            byKey.set(key, profile);
            if (email) byEmail.set(email, profile);
            if (phone) byPhone.set(phone, profile);
        }

        const orderDate = order.createdAt || null;
        const orderNumber = order.orderNumber || order.order_number || order.id;
        const total = money(order.total ?? order.totals?.total);
        const paymentStatus = String(order.payment?.status || order.paymentStatus || "").toLowerCase();
        const isPaid = ["paid", "pago", "confirmed", "confirmado", "approved", "aprovado"].includes(paymentStatus);
        profile.ordersCount += 1;
        if (isPaid) {
            profile.paidOrders += 1;
            profile.totalSpent += total;
        }
        if (orderDate && (!profile.lastPurchaseAt || new Date(orderDate) > new Date(profile.lastPurchaseAt))) profile.lastPurchaseAt = orderDate;
        const couponCode = typeof order.coupon === "string" ? order.coupon : order.coupon?.code || order.couponCode || order.coupon_code;
        if (couponCode && !profile.couponsUsed.includes(couponCode)) profile.couponsUsed.push(couponCode);
        profile.activityHistory.push({
            at: orderDate,
            type: "order",
            label: `Pedido ${orderNumber} · ${isPaid ? "Pago" : "Pagamento pendente"} · R$ ${total.toFixed(2)}`,
            orderNumber,
            status: order.status || "pending"
        });
        for (const event of Array.isArray(order.history) ? order.history : []) {
            profile.activityHistory.push({
                at: normalizeDate(event.createdAt || event.at) || orderDate,
                type: String(event.type || "order_event"),
                label: String(event.label || event.type || "Atualização do pedido"),
                orderNumber
            });
        }
        if (couponCode) profile.activityHistory.push({ at: orderDate, type: "coupon_used", label: `Cupom usado: ${couponCode}`, orderNumber });
    }

    return [...new Set(byKey.values())]
        .map(profile => ({
            ...profile,
            totalSpent: Number(profile.totalSpent.toFixed(2)),
            activityHistory: profile.activityHistory
                .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
                .slice(0, 30)
        }))
        .sort((a, b) => new Date(b.lastPurchaseAt || b.createdAt || 0).getTime() - new Date(a.lastPurchaseAt || a.createdAt || 0).getTime());
}

async function getFinance() {
    const orders = await getOrders();

    const confirmed = orders.filter(order => {
        const status =
            order.payment?.status ??
            order.paymentStatus ??
            "";

        return [
            "confirmed",
            "paid",
            "approved",
            "completed"
        ].includes(
            String(status).trim().toLowerCase()
        );
    });

    const grossRevenue = confirmed.reduce(
        (sum, order) => sum + money(order.total),
        0
    );

    const averageTicket =
        confirmed.length > 0
            ? grossRevenue / confirmed.length
            : 0;

    return {
        totalOrders: orders.length,
        confirmedOrders: confirmed.length,
        grossRevenue,
        averageTicket,
        source: "Firebase / Firestore"
    };
}

async function getCoupons() {
    return getCollection("coupons");
}

async function normalizeCouponPartner(data = {}, current = {}) {
    const influencerId = String(data.influencerId ?? current.influencerId ?? "").trim();
    let influencerName = String(data.influencerName ?? data.affiliateName ?? current.influencerName ?? current.affiliateName ?? "").trim();
    let linkedInfluencer = null;
    if (influencerId) {
        const snapshot = await db().collection("influencers").doc(influencerId).get();
        if (!snapshot.exists) throw new Error("O influenciador selecionado não existe.");
        linkedInfluencer = snapshot.data() || {};
        influencerName = String(linkedInfluencer.name || influencerName).trim();
    }
    const changedInfluencer = influencerId && influencerId !== String(current.influencerId || "");
    const commission = Number(data.commission ?? (changedInfluencer ? linkedInfluencer?.commissionDefault : current.commission) ?? linkedInfluencer?.commissionDefault ?? 0);
    if (!Number.isFinite(commission) || commission < 0 || commission > 100) throw new Error("A comissão deve estar entre 0 e 100%.");
    return { influencerId, influencerName, affiliateName: influencerName, commission };
}
async function createCoupon(data = {}) {
    const code = String(
        data.code ??
        data.coupon_code ??
        data.couponCode ??
        ""
    ).trim().toUpperCase();

    if (!code) {
        throw new Error("Código do cupom é obrigatório.");
    }

    const discountType = String(
        data.discountType ??
        data.discount_type ??
        "percentage"
    ).trim().toLowerCase();

    const discount = Number(
        data.discount ??
        data.discount_value ??
        data.value ??
        0
    );

    if (!Number.isFinite(discount) || discount < 0) {
        throw new Error("Valor do desconto inválido.");
    }

    const partner = await normalizeCouponPartner(data);

    const coupon = {
        code,
        discount,
        discountType,
        active:
            data.active !== undefined
                ? Boolean(data.active)
                : data.status === "inactive"
                    ? false
                    : true,
        status:
            data.active !== undefined
                ? (Boolean(data.active) ? "active" : "inactive")
                : data.status === "inactive"
                    ? "inactive"
                    : "active",
        uses: Number(data.uses || 0),
        usageLimit:
            data.usageLimit === "" ||
            data.usageLimit == null
                ? null
                : Number(data.usageLimit),
        expiresAt:
            data.expiresAt ||
            data.expires_at ||
            null,
        influencerId: partner.influencerId,
        influencerName: partner.influencerName,
        affiliateName: partner.affiliateName,
        commission: partner.commission,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    const reference =
        await db()
            .collection("coupons")
            .add(coupon);

    return {
        id: reference.id,
        ...coupon
    };
}

async function updateCoupon(id, data = {}) {
    if (!id) {
        throw new Error("ID do cupom é obrigatório.");
    }

    const reference =
        db()
            .collection("coupons")
            .doc(id);

    const snapshot =
        await reference.get();

    if (!snapshot.exists) {
        throw new Error("Cupom não encontrado.");
    }

    const current = snapshot.data();

    const code = String(
        data.code ??
        data.coupon_code ??
        data.couponCode ??
        current.code ??
        ""
    ).trim().toUpperCase();

    if (!code) {
        throw new Error("Código do cupom é obrigatório.");
    }

    const discountType = String(
        data.discountType ??
        data.discount_type ??
        current.discountType ??
        current.discount_type ??
        "percentage"
    ).trim().toLowerCase();

    const discount = Number(
        data.discount ??
        data.discount_value ??
        data.value ??
        current.discount ??
        0
    );

    if (!Number.isFinite(discount) || discount < 0) {
        throw new Error("Valor do desconto inválido.");
    }

    const requestedActive =
        data.active !== undefined
            ? Boolean(data.active)
            : data.status !== undefined
                ? data.status !== "inactive"
                : current.active !== undefined
                    ? Boolean(current.active)
                    : current.status !== "inactive";

    const partner = await normalizeCouponPartner(data, current);

    const updated = {
        code,
        discount,
        discountType,
        active: requestedActive,
        status: requestedActive ? "active" : "inactive",
        uses:
            Number(
                data.uses ??
                current.uses ??
                0
            ),
        usageLimit:
            data.usageLimit !== undefined
                ? (
                    data.usageLimit === ""
                        ? null
                        : Number(data.usageLimit)
                )
                : (
                    current.usageLimit ??
                    current.usage_limit ??
                    null
                ),
        expiresAt:
            data.expiresAt !== undefined
                ? data.expiresAt
                : (
                    current.expiresAt ??
                    current.expires_at ??
                    null
                ),
        influencerId: partner.influencerId,
        influencerName: partner.influencerName,
        affiliateName: partner.affiliateName,
        commission: partner.commission,
        updatedAt: new Date().toISOString()
    };

    await reference.update(updated);

    return {
        id,
        ...current,
        ...updated
    };
}

async function deleteCoupon(id) {
    if (!id) {
        throw new Error("ID do cupom é obrigatório.");
    }

    const reference =
        db()
            .collection("coupons")
            .doc(id);

    const snapshot =
        await reference.get();

    if (!snapshot.exists) {
        throw new Error("Cupom não encontrado.");
    }

    await reference.delete();

    return {
        id,
        deleted: true
    };
}

async function getLogistics() {
    return getCollection(TRACKING);
}

async function getReports() {
    const orders = await getOrders();

    return {
        totalOrders: orders.length,
        totalRevenue: orders.reduce(
            (sum, order) => sum + money(order.total),
            0
        )
    };
}

async function getAudit() {
    return getCollection("audit");
}

async function getSettings() {
    return getCollection("settings");
}

async function getDashboard() {
    const [
        orders,
        customers,
        products,
        tracking
    ] = await Promise.all([
        getOrders(),
        getCustomers(),
        getProducts(),
        getCollection(TRACKING)
    ]);

    const today = new Date();

    const todayOrders = orders.filter(order => {
        if (!order.createdAt) {
            return false;
        }

        const date = new Date(order.createdAt);

        return (
            date.getFullYear() === today.getFullYear() &&
            date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate()
        );
    });

    const revenueToday = todayOrders.reduce(
        (sum, order) => sum + money(order.total),
        0
    );

    const indicators = calculateIndicators({
        orders,
        products,
        tracking
    });

    return {
        faturamentoHoje: revenueToday,
        pedidosHoje: todayOrders.length,
        clientes: customers.length,
        produtos: products.length,

        estoqueBaixo: indicators.estoqueBaixo,
        semEstoque: indicators.semEstoque,

        pagamentosPendentes:
            indicators.pagamentosPendentes,

        enviosPendentes:
            indicators.enviosPendentes,

        vendasRecentes: orders.slice(0, 10)
    };
}

module.exports = {
    getDashboard,
    getOrders,
    getProducts,
    getCategories,
    getInventory,
    getCustomers,
    getFinance,
    getCoupons,
    getLogistics,
    getReports,
    getAudit,
    createCoupon,
    updateCoupon,
    deleteCoupon,
    getSettings
};
