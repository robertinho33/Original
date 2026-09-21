import { adminApi } from "./admin-api.js";

import {
    renderOperationalEnvironment
} from "./modules/operational-environment.js";


const root =
    document.querySelector("#admin-root");


const navigation =
    document.querySelectorAll(
        "[data-admin-section]"
    );


const sections = [
    "dashboard",
    "orders",
    "products",
    "categories",
    "inventory",
    "customers",
    "finance",
    "coupons",
    "logistics",
    "reports",
    "audit",
    "settings"
];


const state = {
    section: "dashboard",
    ready: false
};


function setActiveNavigation(section) {

    navigation.forEach(item => {

        item.classList.toggle(
            "active",
            item.dataset.adminSection === section
        );

    });
}


function shell(
    title,
    subtitle = ""
) {

    return `
        <section class="module-panel">

            <div class="module-panel-header">

                <div>

                    <span class="module-eyebrow">
                        AURÉA ADMIN
                    </span>

                    <h2>
                        ${escapeHtml(title)}
                    </h2>

                    ${
                        subtitle
                            ? `<p>${escapeHtml(subtitle)}</p>`
                            : ""
                    }

                </div>

            </div>

            <div class="admin-loading">
                Preparando módulo...
            </div>

        </section>
    `;
}


async function load(section) {

    if (!root) {

        console.error(
            "[AUREA ADMIN] #admin-root não encontrado."
        );

        return;
    }


    if (!sections.includes(section)) {

        console.warn(
            "[AUREA ADMIN] Seção desconhecida:",
            section
        );

        section = "dashboard";
    }


    state.section = section;


    setActiveNavigation(section);


    if (section === "dashboard") {

        await renderOperationalEnvironment(
            root
        );

        updateHeader(
            "Dashboard",
            "Visão geral da operação da AURÉA"
        );

        return;
    }


    const labels = {

        orders: [
            "Pedidos",
            "Gestão completa dos pedidos."
        ],

        products: [
            "Produtos",
            "Catálogo, SKU, preços e disponibilidade."
        ],

        categories: [
            "Categorias",
            "Organização do catálogo."
        ],

        inventory: [
            "Estoque",
            "Saldo, movimentações e reservas."
        ],

        customers: [
            "Clientes",
            "Base comercial e histórico."
        ],

        finance: [
            "Financeiro",
            "Receitas, pagamentos e indicadores."
        ],

        coupons: [
            "Cupons",
            "Campanhas e desempenho comercial."
        ],

        logistics: [
            "Logística",
            "Expedição, envio e rastreamento."
        ],

        reports: [
            "Relatórios",
            "Inteligência operacional e comercial."
        ],

        audit: [
            "Auditoria",
            "Histórico das operações administrativas."
        ],

        settings: [
            "Configurações",
            "Parâmetros centrais da AURÉA."
        ]

    };


    const info =
        labels[section] || [
            "AURÉA ADMIN",
            ""
        ];


    updateHeader(
        info[0],
        info[1]
    );


    root.innerHTML =
        shell(
            info[0],
            info[1]
        );


    await loadModuleData(section);
}


function updateHeader(
    title,
    description
) {

    const titleElement =
        document.querySelector(
            "#adminPageTitle"
        );

    const descriptionElement =
        document.querySelector(
            "#adminPageDescription"
        );


    if (titleElement) {
        titleElement.textContent = title;
    }


    if (descriptionElement) {
        descriptionElement.textContent =
            description;
    }
}


async function loadModuleData(
    section
) {

    const content =
        root.querySelector(
            ".admin-loading"
        );


    if (!content) {
        return;
    }


    try {

        let response;


        switch (section) {

            case "orders":
                response =
                    await adminApi.orders();
                break;

            case "products":
                response =
                    await adminApi.products();
                break;

            case "categories":
                response =
                    await adminApi.categories();
                break;

            case "inventory":
                response =
                    await adminApi.inventory();
                break;

            case "customers":
                response =
                    await adminApi.customers();
                break;

            case "finance":
                response =
                    await adminApi.finance();
                break;

            case "coupons":
                response =
                    await adminApi.coupons();
                break;

            case "logistics":
                response =
                    await adminApi.logistics();
                break;

            case "reports":
                response =
                    await adminApi.reports();
                break;

            case "audit":
                response =
                    await adminApi.audit();
                break;

            case "settings":
                response =
                    await adminApi.settings();
                break;

            default:
                response = {
                    success: true,
                    data: []
                };
        }


        const data =
            response?.data ?? [];


        if (section === "orders") {

            renderOrders(
                content,
                data
            );

            return;
        }


        const count =
            Array.isArray(data)
                ? data.length
                : 1;


        content.outerHTML = `

            <div class="admin-module-data">

                <div class="admin-metrics-grid">

                    <article class="admin-metric-card">

                        <span>
                            Registros carregados
                        </span>

                        <strong>
                            ${count}
                        </strong>

                    </article>


                    <article class="admin-metric-card">

                        <span>
                            Fonte
                        </span>

                        <strong>
                            PostgreSQL
                        </strong>

                    </article>

                </div>


                <div class="module-panel">

                    <div class="module-panel-header">

                        <h3>
                            Dados operacionais
                        </h3>

                    </div>

                    <pre class="admin-json">${
                        escapeHtml(
                            JSON.stringify(
                                data,
                                null,
                                2
                            )
                        )
                    }</pre>

                </div>

            </div>
        `;

    } catch (error) {

        content.outerHTML = `

            <div class="admin-error">

                ${escapeHtml(
                    error?.message ||
                    "Erro ao carregar módulo."
                )}

            </div>
        `;
    }
}


