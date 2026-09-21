const API_BASE = "/api/admin";

function getAdminToken() {
    return (
        localStorage.getItem("aurea-admin-token") ||
        sessionStorage.getItem("aurea-admin-token") ||
        ""
    );
}

async function request(path, options = {}) {
    const token = getAdminToken();

    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
            ...(token
                ? { Authorization: `Bearer ${token}` }
                : {})
        }
    });

    const contentType =
        response.headers.get("content-type") || "";

    const data = contentType.includes("application/json")
        ? await response.json()
        : {
            success: false,
            error: await response.text()
        };

    if (!response.ok || data.success === false) {
        throw new Error(
            data.error ||
            data.message ||
            `Erro administrativo ${response.status}`
        );
    }

    return data;
}

export const adminApi = {
    overview: () => request("/overview"),
    timeline: (days = 30) =>
        request(`/overview/timeline?days=${days}`),
    alerts: () =>
        request("/overview/alerts"),

    dashboard: () =>
        request("/dashboard"),

    orders: () =>
        request("/orders"),

    products: () =>
        request("/products"),

    categories: () =>
        request("/categories"),

    inventory: () =>
        request("/inventory"),

    customers: () =>
        request("/customers"),

    finance: () =>
        request("/finance"),

    coupons: () =>
        request("/coupons"),

    logistics: () =>
        request("/logistics"),

    reports: () =>
        request("/reports"),

    audit: () =>
        request("/audit"),

    settings: () =>
        request("/settings"),

    salesReport: () =>
        request("/reports/sales"),

    productReport: () =>
        request("/reports/products"),

    customerReport: () =>
        request("/reports/customers"),

    globalSearch: (term) =>
        request(`/search?q=${encodeURIComponent(term)}`),

    orderHistory: (id) =>
        request(`/orders/${id}/history`),

    customerHistory: (id) =>
        request(`/customers/${id}/history`),

    inventoryMovements: () =>
        request("/inventory/movements"),

    shippingQueue: () =>
        request("/logistics/queue"),

    financialOverview: () =>
        request("/finance/overview")
};

export { getAdminToken };
