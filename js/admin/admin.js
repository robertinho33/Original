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


/* ============================================================
   UTILITARIOS
   ============================================================ */

function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function formatCurrency(value) {

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


function formatNumber(value) {

    const number =
        Number(value);

    if (!Number.isFinite(number)) {
        return "0";
    }

    return number.toLocaleString("pt-BR");
}


function formatDate(value) {

    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

    if (Number.isNaN(date.getTime())) {
        return escapeHtml(value);
    }

    return date.toLocaleString(
        "pt-BR",
        {
            dateStyle: "short",
            timeStyle: "short"
        }
    );
}


function pick(object, keys, fallback = null) {

    if (!object || typeof object !== "object") {
        return fallback;
    }

    for (const key of keys) {

        if (
            object[key] !== undefined &&
            object[key] !== null &&
            object[key] !== ""
        ) {
            return object[key];
        }
    }

    return fallback;
}


function labelize(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "—";
    }

    return String(value)
        .replaceAll("_", " ")
        .replaceAll("-", " ")
        .replace(/\b\w/g, char =>
            char.toUpperCase()
        );
}


function renderStatus(status) {

    const value =
        String(status ?? "—");

    const normalized =
        value
            .toLowerCase()
            .trim();

    let label =
        labelize(value);

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

    else if (normalized === "active") {
        label = "Ativo";
    }

    else if (normalized === "inactive") {
        label = "Inativo";
    }

    return `
        <span class="admin-status-badge">
            ${escapeHtml(label)}
        </span>
    `;
}


function stockStatus(value) {

    const stock =
        Number(value) || 0;

    if (stock <= 0) {
        return `
            <span class="admin-status-badge danger">
                Sem estoque
            </span>
        `;
    }

    if (stock <= 5) {
        return `
            <span class="admin-status-badge">
                Estoque baixo
            </span>
        `;
    }

    return `
        <span class="admin-status-badge success">
            Disponível
        </span>
    `;
}


function setActiveNavigation(section) {

    navigation.forEach(item => {

        item.classList.toggle(
            "active",
            item.dataset.adminSection === section
        );

    });
}