/* ============================================================
   PEDIDOS
   ============================================================ */

function renderOrders(
    content,
    orders
) {

    const list =
        Array.isArray(orders)
            ? orders
            : [];


    const rows =
        list.map(order => {

            const orderNumber =
                order.order_number ||
                `#${order.id ?? "—"}`;


            const customerName =
                order.customer?.name ||
                order.customer_name ||
                "Cliente não identificado";


            const total =
                Number(
                    order.total ??
                    order.total_amount ??
                    order.totals?.total ??
                    0
                );


            const orderStatus =
                order.status ||
                "—";


            const paymentStatus =
                order.payment_status ||
                order.payment?.status ||
                "—";


            return `

                <tr>

                    <td>

                        <strong>
                            ${escapeHtml(orderNumber)}
                        </strong>

                    </td>


                    <td>
                        ${escapeHtml(customerName)}
                    </td>


                    <td>
                        ${formatCurrency(total)}
                    </td>


                    <td>
                        ${renderStatus(orderStatus)}
                    </td>


                    <td>
                        ${renderStatus(paymentStatus)}
                    </td>


                    <td>

                        <div class="table-actions">

                            <button
                                type="button"
                                class="admin-button"
                                data-order-details="${escapeHtml(
                                    order.id ?? orderNumber
                                )}"
                            >
                                Ver detalhes
                            </button>

                        </div>

                    </td>

                </tr>
            `;
        }).join("");


    content.outerHTML = `

        <div class="admin-module-data">

            <div class="admin-metrics-grid">

                <article class="admin-metric-card">

                    <span>
                        Pedidos carregados
                    </span>

                    <strong>
                        ${list.length}
                    </strong>

                </article>


                <article class="admin-metric-card">

                    <span>
                        Fonte
                    </span>

                    <strong>
                        PostgreSQL
                    </strong>

                </article>

            </div>


            <section class="module-panel">

                <div class="module-panel-header">

                    <div>

                        <span class="module-eyebrow">
                            OPERAÇÃO
                        </span>

                        <h3>
                            Pedidos
                        </h3>

                    </div>

                </div>


                <div class="admin-table-wrap">

                    <table class="admin-table">

                        <thead>

                            <tr>

                                <th>
                                    Pedido
                                </th>

                                <th>
                                    Cliente
                                </th>

                                <th>
                                    Total
                                </th>

                                <th>
                                    Pedido
                                </th>

                                <th>
                                    Pagamento
                                </th>

                                <th>
                                    Ações
                                </th>

                            </tr>

                        </thead>


                        <tbody>

                            ${
                                rows ||
                                `
                                    <tr>

                                        <td
                                            colspan="6"
                                            style="padding:24px;text-align:center;"
                                        >
                                            Nenhum pedido encontrado.
                                        </td>

                                    </tr>
                                `
                            }

                        </tbody>

                    </table>

                </div>

            </section>

        </div>
    `;
}


function renderStatus(
    status
) {

    const value =
        String(
            status ?? "—"
        );


    const normalized =
        value
            .toLowerCase()
            .trim();


    let label =
        value;


    if (normalized === "paid") {
        label = "Pago";
    }

    else if (normalized === "pending") {
        label = "Pendente";
    }

    else if (
        normalized === "cancelled" ||
        normalized === "canceled"
    ) {
        label = "Cancelado";
    }

    else if (normalized === "processing") {
        label = "Processando";
    }

    else if (normalized === "shipped") {
        label = "Enviado";
    }

    else if (normalized === "delivered") {
        label = "Entregue";
    }


    return `
        <span class="admin-status">
            ${escapeHtml(label)}
        </span>
    `;
}


