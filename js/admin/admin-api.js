"use strict";

const API_BASE = "https://aurea-pix-api.onrender.com/api/admin";

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
                ? {
                      Authorization: `Bearer ${token}`
                  }
                : {})
        }
    });

    const contentType = response.headers.get("content-type") || "";

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


/* =========================================================
   API ADMINISTRATIVA
   ========================================================= */

const adminApi = {

    /* Dashboard */

    overview: () =>
        request("/overview"),

    timeline: (days = 30) =>
        request(`/overview/timeline?days=${days}`),

    alerts: () =>
        request("/overview/alerts"),

    dashboard: () =>
        request("/dashboard"),


    /* Operação */

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


    /* Relatórios */

    salesReport: () =>
        request("/reports/sales"),

    productReport: () =>
        request("/reports/products"),

    customerReport: () =>
        request("/reports/customers"),


    /* Busca */

    globalSearch: (term) =>
        request(`/search?q=${encodeURIComponent(term)}`),


    /* Histórico */

    orderHistory: (id) =>
        request(`/orders/${encodeURIComponent(id)}/history`),

    customerHistory: (id) =>
        request(`/customers/${encodeURIComponent(id)}/history`),


    /* Estoque / logística */

    inventoryMovements: () =>
        request("/inventory/movements"),

    shippingQueue: () =>
        request("/logistics/queue"),

    financialOverview: () =>
        request("/finance/overview")
};


/* =========================================================
   COMPATIBILIDADE COM MÓDULOS EXISTENTES
   ========================================================= */

window.AdminAPI = {
    ...adminApi,

    get: (path, options = {}) =>
        request(path, {
            ...options,
            method: "GET"
        }),

    post: (path, body, options = {}) =>
        request(path, {
            ...options,
            method: "POST",
            body: JSON.stringify(body)
        }),

    put: (path, body, options = {}) =>
        request(path, {
            ...options,
            method: "PUT",
            body: JSON.stringify(body)
        }),

    delete: (path, options = {}) =>
        request(path, {
            ...options,
            method: "DELETE"
        })
};


/* Compatibilidade adicional */
window.adminApi = window.AdminAPI;

console.log("[ADMIN] AdminAPI conectada ao backend Firebase/Firestore.");