function shell(title, subtitle = "") {

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


function emptyState(message) {

    return `
        <div class="admin-empty-state">
            ${escapeHtml(message)}
        </div>
    `;
}


function metricCard(label, value, detail = "") {

    return `
        <article class="admin-metric-card">

            <span class="metric-label">
                ${escapeHtml(label)}
            </span>

            <div class="metric-value">
                ${escapeHtml(value)}
            </div>

            ${
                detail
                    ? `
                        <div class="metric-detail">
                            ${escapeHtml(detail)}
                        </div>
                    `
                    : ""
            }

        </article>
    `;
}


function table(title, columns, rows) {

    const list =
        Array.isArray(rows)
            ? rows
            : [];

    if (!list.length) {
        return `
            <section class="module-panel">

                <div class="module-panel-header">
                    <h3>
                        ${escapeHtml(title)}
                    </h3>
                </div>

                ${emptyState("Nenhum registro encontrado.")}

            </section>
        `;
    }

    return `
        <section class="module-panel">

            <div class="module-panel-header">

                <div>
                    <h3>
                        ${escapeHtml(title)}
                    </h3>
                </div>

            </div>

            <div class="admin-table-wrap">

                <table class="admin-table">

                    <thead>
                        <tr>

                            ${columns.map(column => `
                                <th>
                                    ${escapeHtml(column.label)}
                                </th>
                            `).join("")}

                        </tr>
                    </thead>

                    <tbody>

                        ${list.map(row => `
                            <tr>

                                ${columns.map(column => `
                                    <td>
                                        ${
                                            typeof column.render === "function"
                                                ? column.render(row)
                                                : escapeHtml(
                                                    pick(
                                                        row,
                                                        column.keys || [],
                                                        "—"
                                                    )
                                                )
                                        }
                                    </td>
                                `).join("")}

                            </tr>
                        `).join("")}

                    </tbody>

                </table>

            </div>

        </section>
    `;
}


/* ============================================================
   LOAD PRINCIPAL
   ============================================================ */

async function load(section) {

    if (!root) {

        console.error(
            "[AUREA ADMIN] #admin-root não encontrado."
        );

        return;
    }


    if (!sections.includes(section)) {

        section = "dashboard";
    }


    state.section = section;

    setActiveNavigation(section);


    if (section === "dashboard") {

        await renderOperationalEnvironment(root);

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
            "Saldo, movimentações e disponibilidade."
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


function updateHeader(title, description) {

    const titleElement =
        document.querySelector(
            "#adminSectionTitle"
        );

    if (titleElement) {
        titleElement.textContent = title;
    }

    const descriptionElement =
        document.querySelector(
            "#adminPageDescription"
        );

    if (descriptionElement) {
        descriptionElement.textContent =
            description;
    }
}


/* ============================================================
   CARREGAMENTO DOS MODULOS
   ============================================================ */

async function loadModuleData(section) {

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


        if (section === "products") {

            renderProducts(
                content,
                data
            );

            return;
        }


        if (section === "categories") {

            renderCategories(
                content,
                data
            );

            return;
        }


        if (section === "inventory") {

            renderInventory(
                content,
                data
            );

            return;
        }


        if (section === "customers") {

            renderCustomers(
                content,
                data
            );

            return;
        }


        if (section === "finance") {

            renderFinance(
                content,
                data
            );

            return;
        }


        if (section === "coupons") {

            renderCoupons(
                content,
                data
            );

            return;
        }


        if (section === "logistics") {

            renderLogistics(
                content,
                data
            );

            return;
        }


        if (section === "reports") {

            renderReports(
                content,
                data
            );

            return;
        }


        if (section === "audit") {

            renderAudit(
                content,
                data
            );

            return;
        }


        if (section === "settings") {

            renderSettings(
                content,
                data
            );

            return;
        }


    } catch (error) {

        content.outerHTML = `

            <div class="admin-error">

                <strong>
                    Não foi possível carregar este módulo.
                </strong>

                <div style="margin-top:7px;">
                    ${escapeHtml(
                        error?.message ||
                        "Erro desconhecido."
                    )}
                </div>

            </div>
        `;
    }
}


/* ============================================================
   PRODUTOS
   ============================================================ */

function renderProducts(content, products) {

    const list =
        Array.isArray(products)
            ? products
            : [];

    const total =
        list.length;

    const available =
        list.filter(product =>
            Number(
                pick(product, ["stock", "inventory", "quantity"], 0)
            ) > 0
        ).length;

    const withoutStock =
        list.filter(product =>
            Number(
                pick(product, ["stock", "inventory", "quantity"], 0)
            ) <= 0
        ).length;


    const html = `

        <div class="admin-module-data">

            <div class="admin-metrics-grid">

                ${metricCard(
                    "Produtos cadastrados",
                    formatNumber(total)
                )}

                ${metricCard(
                    "Disponíveis",
                    formatNumber(available)
                )}

                ${metricCard(
                    "Sem estoque",
                    formatNumber(withoutStock)
                )}

                ${metricCard(
                    "Fonte",
                    "PostgreSQL"
                )}

            </div>


            ${table(
                "Catálogo de produtos",

                [
                    {
                        label: "Produto",
                        render: row => `
                            <strong>
                                ${escapeHtml(
                                    pick(
                                        row,
                                        ["name", "product_name", "title"],
                                        "Produto"
                                    )
                                )}
                            </strong>
                        `
                    },

                    {
                        label: "SKU",
                        keys: ["sku", "code", "product_code"]
                    },

                    {
                        label: "Categoria",
                        render: row =>
                            escapeHtml(
                                pick(
                                    row,
                                    ["category_name", "category"],
                                    "—"
                                )
                            )
                    },

                    {
                        label: "Preço",
                        render: row =>
                            formatCurrency(
                                pick(
                                    row,
                                    ["price", "sale_price", "amount"],
                                    0
                                )
                            )
                    },

                    {
                        label: "Estoque",
                        render: row =>
                            formatNumber(
                                pick(
                                    row,
                                    ["stock", "inventory", "quantity"],
                                    0
                                )
                            )
                    },

                    {
                        label: "Situação",
                        render: row =>
                            stockStatus(
                                pick(
                                    row,
                                    ["stock", "inventory", "quantity"],
                                    0
                                )
                            )
                    }
                ],

                list
            )}

        </div>
    `;


    content.outerHTML =
        html;
}


/* ============================================================
   CATEGORIAS
   ============================================================ */

function renderCategories(content, categories) {

    const list =
        Array.isArray(categories)
            ? categories
            : [];


    content.outerHTML = `

        <div class="admin-module-data">

            <div class="admin-metrics-grid">

                ${metricCard(
                    "Categorias cadastradas",
                    formatNumber(list.length)
                )}

                ${metricCard(
                    "Fonte",
                    "PostgreSQL"
                )}

            </div>


            ${table(
                "Categorias",

                [
                    {
                        label: "ID",
                        keys: ["id"]
                    },

                    {
                        label: "Nome",
                        render: row => `
                            <strong>
                                ${escapeHtml(
                                    pick(
                                        row,
                                        ["name", "title", "category_name"],
                                        "Categoria"
                                    )
                                )}
                            </strong>
                        `
                    },

                    {
                        label: "Descrição",
                        keys: ["description", "details"]
                    },

                    {
                        label: "Status",
                        render: row =>
                            renderStatus(
                                pick(
                                    row,
                                    ["status", "state"],
                                    "active"
                                )
                            )
                    }
                ],

                list
            )}

        </div>
    `;
}


/* ============================================================
   ESTOQUE
   ============================================================ */

function renderInventory(content, inventory) {

    const list =
        Array.isArray(inventory)
            ? inventory
            : [];


    const totalUnits =
        list.reduce(
            (sum, row) =>
                sum +
                (
                    Number(
                        pick(
                            row,
                            ["stock", "inventory", "quantity"],
                            0
                        )
                    ) || 0
                ),
            0
        );


    const lowStock =
        list.filter(row =>
            Number(
                pick(
                    row,
                    ["stock", "inventory", "quantity"],
                    0
                )
            ) <= 5
        ).length;


    const emptyStock =
        list.filter(row =>
            Number(
                pick(
                    row,
                    ["stock", "inventory", "quantity"],
                    0
                )
            ) <= 0
        ).length;


    content.outerHTML = `

        <div class="admin-module-data">

            <div class="admin-metrics-grid">

                ${metricCard(
                    "Itens monitorados",
                    formatNumber(list.length)
                )}

                ${metricCard(
                    "Unidades em estoque",
                    formatNumber(totalUnits)
                )}

                ${metricCard(
                    "Estoque baixo",
                    formatNumber(lowStock)
                )}

                ${metricCard(
                    "Sem estoque",
                    formatNumber(emptyStock)
                )}

            </div>


            ${table(
                "Controle de estoque",

                [
                    {
                        label: "Produto",
                        render: row => `
                            <strong>
                                ${escapeHtml(
                                    pick(
                                        row,
                                        ["name", "product_name", "title"],
                                        "Produto"
                                    )
                                )}
                            </strong>
                        `
                    },

                    {
                        label: "SKU",
                        keys: ["sku", "code"]
                    },

                    {
                        label: "Quantidade",
                        render: row =>
                            formatNumber(
                                pick(
                                    row,
                                    ["stock", "inventory", "quantity"],
                                    0
                                )
                            )
                    },

                    {
                        label: "Preço",
                        render: row =>
                            formatCurrency(
                                pick(
                                    row,
                                    ["price", "sale_price"],
                                    0
                                )
                            )
                    },

                    {
                        label: "Situação",
                        render: row =>
                            stockStatus(
                                pick(
                                    row,
                                    ["stock", "inventory", "quantity"],
                                    0
                                )
                            )
                    }
                ],

                list
            )}

        </div>
    `;
}


/* ============================================================
   CLIENTES
   ============================================================ */

function renderCustomers(content, customers) {

    const list =
        Array.isArray(customers)
            ? customers
            : [];


    content.outerHTML = `

        <div class="admin-module-data">

            <div class="admin-metrics-grid">

                ${metricCard(
                    "Clientes cadastrados",
                    formatNumber(list.length)
                )}

                ${metricCard(
                    "Fonte",
                    "PostgreSQL"
                )}

            </div>


            ${table(
                "Base de clientes",

                [
                    {
                        label: "Cliente",
                        render: row => `
                            <strong>
                                ${escapeHtml(
                                    pick(
                                        row,
                                        ["name", "full_name"],
                                        "Cliente"
                                    )
                                )}
                            </strong>
                        `
                    },

                    {
                        label: "E-mail",
                        keys: ["email"]
                    },

                    {
                        label: "Telefone",
                        keys: ["phone", "telephone", "whatsapp"]
                    },

                    {
                        label: "Cadastro",
                        render: row =>
                            formatDate(
                                pick(
                                    row,
                                    ["created_at", "createdAt"],
                                    null
                                )
                            )
                    },

                    {
                        label: "Status",
                        render: row =>
                            renderStatus(
                                pick(
                                    row,
                                    ["status", "state"],
                                    "active"
                                )
                            )
                    }
                ],

                list
            )}

        </div>
    `;
}


/* ============================================================
   FINANCEIRO
   ============================================================ */

function renderFinance(content, finance) {

    const data =
        finance &&
        typeof finance === "object" &&
        !Array.isArray(finance)
            ? finance
            : {};


    const revenue =
        pick(
            data,
            ["revenue", "totalRevenue", "sales"],
            0
        );


    const orders =
        pick(
            data,
            ["orders", "totalOrders"],
            0
        );


    const average =
        pick(
            data,
            ["averageTicket", "average_ticket", "ticket"],
            0
        );


    content.outerHTML = `

        <div class="admin-module-data">

            <div class="admin-metrics-grid">

                ${metricCard(
                    "Faturamento",
                    formatCurrency(revenue)
                )}

                ${metricCard(
                    "Pedidos",
                    formatNumber(orders)
                )}

                ${metricCard(
                    "Ticket médio",
                    formatCurrency(average)
                )}

                ${metricCard(
                    "Fonte",
                    "PostgreSQL"
                )}

            </div>


            <section class="module-panel">

                <div class="module-panel-header">

                    <div>
                        <span class="module-eyebrow">
                            VISÃO FINANCEIRA
                        </span>

                        <h3>
                            Resumo financeiro
                        </h3>

                    </div>

                </div>


                <div class="admin-operation-grid">

                    <article class="admin-operation-card">

                        <span>
                            Receita total
                        </span>

                        <strong>
                            ${formatCurrency(revenue)}
                        </strong>

                    </article>


                    <article class="admin-operation-card">

                        <span>
                            Pedidos registrados
                        </span>

                        <strong>
                            ${formatNumber(orders)}
                        </strong>

                    </article>


                    <article class="admin-operation-card">

                        <span>
                            Ticket médio
                        </span>

                        <strong>
                            ${formatCurrency(average)}
                        </strong>

                    </article>


                    <article class="admin-operation-card">

                        <span>
                            Origem
                        </span>

                        <strong>
                            PostgreSQL
                        </strong>

                    </article>

                </div>

            </section>

        </div>
    `;
}


/* ============================================================
   CUPONS
   ============================================================ */

function renderCoupons(content, coupons) {

    const list =
        Array.isArray(coupons)
            ? coupons
            : [];


    content.outerHTML = `

        <div class="admin-module-data">

            <div class="admin-metrics-grid">

                ${metricCard(
                    "Cupons cadastrados",
                    formatNumber(list.length)
                )}

                ${metricCard(
                    "Fonte",
                    "PostgreSQL"
                )}

            </div>


            ${table(
                "Campanhas e cupons",

                [
                    {
                        label: "Código",
                        render: row => `
                            <strong>
                                ${escapeHtml(
                                    pick(
                                        row,
                                        ["code", "coupon_code"],
                                        "—"
                                    )
                                )}
                            </strong>
                        `
                    },

                    {
                        label: "Desconto",
                        render: row => {

                            const value =
                                pick(
                                    row,
                                    [
                                        "discount",
                                        "discount_value",
                                        "percentage"
                                    ],
                                    0
                                );

                            const type =
                                String(
                                    pick(
                                        row,
                                        ["discount_type", "type"],
                                        ""
                                    )
                                ).toLowerCase();

                            if (
                                type.includes("percent") ||
                                type === "%"
                            ) {
                                return `${escapeHtml(value)}%`;
                            }

                            return formatCurrency(value);
                        }
                    },

                    {
                        label: "Status",
                        render: row =>
                            renderStatus(
                                pick(
                                    row,
                                    ["status", "state"],
                                    "active"
                                )
                            )
                    },

                    {
                        label: "Validade",
                        render: row =>
                            formatDate(
                                pick(
                                    row,
                                    ["expires_at", "expiration_date", "valid_until"],
                                    null
                                )
                            )
                    }
                ],

                list
            )}

        </div>
    `;
}


/* ============================================================
   LOGISTICA
   ============================================================ */

function renderLogistics(content, shipments) {

    const list =
        Array.isArray(shipments)
            ? shipments
            : [];


    content.outerHTML = `

        <div class="admin-module-data">

            <div class="admin-metrics-grid">

                ${metricCard(
                    "Envios registrados",
                    formatNumber(list.length)
                )}

                ${metricCard(
                    "Pendentes",
                    formatNumber(
                        list.filter(row =>
                            [
                                "pending",
                                "processing",
                                "ready",
                                "awaiting_shipment",
                                "to_ship"
                            ].includes(
                                String(
                                    pick(
                                        row,
                                        ["status", "state"],
                                        ""
                                    )
                                ).toLowerCase()
                            )
                        ).length
                    )
                )}

                ${metricCard(
                    "Fonte",
                    "PostgreSQL"
                )}

            </div>


            ${table(
                "Expedição e rastreamento",

                [
                    {
                        label: "ID",
                        keys: ["id"]
                    },

                    {
                        label: "Pedido",
                        keys: ["order_id", "order_number"]
                    },

                    {
                        label: "Transportadora",
                        keys: ["carrier", "shipping_carrier"]
                    },

                    {
                        label: "Rastreamento",
                        keys: ["tracking_code", "tracking_number"]
                    },

                    {
                        label: "Status",
                        render: row =>
                            renderStatus(
                                pick(
                                    row,
                                    ["status", "state"],
                                    "pending"
                                )
                            )
                    },

                    {
                        label: "Atualização",
                        render: row =>
                            formatDate(
                                pick(
                                    row,
                                    ["updated_at", "created_at"],
                                    null
                                )
                            )
                    }
                ],

                list
            )}

        </div>
    `;
}


/* ============================================================
   RELATORIOS
   ============================================================ */

function renderReports(content, reports) {

    const data =
        reports &&
        typeof reports === "object" &&
        !Array.isArray(reports)
            ? reports
            : {};


    const metrics =
        data.metrics || {};


    const sales =
        Array.isArray(data.sales)
            ? data.sales
            : [];


    const recentOrders =
        Array.isArray(data.recentOrders)
            ? data.recentOrders
            : [];


    content.outerHTML = `

        <div class="admin-module-data">

            <div class="admin-metrics-grid">

                ${metricCard(
                    "Faturamento",
                    formatCurrency(
                        pick(
                            metrics,
                            ["revenue"],
                            0
                        )
                    )
                )}

                ${metricCard(
                    "Pedidos",
                    formatNumber(
                        pick(
                            metrics,
                            ["orders"],
                            0
                        )
                    )
                )}

                ${metricCard(
                    "Ticket médio",
                    formatCurrency(
                        pick(
                            metrics,
                            ["averageTicket"],
                            0
                        )
                    )
                )}

                ${metricCard(
                    "Dias registrados",
                    formatNumber(sales.length)
                )}

            </div>


            ${table(
                "Evolução das vendas",

                [
                    {
                        label: "Data",
                        render: row =>
                            formatDate(
                                pick(
                                    row,
                                    ["day", "date"],
                                    null
                                )
                            )
                    },

                    {
                        label: "Pedidos",
                        render: row =>
                            formatNumber(
                                pick(
                                    row,
                                    ["orders", "count"],
                                    0
                                )
                            )
                    },

                    {
                        label: "Faturamento",
                        render: row =>
                            formatCurrency(
                                pick(
                                    row,
                                    ["revenue", "total"],
                                    0
                                )
                            )
                    }
                ],

                sales
            )}


            ${table(
                "Pedidos recentes",

                [
                    {
                        label: "Pedido",
                        render: row => `
                            <strong>
                                ${escapeHtml(
                                    pick(
                                        row,
                                        ["order_number", "number", "id"],
                                        "—"
                                    )
                                )}
                            </strong>
                        `
                    },

                    {
                        label: "Data",
                        render: row =>
                            formatDate(
                                pick(
                                    row,
                                    ["created_at", "createdAt"],
                                    null
                                )
                            )
                    },

                    {
                        label: "Total",
                        render: row =>
                            formatCurrency(
                                pick(
                                    row,
                                    ["total", "total_amount"],
                                    0
                                )
                            )
                    },

                    {
                        label: "Status",
                        render: row =>
                            renderStatus(
                                pick(
                                    row,
                                    ["status"],
                                    "pending"
                                )
                            )
                    }
                ],

                recentOrders
            )}

        </div>
    `;
}


/* ============================================================
   AUDITORIA
   ============================================================ */

function renderAudit(content, logs) {

    const list =
        Array.isArray(logs)
            ? logs
            : [];


    content.outerHTML = `

        <div class="admin-module-data">

            <div class="admin-metrics-grid">

                ${metricCard(
                    "Registros de auditoria",
                    formatNumber(list.length)
                )}

                ${metricCard(
                    "Fonte",
                    "PostgreSQL"
                )}

            </div>


            ${table(
                "Histórico administrativo",

                [
                    {
                        label: "Data",
                        render: row =>
                            formatDate(
                                pick(
                                    row,
                                    [
                                        "created_at",
                                        "createdAt",
                                        "timestamp"
                                    ],
                                    null
                                )
                            )
                    },

                    {
                        label: "Ação",
                        render: row => `
                            <strong>
                                ${escapeHtml(
                                    labelize(
                                        pick(
                                            row,
                                            [
                                                "action",
                                                "event",
                                                "operation"
                                            ],
                                            "—"
                                        )
                                    )
                                )}
                            </strong>
                        `
                    },

                    {
                        label: "Usuário",
                        keys: [
                            "user_name",
                            "admin_name",
                            "email",
                            "user_id"
                        ]
                    },

                    {
                        label: "Entidade",
                        keys: [
                            "entity",
                            "resource",
                            "table_name"
                        ]
                    },

                    {
                        label: "Status",
                        render: row =>
                            renderStatus(
                                pick(
                                    row,
                                    ["status", "result"],
                                    "completed"
                                )
                            )
                    }
                ],

                list
            )}

        </div>
    `;
}


/* ============================================================
   CONFIGURACOES
   ============================================================ */

function renderSettings(content, settings) {

    const list =
        Array.isArray(settings)
            ? settings
            : [];


    content.outerHTML = `

        <div class="admin-module-data">

            <div class="admin-metrics-grid">

                ${metricCard(
                    "Parâmetros cadastrados",
                    formatNumber(list.length)
                )}

                ${metricCard(
                    "Fonte",
                    "PostgreSQL"
                )}

            </div>


            ${table(
                "Parâmetros da AURÉA",

                [
                    {
                        label: "Chave",
                        render: row => `
                            <strong>
                                ${escapeHtml(
                                    pick(
                                        row,
                                        ["key", "name", "setting_key"],
                                        "—"
                                    )
                                )}
                            </strong>
                        `
                    },

                    {
                        label: "Valor",
                        render: row => {

                            const value =
                                pick(
                                    row,
                                    ["value", "setting_value", "content"],
                                    "—"
                                );

                            return `
                                <span>
                                    ${escapeHtml(value)}
                                </span>
                            `;
                        }
                    },

                    {
                        label: "Descrição",
                        keys: [
                            "description",
                            "label",
                            "details"
                        ]
                    },

                    {
                        label: "Atualização",
                        render: row =>
                            formatDate(
                                pick(
                                    row,
                                    ["updated_at", "created_at"],
                                    null
                                )
                            )
                    }
                ],

                list
            )}

        </div>
    `;
}


/* ============================================================
   PEDIDOS
   ============================================================ */

function renderOrders(content, orders) {

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

                ${metricCard(
                    "Pedidos carregados",
                    formatNumber(list.length)
                )}

                ${metricCard(
                    "Fonte",
                    "PostgreSQL"
                )}

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

                                <th>Pedido</th>
                                <th>Cliente</th>
                                <th>Total</th>
                                <th>Pedido</th>
                                <th>Pagamento</th>
                                <th>Ações</th>

                            </tr>

                        </thead>

                        <tbody>

                            ${
                                rows ||
                                `
                                    <tr>
                                        <td
                                            colspan="6"
                                            class="admin-empty-cell"
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


/* ============================================================
   DETALHES DO PEDIDO
   ============================================================ */

async function openOrderDetails(orderId) {

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


    modal.classList.add("is-open");

    modal.setAttribute(
        "aria-hidden",
        "false"
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


function renderOrderDetails(content, order) {

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
                Number(item.quantity) || 0;

            const price =
                Number(item.price) || 0;

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

        <div class="admin-module-data">

            <div class="admin-metrics-grid">

                ${metricCard(
                    "Pedido",
                    orderNumber
                )}

                ${metricCard(
                    "Subtotal",
                    formatCurrency(subtotal)
                )}

                ${metricCard(
                    "Frete",
                    formatCurrency(shipping)
                )}

                ${metricCard(
                    "Total",
                    formatCurrency(total)
                )}

            </div>


            <section class="module-panel">

                <div class="module-panel-header">

                    <div>

                        <span class="module-eyebrow">
                            CLIENTE
                        </span>

                        <h3>
                            ${escapeHtml(
                                customer.name ||
                                "Cliente não identificado"
                            )}
                        </h3>

                        <p>
                            ${escapeHtml(
                                customer.email ||
                                "E-mail não informado"
                            )}
                        </p>

                    </div>

                </div>


                <div class="admin-operation-grid">

                    <article class="admin-operation-card">

                        <span>
                            Telefone
                        </span>

                        <strong>
                            ${escapeHtml(
                                customer.phone ||
                                "—"
                            )}
                        </strong>

                    </article>


                    <article class="admin-operation-card">

                        <span>
                            Status do pedido
                        </span>

                        <strong>
                            ${renderStatus(
                                order.status
                            )}
                        </strong>

                    </article>


                    <article class="admin-operation-card">

                        <span>
                            Pagamento
                        </span>

                        <strong>
                            ${renderStatus(
                                order.payment_status ||
                                order.payment?.status ||
                                "—"
                            )}
                        </strong>

                    </article>


                    <article class="admin-operation-card">

                        <span>
                            Desconto
                        </span>

                        <strong>
                            ${formatCurrency(discount)}
                        </strong>

                    </article>

                </div>

            </section>


            <section class="module-panel">

                <div class="module-panel-header">

                    <div>
                        <h3>
                            Itens do pedido
                        </h3>
                    </div>

                </div>


                <div class="admin-table-wrap">

                    <table class="admin-table">

                        <thead>

                            <tr>
                                <th>Produto</th>
                                <th>Qtd.</th>
                                <th>Preço</th>
                                <th>Total</th>
                            </tr>

                        </thead>

                        <tbody>

                            ${
                                itemRows ||
                                `
                                    <tr>
                                        <td
                                            colspan="4"
                                            class="admin-empty-cell"
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

        </div>
    `;
}


/* ============================================================
   EVENTOS
   ============================================================ */

document.addEventListener(
    "click",
    event => {

        const sectionButton =
            event.target.closest(
                "[data-admin-section]"
            );

        if (sectionButton) {

            const section =
                sectionButton.dataset.adminSection;

            load(section);

            return;
        }


        const orderButton =
            event.target.closest(
                "[data-order-details]"
            );

        if (orderButton) {

            openOrderDetails(
                orderButton.dataset.orderDetails
            );

            return;
        }


        if (
            event.target.closest(
                "[data-close-order-modal]"
            )
        ) {

            const modal =
                document.querySelector(
                    "#adminOrderModal"
                );

            if (modal) {

                modal.classList.remove(
                    "is-open"
                );

                modal.setAttribute(
                    "aria-hidden",
                    "true"
                );
            }
        }


        if (
            event.target.closest(
                "#adminLogout"
            )
        ) {

            try {
                localStorage.removeItem(
                    "aurea-admin-token"
                );
            } catch {}

            window.location.href =
                "./admin-login.html";
        }

    }
);


/* ============================================================
   INICIALIZACAO
   ============================================================ */

load("dashboard");