function formatCurrency(
    value
) {

    const number =
        Number(value) || 0;


    return number.toLocaleString(
        "pt-BR",
        {
            style: "currency",
            currency: "BRL"
        }
    );
}


/* ============================================================
   DETALHES DO PEDIDO
   ============================================================ */

async function openOrderDetails(
    orderId
) {

    createOrderModal();

    const modal =
        document.querySelector(
            "#adminOrderModal"
        );


    const content =
        modal?.querySelector(
            ".admin-modal-content"
        );


    if (!modal || !content) {
        return;
    }


    modal.classList.add(
        "is-open"
    );


    content.innerHTML = `
        <div class="admin-loading">
            Carregando detalhes do pedido...
        </div>
    `;


    try {

        const response =
            await adminApi.orderDetails(
                orderId
            );


        const data =
            response?.data ??
            response ??
            null;


        if (!data) {

            throw new Error(
                "Pedido não encontrado."
            );
        }


        renderOrderDetails(
            content,
            data
        );

    } catch (error) {

        content.innerHTML = `

            <div class="admin-error">

                ${escapeHtml(
                    error?.message ||
                    "Não foi possível carregar os detalhes."
                )}

            </div>
        `;
    }
}


function createOrderModal() {

    if (
        document.querySelector(
            "#adminOrderModal"
        )
    ) {
        return;
    }


    document.body.insertAdjacentHTML(
        "beforeend",
        `

        <div
            id="adminOrderModal"
            class="admin-modal"
            aria-hidden="true"
        >

            <div
                class="admin-modal-backdrop"
                data-close-order-modal
            ></div>


            <div
                class="admin-modal-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="adminOrderModalTitle"
            >

                <div class="admin-modal-header">

                    <div>

                        <span class="module-eyebrow">
                            AURÉA ADMIN
                        </span>

                        <h2 id="adminOrderModalTitle">
                            Detalhes do pedido
                        </h2>

                    </div>


                    <button
                        type="button"
                        class="admin-modal-close"
                        data-close-order-modal
                        aria-label="Fechar"
                    >
                        ×
                    </button>

                </div>


                <div class="admin-modal-content">

                    <div class="admin-loading">
                        Carregando...
                    </div>

                </div>

            </div>

        </div>
        `
    );
}


