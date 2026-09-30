"use strict";

import {
    getAdminIdToken
} from "../auth/admin-auth.js";

const API_BASE =
    "/api/admin";

async function request(
    path,
    options = {}
) {

    let token =
        await getAdminIdToken(false);

    const makeRequest =
        async currentToken => {

            return fetch(
                `${API_BASE}${path}`,
                {
                    ...options,

                    headers: {
                        "Content-Type":
                            "application/json",

                        ...(options.headers || {}),

                        Authorization:
                            `Bearer ${currentToken}`
                    }
                }
            );
        };

    let response =
        await makeRequest(token);

    /*
     * Se o token estiver expirado,
     * força renovação do Firebase e
     * tenta novamente uma única vez.
     */

    if (response.status === 401) {

        token =
            await getAdminIdToken(true);

        response =
            await makeRequest(token);
    }

    const contentType =
        response.headers.get(
            "content-type"
        ) || "";

    const data =
        contentType.includes(
            "application/json"
        )
            ? await response.json()
            : {
                  success: false,
                  error:
                      await response.text()
              };

    if (
        !response.ok ||
        data.success === false
    ) {

        throw new Error(
            data.error ||
            data.message ||
            `Erro administrativo ${response.status}`
        );
    }

    return data;
}

const adminApi = {

    overview:
        () => request("/overview"),

    timeline:
        (days = 30) =>
            request(
                `/overview/timeline?days=${days}`
            ),

    alerts:
        () => request("/overview/alerts"),

    dashboard:
        () => request("/dashboard"),

    orders:
        () =>
            window.AdminFirebaseOrders.list(),

    orderDetails:
        orderId =>
            window.AdminFirebaseOrders.details(
                orderId
            ),

    products:
        () => request("/products"),

    categories:
        () => request("/categories"),

    inventory:
        () => request("/inventory"),

    customers:
        () => request("/customers"),

    finance:
        () => request("/finance"),

       coupons:
        () =>
            request("/coupons"),

    createCoupon:
        data =>
            request("/coupons", {
                method: "POST",
                body: JSON.stringify(data)
            }),

    updateCoupon:
        (id, data) =>
            request(
                `/coupons/${encodeURIComponent(id)}`,
                {
                    method: "PUT",
                    body: JSON.stringify(data)
                }
            ),

    toggleCoupon:
        (id, active) =>
            request(
                `/coupons/${encodeURIComponent(id)}`,
                {
                    method: "PUT",
                    body: JSON.stringify({
                        active: Boolean(active)
                    })
                }
            ),

    deleteCoupon:
        id =>
            request(
                `/coupons/${encodeURIComponent(id)}`,
                {
                    method: "DELETE"
                }
            ),

    logistics:
        () => request("/logistics"),

    reports:
        () => request("/reports"),

    audit:
        () => request("/audit"),

    settings:
        () => request("/settings"),

    salesReport:
        () => request("/reports/sales"),

    productReport:
        () => request("/reports/products"),

    customerReport:
        () => request("/reports/customers"),

    globalSearch:
        term =>
            request(
                `/search?q=${encodeURIComponent(term)}`
            ),

    orderHistory:
        id =>
            request(
                `/orders/${encodeURIComponent(id)}/history`
            ),

    customerHistory:
        id =>
            request(
                `/customers/${encodeURIComponent(id)}/history`
            ),

    inventoryMovements:
        () =>
            request(
                "/inventory/movements"
            ),

    shippingQueue:
        () =>
            request(
                "/logistics/queue"
            ),

    financialOverview:
        () =>
            request(
                "/finance/overview"
            )
};

window.AdminAPI = {
    ...adminApi,

    get:
        (path, options = {}) =>
            request(
                path,
                {
                    ...options,
                    method: "GET"
                }
            ),

    post:
        (
            path,
            body,
            options = {}
        ) =>
            request(
                path,
                {
                    ...options,
                    method: "POST",
                    body:
                        JSON.stringify(body)
                }
            ),

    put:
        (
            path,
            body,
            options = {}
        ) =>
            request(
                path,
                {
                    ...options,
                    method: "PUT",
                    body:
                        JSON.stringify(body)
                }
            ),

    delete:
        (
            path,
            options = {}
        ) =>
            request(
                path,
                {
                    ...options,
                    method: "DELETE"
                }
            )
};

window.adminApi =
    window.AdminAPI;

console.log(
    "[ADMIN] AdminAPI conectada ao Firebase Auth."
);