function renderOrderDetails(
    content,
    order
) {

    const orderNumber =
        order.order_number ||
        `#${order.id ?? "—"}`;


    const customer =
        order.customer ||
        {};


    const items =
        Array.isArray(order.items)
            ? order.items
            : [];


    const subtotal =
        Number(
            order.subtotal ??
            order.totals?.subtotal ??
            order.total ??
            0
        );


    const shipping =
        Number(
            order.shipping_cost ??
            order.shipping?.cost ??
            order.totals?.shipping ??
            0
        );


    const discount =
        Number(
            order.discount ??
            order.totals?.discount ??
            0
        );


    const total =
        Number(
            order.total_amount ??
            order.total ??
            order.totals?.total ??
            0
        );


    const itemRows =
        items.map(item => {

            const quantity =
                Number(
                    item.quantity
                ) || 0;


            const price =
                Number(
                    item.price
                ) || 0;


            return `

                <tr>

                    <td>
                        ${escapeHtml(
                            item.name ||
                            item.product_name ||
                            "Produto"
                        )}
                    </td>

                    <td>
                        ${quantity}
                    </td>

                    <td>
                        ${formatCurrency(price)}
                    </td>

                    <td>
                        ${formatCurrency(
                            price * quantity
                        )}
                    </td>

                </tr>
            `;
        }).join("");


    content.innerHTML = `

        <div class="admin-order-section">

            <div class="admin-metrics-grid">

                <article class="admin-metric-card">

                    <span>
                        Pedido
                    </span>

                    <strong>
                        ${escapeHtml(orderNumber)}
                    </strong>

                </article>


                <article class="admin-metric-card">

                    <span>
                        Status
                    </span>

                    <strong>
                        ${escapeHtml(
                            order.status || "—"
                        )}
                    </strong>

                </article>


                <article class="admin-metric-card">

                    <span>
                        Total
                    </span>

                    <strong>
                        ${formatCurrency(total)}
                    </strong>

                </article>

            </div>


            <section class="module-panel">

                <div class="module-panel-header">

                    <h3>
                        Cliente
                    </h3>

                </div>


                <div style="padding:20px;">

                    <p>
                        <strong>
                            Nome:
                        </strong>

                        ${escapeHtml(
                            customer.name ||
                            order.customer_name ||
                            "—"
                        )}
                    </p>


                    <p>
                        <strong>
                            E-mail:
                        </strong>

                        ${escapeHtml(
                            customer.email ||
                            order.customer_email ||
                            "—"
                        )}
                    </p>


                    <p>
                        <strong>
                            Telefone:
                        </strong>

                        ${escapeHtml(
                            customer.phone ||
                            order.customer_phone ||
                            "—"
                        )}
                    </p>

                </div>

            </section>


            <section class="module-panel">

                <div class="module-panel-header">

                    <h3>
                        Itens do pedido
                    </h3>

                </div>


                <div class="admin-table-wrap">

                    <table class="admin-table">

                        <thead>

                            <tr>

                                <th>
                                    Produto
                                </th>

                                <th>
                                    Qtd.
                                </th>

                                <th>
                                    Unitário
                                </th>

                                <th>
                                    Total
                                </th>

                            </tr>

                        </thead>


                        <tbody>

                            ${
                                itemRows ||
                                `
                                    <tr>

                                        <td
                                            colspan="4"
                                            style="padding:20px;text-align:center;"
                                        >
                                            Nenhum item informado.
                                        </td>

                                    </tr>
                                `
                            }

                        </tbody>

                    </table>

                </div>

            </section>


            <section class="module-panel">

                <div class="module-panel-header">

                    <h3>
                        Resumo financeiro
                    </h3>

                </div>


                <div style="padding:20px;">

                    <p>
                        <strong>
                            Subtotal:
                        </strong>

                        ${formatCurrency(subtotal)}
                    </p>


                    <p>
                        <strong>
                            Frete:
                        </strong>

                        ${formatCurrency(shipping)}
                    </p>


                    <p>
                        <strong>
                            Desconto:
                        </strong>

                        ${formatCurrency(discount)}
                    </p>


                    <hr>


                    <p>

                        <strong>
                            Total:
                        </strong>

                        <strong>
                            ${formatCurrency(total)}
                        </strong>

                    </p>

                </div>

            </section>


            <section class="module-panel">

                <div class="module-panel-header">

                    <h3>
                        Informações da operação
                    </h3>

                </div>


                <div style="padding:20px;">

                    <p>
                        <strong>
                            Status do pedido:
                        </strong>

                        ${renderStatus(
                            order.status
                        )}
                    </p>


                    <p>
                        <strong>
                            Status do pagamento:
                        </strong>

                        ${renderStatus(
                            order.payment_status ||
                            order.payment?.status
                        )}
                    </p>


                    <p>
                        <strong>
                            Criado em:
                        </strong>

                        ${formatDate(
                            order.created_at
                        )}
                    </p>


                    <p>
                        <strong>
                            Atualizado em:
                        </strong>

                        ${formatDate(
                            order.updated_at
                        )}
                    </p>

                </div>

            </section>

        </div>
    `;
}


function formatDate(
    value
) {

    if (!value) {
        return "—";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return String(value);
    }


    return date.toLocaleString(
        "pt-BR"
    );
}


function closeOrderModal() {

    const modal =
        document.querySelector(
            "#adminOrderModal"
        );


    if (!modal) {
        return;
    }


    modal.classList.remove(
        "is-open"
    );

    modal.setAttribute(
        "aria-hidden",
        "true"
    );
}


/* ============================================================
   EVENTOS
   ============================================================ */

navigation.forEach(item => {

    item.addEventListener(
        "click",
        event => {

            event.preventDefault();

            load(
                item.dataset.adminSection
            );

        }
    );

});


const logoutButton =
    document.querySelector(
        "#adminLogout"
    );


logoutButton?.addEventListener(
    "click",
    () => {

        localStorage.removeItem(
            "aurea-admin-token"
        );

        sessionStorage.removeItem(
            "aurea-admin-token"
        );

        window.location.replace(
            "./admin-login.html"
        );
    }
);


document.addEventListener(
    "click",
    event => {

        const detailsButton =
            event.target.closest(
                "[data-order-details]"
            );


        if (detailsButton) {

            event.preventDefault();

            openOrderDetails(
                detailsButton.dataset.orderDetails
            );

            return;
        }


        const closeButton =
            event.target.closest(
                "[data-close-order-modal]"
            );


        if (closeButton) {

            closeOrderModal();

            return;
        }


        const refreshButton =
            event.target.closest(
                "[data-refresh-admin]"
            );


        if (!refreshButton) {
            return;
        }


        load(
            state.section
        );
    }
);


document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape"
        ) {

            closeOrderModal();
        }
    }
);


window.AUREA_ADMIN = {

    state,

    load,

    refresh: () =>
        load(state.section)

};


state.ready = true;


load("dashboard");