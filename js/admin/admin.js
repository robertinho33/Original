
const adminApi = window.AdminAPI;

import { updateProduct } from './product-repository.js';

import {
    confirmPayment,
    advanceLogistics
} from '../orders/order-admin-service.js';

import {
    LOGISTICS_STATUS,
    LOGISTICS_STATUS_LABELS
} from '../orders/logistics-status.js';

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
                        NEFER ADMIN
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
                                                        "�"
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
            "[NEFER ADMIN] #admin-root não encontrado."
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
        "Visão geral da operação da NEFER"
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
        "Parâmetros centrais da NEFER."
    ]

};


const info =
    labels[section] || [
        "NEFER ADMIN",
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
                    "Firebase / Firestore"
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
                            escapeHtml(pick(
    row,
    ["category_name", "category"],
    "Sem categoria"
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
,
                    {
                        label: "Ações",
                        render: row => `
                            <button
                                type="button"
                                class="admin-product-edit"
                                data-product-id="${escapeHtml(
                                    String(
                                        row.id ||
                                        row.productId ||
                                        ""
                                    )
                                )}"
                            >
                                Editar
                            </button>
                        `
                    }                ],

                list
            )}

        </div>
    `;


    content.outerHTML =
        html;
}


function openProductEditor(product) {

    const oldModal =
        document.getElementById("aurea-product-editor");

    if (oldModal) {
        oldModal.remove();
    }

    const read = (keys, fallback = "") =>
        String(
            pick(product, keys, fallback) ??
            fallback
        );

    const productId =
        product?.id ??
        product?.productId ??
        product?.docId ??
        "";

    if (!productId) {
        console.error(
            "[ADMIN PRODUCTS] Produto sem ID:",
            product
        );

        showAdminToast?.(
            "Não foi possível identificar o produto.",
            "error"
        );

        return;
    }

    const modal =
        document.createElement("div");

    modal.id =
        "aurea-product-editor";

    modal.className =
        "admin-product-editor-overlay";

    modal.innerHTML = `
        <div
            class="admin-product-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="aurea-product-editor-title"
        >

            <div class="admin-product-editor-header">

                <div>
                    <h2 id="aurea-product-editor-title">
                        Editar produto
                    </h2>

                    <p>
                        AlterAções salvas no Firebase / Firestore.
                    </p>
                </div>

                <button
                    type="button"
                    class="admin-product-editor-close"
                    aria-label="Fechar"
                >
                    ?
                </button>

            </div>

            <form
                id="aurea-product-editor-form"
                class="admin-product-editor-form"
            >

                <input
                    type="hidden"
                    name="productId"
                    value="${escapeHtml(productId)}"
                >

                <div class="admin-product-editor-grid">

                    <label>
                        Nome

                        <input
                            name="name"
                            type="text"
                            required
                            value="${escapeHtml(
                                read([
                                    "name",
                                    "product_name",
                                    "title"
                                ])
                            )}"
                        >
                    </label>

                    <label>
                        SKU

                        <input
                            name="sku"
                            type="text"
                            required
                            value="${escapeHtml(
                                read([
                                    "sku",
                                    "code",
                                    "product_code"
                                ])
                            )}"
                        >
                    </label>

                    <label>
                        Preço

                        <input
                            name="price"
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            value="${escapeHtml(
                                read(
                                    [
                                        "price",
                                        "sale_price",
                                        "amount"
                                    ],
                                    "0"
                                )
                            )}"
                        >
                    </label>

                    <label>
                        Preço promocional

                        <input
                            name="promotionalPrice"
                            type="number"
                            min="0"
                            step="0.01"
                            value="${escapeHtml(
                                read([
                                    "promotionalPrice",
                                    "promotional_price",
                                    "promoPrice"
                                ])
                            )}"
                        >
                    </label>

                    <label>
                        Estoque

                        <input
                            name="stock"
                            type="number"
                            min="0"
                            step="1"
                            required
                            value="${escapeHtml(
                                read(["stock"], "0")
                            )}"
                        >
                    </label>

                    <label>
                        Categoria

                        <input
                            name="category"
                            type="text"
                            value="${escapeHtml(
                                read(["category"])
                            )}"
                        >
                    </label>

                    <label class="admin-product-editor-full">
                        Descrição

                        <textarea
                            name="description"
                            rows="5"
                        >${escapeHtml(
                            read(["description", "details"])
                        )}</textarea>
                    </label>

                    <label class="admin-product-editor-full">
                        Imagem

                        <input
                            name="image"
                            type="text"
                            value="${escapeHtml(
                                read([
                                    "image",
                                    "imageUrl",
                                    "image_url"
                                ])
                            )}"
                        >
                    </label>

                </div>

                <div class="admin-product-editor-actions">

                    <button
                        type="button"
                        class="admin-product-editor-cancel"
                    >
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        class="admin-product-editor-save"
                    >
                        Salvar alterações
                    </button>

                </div>

            </form>

        </div>
    `;

    document.body.appendChild(modal);

    const form =
        modal.querySelector(
            "#aurea-product-editor-form"
        );

    const close =
        () => {
            modal.remove();
        };

    modal
        .querySelector(
            ".admin-product-editor-close"
        )
        ?.addEventListener(
            "click",
            close
        );

    modal
        .querySelector(
            ".admin-product-editor-cancel"
        )
        ?.addEventListener(
            "click",
            close
        );

    modal.addEventListener(
        "click",
        event => {
            if (event.target === modal) {
                close();
            }
        }
    );

    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const saveButton =
                form.querySelector(
                    ".admin-product-editor-save"
                );

            if (!saveButton) {
                return;
            }

            const formData =
                new FormData(form);

            const numeric =
                value => {
                    const parsed =
                        Number(value);

                    return Number.isFinite(parsed)
                        ? parsed
                        : 0;
                };

            const updatedProduct = {

                name:
                    String(
                        formData.get("name") ?? ""
                    ).trim(),

                sku:
                    String(
                        formData.get("sku") ?? ""
                    ).trim(),

                price:
                    numeric(
                        formData.get("price")
                    ),

                promotionalPrice:
                    numeric(
                        formData.get(
                            "promotionalPrice"
                        )
                    ),

                stock:
                    Math.max(
                        0,
                        Math.trunc(
                            numeric(
                                formData.get("stock")
                            )
                        )
                    ),

                category:
                    String(
                        formData.get("category") ?? ""
                    ).trim(),

                description:
                    String(
                        formData.get("description") ?? ""
                    ).trim(),

                image:
                    String(
                        formData.get("image") ?? ""
                    ).trim()
            };

            if (!updatedProduct.name) {
                showAdminToast?.(
                    "Informe o nome do produto.",
                    "error"
                );

                return;
            }

            if (!updatedProduct.sku) {
                showAdminToast?.(
                    "Informe o SKU do produto.",
                    "error"
                );

                return;
            }

            saveButton.disabled = true;
            saveButton.dataset.originalText =
                saveButton.textContent;

            saveButton.textContent =
                "Salvando...";

            try {

                const saved =
                    await updateProduct(
                        productId,
                        updatedProduct
                    );

                const products =
                    Array.isArray(
                        window.__aureaAdminProducts
                    )
                        ? window.__aureaAdminProducts
                        : [];

                const index =
                    products.findIndex(
                        item =>
                            String(
                                item?.id ??
                                item?.productId ??
                                item?.docId ??
                                ""
                            ) ===
                            String(productId)
                    );

                const normalizedSaved =
                    saved &&
                    typeof saved === "object"
                        ? saved
                        : {
                            ...product,
                            ...updatedProduct,
                            id: productId
                        };

                if (index >= 0) {
                    products[index] = {
                        ...products[index],
                        ...normalizedSaved,
                        ...updatedProduct,
                        id:
                            products[index].id ??
                            productId
                    };
                } else {
                    products.push({
                        ...product,
                        ...normalizedSaved,
                        ...updatedProduct,
                        id: productId
                    });
                }

                window.__aureaAdminProducts =
                    products;

                close();

                showAdminToast?.(
                    "Produto atualizado com sucesso.",
                    "success"
                );

                if (
                    typeof loadProducts ===
                    "function"
                ) {
                    await loadProducts();
                } else if (
                    typeof renderProducts ===
                    "function"
                ) {
                    renderProducts(products);
                }

            } catch (error) {

                console.error(
                    "[ADMIN PRODUCTS] Erro ao salvar produto:",
                    error
                );

                showAdminToast?.(
                    error?.message ||
                    "Não foi possível salvar o produto.",
                    "error"
                );

            } finally {

                saveButton.disabled =
                    false;

                saveButton.textContent =
                    saveButton.dataset.originalText ||
                    "Salvar alterações";
            }
        }
    );

    setTimeout(
        () => {
            modal
                .querySelector(
                    'input[name="name"]'
                )
                ?.focus();
        },
        0
    );
}

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
                    "Firebase / Firestore"
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
,
                    {
                        label: "Ações",
                        render: row => `
                            <button
                                type="button"
                                class="admin-product-edit"
                                data-product-id="${escapeHtml(
                                    String(
                                        row.id ||
                                        row.productId ||
                                        ""
                                    )
                                )}"
                            >
                                Editar
                            </button>
                        `
                    }                ],

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
,
                    {
                        label: "Ações",
                        render: row => `
                            <button
                                type="button"
                                class="admin-product-edit"
                                data-product-id="${escapeHtml(
                                    String(
                                        row.id ||
                                        row.productId ||
                                        ""
                                    )
                                )}"
                            >
                                Editar
                            </button>
                        `
                    }                ],

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
                    "Firebase / Firestore"
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
,
                    {
                        label: "Ações",
                        render: row => `
                            <button
                                type="button"
                                class="admin-product-edit"
                                data-product-id="${escapeHtml(
                                    String(
                                        row.id ||
                                        row.productId ||
                                        ""
                                    )
                                )}"
                            >
                                Editar
                            </button>
                        `
                    }                ],

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
            [
                "grossRevenue",
                "revenue",
                "totalRevenue",
                "sales"
            ],
            0
        );

    const orders =
        pick(
            data,
            [
                "confirmedOrders",
                "orders",
                "totalOrders"
            ],
            0
        );

    const average =
        pick(
            data,
            [
                "averageTicket",
                "average_ticket",
                "ticket"
            ],
            orders > 0
                ? Number(revenue) / Number(orders)
                : 0
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
                    "Firebase / Firestore"
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
                            Firebase / Firestore
                        </strong>

                    </article>

                </div>

            </section>

        </div>
    `;

/* ============================================================
   CUPONS
   ============================================================ */

function renderCoupons(content, coupons) {
    const list = Array.isArray(coupons)
        ? coupons
        : [];

    const activeCount = list.filter(row => {
        const status = String(
            pick(
                row,
                ["status", "state"],
                "active"
            )
        ).toLowerCase();

        return (
            status === "active" ||
            status === "ativo"
        );
    }).length;

    content.outerHTML = `
        <div class="admin-module-data">

            <div class="admin-metrics-grid">

                ${metricCard(
                    "Cupons cadastrados",
                    formatNumber(list.length)
                )}

                ${metricCard(
                    "Cupons ativos",
                    formatNumber(activeCount)
                )}

                ${metricCard(
                    "Fonte",
                    "Firebase / Firestore"
                )}

            </div>

            <div class="admin-panel">

                <div class="admin-panel-header">

                    <div>
                        <h3>Campanhas e cupons</h3>

                        <p>
                            Crie e edite seus cupons diretamente no painel.
                        </p>
                    </div>

                    <button
                        type="button"
                        class="admin-primary-button"
                        id="admin-new-coupon"
                    >
                        Novo cupom
                    </button>

                </div>

                ${
                    list.length === 0
                        ? `
                            <div class="admin-empty">
                                Nenhum cupom cadastrado.
                            </div>
                        `
                        : table(
                            "Campanhas e cupons",
                            [
                                {
                                    label: "Código",

                                    render: row => `
                                        <strong>
                                            ${escapeHtml(
                                                String(
                                                    pick(
                                                        row,
                                                        [
                                                            "code",
                                                            "coupon_code",
                                                            "couponCode"
                                                        ],
                                                        "—"
                                                    )
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
                                                    "percentage",
                                                    "value"
                                                ],
                                                0
                                            );

                                        const type =
                                            String(
                                                pick(
                                                    row,
                                                    [
                                                        "discountType",
                                                        "discount_type",
                                                        "type"
                                                    ],
                                                    "percentage"
                                                )
                                            ).toLowerCase();

                                        if (
                                            type.includes(
                                                "percent"
                                            ) ||
                                            type === "%"
                                        ) {
                                            return `${escapeHtml(
                                                String(value)
                                            )}%`;
                                        }

                                        return formatCurrency(
                                            value
                                        );
                                    }
                                },

                                {
                                    label: "Status",

                                    render: row =>
                                        renderStatus(
                                            pick(
                                                row,
                                                [
                                                    "status",
                                                    "state"
                                                ],
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
                                                [
                                                    "expiresAt",
                                                    "expires_at",
                                                    "expirationDate",
                                                    "expiration_date",
                                                    "validUntil",
                                                    "valid_until"
                                                ],
                                                null
                                            )
                                        )
                                },

                                {
                                    label: "Ações",

                                    render: row => `
                                        <div class="admin-actions">

                                            <button
                                                type="button"
                                                class="admin-product-edit admin-coupon-edit"
                                                data-coupon-id="${escapeHtml(
                                                    String(
                                                        row.id ||
                                                        row.couponId ||
                                                        ""
                                                    )
                                                )}"
                                            >
                                                Editar
                                            </button>

                                            <button
                                                type="button"
                                                class="admin-coupon-delete"
                                                data-coupon-id="${escapeHtml(
                                                    String(
                                                        row.id ||
                                                        row.couponId ||
                                                        ""
                                                    )
                                                )}"
                                            >
                                                Excluir
                                            </button>

                                        </div>
                                    `
                                }
                            ],
                            list
                        )
                }

            </div>
        </div>
    `;

    const newButton =
        document.getElementById(
            "admin-new-coupon"
        );

    if (newButton) {
        newButton.addEventListener(
            "click",
            () => openCouponEditor(null)
        );
    }

    document
        .querySelectorAll(
            ".admin-coupon-edit"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    const id =
                        button.dataset.couponId;

                    const coupon =
                        list.find(
                            row =>
                                String(row.id) ===
                                String(id)
                        );

                    if (coupon) {
                        openCouponEditor(coupon);
                    }
                }
            );
        });

    document
        .querySelectorAll(
            ".admin-coupon-delete"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                async () => {
                    const id =
                        button.dataset.couponId;

                    if (!id) {
                        return;
                    }

                    const confirmed =
                        window.confirm(
                            "Excluir este cupom?"
                        );

                    if (!confirmed) {
                        return;
                    }

                    try {
                        await adminApi.deleteCoupon(
                            id
                        );

                        showAdminToast(
                            "Cupom excluído.",
                            "success"
                        );

                        await loadModule(
                            "coupons"
                        );
                    } catch (error) {
                        console.error(
                            "[COUPON DELETE]",
                            error
                        );

                        showAdminToast(
                            error.message ||
                            "Erro ao excluir cupom.",
                            "error"
                        );
                    }
                }
            );
        });
}

function openCouponEditor(coupon = null) {
    const editing = Boolean(coupon);

    const oldModal =
        document.getElementById(
            "nefer-coupon-editor"
        );

    if (oldModal) {
        oldModal.remove();
    }

    const modal =
        document.createElement("div");

    modal.id =
        "nefer-coupon-editor";

    modal.className =
        "admin-modal-overlay";

    modal.innerHTML = `
        <div class="admin-modal">

            <div class="admin-modal-header">

                <div>
                    <h2>
                        ${
                            editing
                                ? "Editar cupom"
                                : "Novo cupom"
                        }
                    </h2>

                    <p>
                        Dados comerciais do cupom.
                    </p>
                </div>

                <button
                    type="button"
                    class="admin-modal-close"
                    id="coupon-editor-close"
                >
                    ×
                </button>

            </div>

            <form id="coupon-editor-form">

                <div class="admin-form-grid">

                    <label>
                        <span>Código</span>

                        <input
                            id="coupon-code"
                            type="text"
                            required
                            maxlength="50"
                            value="${escapeHtml(
                                String(
                                    coupon?.code ||
                                    coupon?.coupon_code ||
                                    ""
                                )
                            )}"
                        >
                    </label>

                    <label>
                        <span>Tipo de desconto</span>

                        <select
                            id="coupon-discount-type"
                        >
                            <option
                                value="percentage"
                                ${
                                    String(
                                        coupon?.discountType ||
                                        coupon?.discount_type ||
                                        "percentage"
                                    ) === "percentage"
                                        ? "selected"
                                        : ""
                                }
                            >
                                Percentual
                            </option>

                            <option
                                value="fixed"
                                ${
                                    String(
                                        coupon?.discountType ||
                                        coupon?.discount_type ||
                                        ""
                                    ) === "fixed"
                                        ? "selected"
                                        : ""
                                }
                            >
                                Valor fixo
                            </option>
                        </select>
                    </label>

                    <label>
                        <span>Desconto</span>

                        <input
                            id="coupon-discount"
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            value="${escapeHtml(
                                String(
                                    coupon?.discount ??
                                    coupon?.discount_value ??
                                    coupon?.value ??
                                    0
                                )
                            )}"
                        >
                    </label>

                    <label>
                        <span>Limite de uso</span>

                        <input
                            id="coupon-usage-limit"
                            type="number"
                            min="0"
                            step="1"
                            value="${escapeHtml(
                                String(
                                    coupon?.usageLimit ??
                                    coupon?.usage_limit ??
                                    ""
                                )
                            )}"
                        >
                    </label>

                    <label>
                        <span>Validade</span>

                        <input
                            id="coupon-expires-at"
                            type="date"
                            value="${escapeHtml(
                                String(
                                    coupon?.expiresAt ||
                                    coupon?.expires_at ||
                                    ""
                                ).slice(0, 10)
                            )}"
                        >
                    </label>

                    <label>
                        <span>Status</span>

                        <select
                            id="coupon-status"
                        >
                            <option
                                value="active"
                                ${
                                    String(
                                        coupon?.status ||
                                        "active"
                                    ) === "active"
                                        ? "selected"
                                        : ""
                                }
                            >
                                Ativo
                            </option>

                            <option
                                value="inactive"
                                ${
                                    String(
                                        coupon?.status ||
                                        ""
                                    ) === "inactive"
                                        ? "selected"
                                        : ""
                                }
                            >
                                Inativo
                            </option>
                        </select>
                    </label>

                    <label>
                        <span>Afiliado / Influenciador</span>

                        <input
                            id="coupon-affiliate"
                            type="text"
                            maxlength="120"
                            value="${escapeHtml(
                                String(
                                    coupon?.affiliateName ||
                                    coupon?.affiliate_name ||
                                    ""
                                )
                            )}"
                        >
                    </label>

                    <label>
                        <span>Comissão (%)</span>

                        <input
                            id="coupon-commission"
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value="${escapeHtml(
                                String(
                                    coupon?.commission ||
                                    0
                                )
                            )}"
                        >
                    </label>

                </div>

                <div class="admin-modal-footer">

                    <button
                        type="button"
                        class="admin-secondary-button"
                        id="coupon-editor-cancel"
                    >
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        class="admin-primary-button"
                    >
                        ${
                            editing
                                ? "Salvar alterações"
                                : "Criar cupom"
                        }
                    </button>

                </div>

            </form>

        </div>
    `;

    document.body.appendChild(modal);

    const close = () => {
        modal.remove();
    };

    document
        .getElementById(
            "coupon-editor-close"
        )
        ?.addEventListener(
            "click",
            close
        );

    document
        .getElementById(
            "coupon-editor-cancel"
        )
        ?.addEventListener(
            "click",
            close
        );

    document
        .getElementById(
            "coupon-editor-form"
        )
        ?.addEventListener(
            "submit",
            async event => {
                event.preventDefault();

                const data = {
                    code:
                        document
                            .getElementById(
                                "coupon-code"
                            )
                            .value
                            .trim()
                            .toUpperCase(),

                    discountType:
                        document
                            .getElementById(
                                "coupon-discount-type"
                            )
                            .value,

                    discount:
                        Number(
                            document
                                .getElementById(
                                    "coupon-discount"
                                )
                                .value
                        ),

                    usageLimit:
                        document
                            .getElementById(
                                "coupon-usage-limit"
                            )
                            .value,

                    expiresAt:
                        document
                            .getElementById(
                                "coupon-expires-at"
                            )
                            .value,

                    status:
                        document
                            .getElementById(
                                "coupon-status"
                            )
                            .value,

                    affiliateName:
                        document
                            .getElementById(
                                "coupon-affiliate"
                            )
                            .value
                            .trim(),

                    commission:
                        Number(
                            document
                                .getElementById(
                                    "coupon-commission"
                                )
                                .value
                        )
                };

                try {
                    if (editing) {
                        await adminApi.updateCoupon(
                            coupon.id,
                            data
                        );
                    } else {
                        await adminApi.createCoupon(
                            data
                        );
                    }

                    close();

                    showAdminToast(
                        editing
                            ? "Cupom atualizado."
                            : "Cupom criado.",
                        "success"
                    );

                    await loadModule(
                        "coupons"
                    );
                } catch (error) {
                    console.error(
                        "[COUPON SAVE]",
                        error
                    );

                    showAdminToast(
                        error.message ||
                        "Erro ao salvar cupom.",
                        "error"
                    );
                }
            }
        );
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
                    "Firebase / Firestore"
                )}

            </div>


            ${table(
                "Expedi��o e rastreamento",

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
,
                    {
                        label: "Ações",
                        render: row => `
                            <button
                                type="button"
                                class="admin-product-edit"
                                data-product-id="${escapeHtml(
                                    String(
                                        row.id ||
                                        row.productId ||
                                        ""
                                    )
                                )}"
                            >
                                Editar
                            </button>
                        `
                    }                ],

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
                    "Firebase / Firestore"
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
                                            "-"
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
,
                    {
                        label: "Ações",
                        render: row => `
                            <button
                                type="button"
                                class="admin-product-edit"
                                data-product-id="${escapeHtml(
                                    String(
                                        row.id ||
                                        row.productId ||
                                        ""
                                    )
                                )}"
                            >
                                Editar
                            </button>
                        `
                    }                ],

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
                    "Firebase / Firestore"
                )}

            </div>


            ${table(
                "Parâmetros da NEFER",

                [
                    {
                        label: "Chave",
                        render: row => `
                            <strong>
                                ${escapeHtml(
                                    pick(
                                        row,
                                        ["key", "name", "setting_key"],
                                        "-"
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
                                    "-"
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
,
                    {
                        label: "Ações",
                        render: row => `
                            <button
                                type="button"
                                class="admin-product-edit"
                                data-product-id="${escapeHtml(
                                    String(
                                        row.id ||
                                        row.productId ||
                                        ""
                                    )
                                )}"
                            >
                                Editar
                            </button>
                        `
                    }                ],

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
                    "Firebase / Firestore"
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


    modal.removeAttribute("inert");

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
                            NEFER ADMIN
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
        `#${order.id || "?"}`;

    const customer =
        order.customer || {};

    const paymentStatus =
        order.payment_status ||
        order.payment?.status ||
        "pending";

    const logisticsStatus =
        order.logistics?.status ||
        "new";

    const logisticsLabel =
        LOGISTICS_STATUS_LABELS[logisticsStatus] ||
        logisticsStatus;

    const items =
        Array.isArray(order.items)
            ? order.items
            : [];

    const history =
        Array.isArray(order.history)
            ? order.history
            : Array.isArray(order.events)
                ? order.events
                : [];

    const subtotal =
        Number(
            order.subtotal ??
            order.totals?.subtotal ??
            0
        );

    const shipping =
        Number(
            order.shipping ??
            order.shipping_cost ??
            order.shippingCost ??
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

    const itemRows = items.map(item => {

        const quantity =
            Number(item.quantity) || 0;

        const price =
            Number(
                item.unitPrice ??
                item.price ??
                item.unit_price ??
                0
            );

        return `
            <tr>
                <td>
                    ${escapeHtml(
                        item.name ||
                        item.product_name ||
                        "Produto"
                    )}
                </td>

                <td>${quantity}</td>

                <td>${formatCurrency(price)}</td>

                <td>
                    ${formatCurrency(
                        price * quantity
                    )}
                </td>
            </tr>
        `;

    }).join("");

    const showPaymentButton =
        paymentStatus !== "paid" &&
        paymentStatus !== "confirmed";

    const showLogisticsButton =
        paymentStatus === "paid" ||
        paymentStatus === "confirmed";

    content.innerHTML = `

        <div class="admin-order-details">

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
                            OPERA??O
                        </span>

                        <h3>
                            Detalhes do pedido
                        </h3>
                    </div>

                </div>

                <div class="admin-operation-grid">

                    <article class="admin-operation-card">
                        <span>Status do pedido</span>
                        <strong>
                            ${renderStatus(order.status)}
                        </strong>
                    </article>

                    <article class="admin-operation-card">
                        <span>Pagamento</span>
                        <strong>
                            ${renderStatus(paymentStatus)}
                        </strong>
                    </article>

                    <article class="admin-operation-card">
                        <span>Logística</span>
                        <strong>
                            ${escapeHtml(logisticsLabel)}
                        </strong>
                    </article>

                    <article class="admin-operation-card">
                        <span>Desconto</span>
                        <strong>
                            ${formatCurrency(discount)}
                        </strong>
                    </article>

                </div>

                <div
                    style="
                        display:flex;
                        gap:12px;
                        flex-wrap:wrap;
                        margin-top:20px;
                    "
                >

                    ${
                        showPaymentButton
                            ? `
                                <button
                                    type="button"
                                    id="confirmOrderPayment"
                                >
                                    Confirmar pagamento
                                </button>
                            `
                            : ""
                    }

                    ${
                        showLogisticsButton
                            ? `
                                <button
                                    type="button"
                                    id="advanceOrderLogistics"
                                >
                                    Avançar logística
                                </button>
                            `
                            : ""
                    }

                </div>

            </section>

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

                        <span>Telefone</span>

                        <strong>
                            ${escapeHtml(
                                customer.phone || "?"
                            )}
                        </strong>

                    </article>

                </div>

            </section>

            <section class="module-panel">

                <div class="module-panel-header">

                    <div>
                        <span class="module-eyebrow">
                            PRODUTOS
                        </span>

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
                                        <td colspan="4">
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

                    <div>
                        <span class="module-eyebrow">
                            HISTÓRICO
                        </span>

                        <h3>
                            Eventos do pedido
                        </h3>
                    </div>

                </div>

                ${
                    history.length
                        ? `
                            <div class="order-history-list">

                                ${
                                    history
                                        .slice()
                                        .reverse()
                                        .map(event => `
                                            <div
                                                class="order-history-item"
                                            >
                                                <strong>
                                                    ${escapeHtml(
                                                        event.label ||
                                                        event.type ||
                                                        event.event ||
                                                        "Evento"
                                                    )}
                                                </strong>

                                                ${
                                                    event.createdAt
                                                        ? `
                                                            <span>
                                                                ${escapeHtml(
                                                                    formatDate(
                                                                        event.createdAt
                                                                    )
                                                                )}
                                                            </span>
                                                        `
                                                        : ""
                                                }
                                            </div>
                                        `)
                                        .join("")
                                }

                            </div>
                        `
                        : `
                            <p>
                                Nenhum evento registrado.
                            </p>
                        `
                }

            </section>

        </div>
    `;

    document
        .querySelector("#confirmOrderPayment")
        ?.addEventListener("click", async () => {

            const button =
                document.querySelector(
                    "#confirmOrderPayment"
                );

            try {

                button.disabled = true;

                await confirmPayment(order.id);

                window.alert(
                    "Pagamento confirmado."
                );

                await openOrderDetails(order.id);

            } catch (error) {

                console.error(
                    "[ADMIN ORDER] Erro ao confirmar pagamento:",
                    error
                );

                button.disabled = false;

                window.alert(
                    error?.message ||
                    "Não foi possível confirmar o pagamento."
                );
            }
        });

    document
        .querySelector("#advanceOrderLogistics")
        ?.addEventListener("click", async () => {

            const button =
                document.querySelector(
                    "#advanceOrderLogistics"
                );

            try {

                button.disabled = true;

                await advanceLogistics(order.id);

                window.alert(
                    "Status log?stico atualizado."
                );

                await openOrderDetails(order.id);

            } catch (error) {

                console.error(
                    "[ADMIN ORDER] Erro ao avan?ar logística:",
                    error
                );

                button.disabled = false;

                window.alert(
                    error?.message ||
                    "Não foi possível atualizar a logística."
                );
            }
        });
}


/* ============================================================
   EVENTOS
   ============================================================ */

document.addEventListener("click", async (event) => {
    // 1. Intercepta o clique no botão Editar Produto
    const editBtn = event.target.closest(".admin-product-edit");
    if (editBtn) {
        event.preventDefault();
        const productId = editBtn.dataset.productId;

        if (!productId) {
            console.error("ID do produto não encontrado no BOTÃO.");
            return;
        }

        try {
            // Busca os dados do produto (via adminAPI ou array local) e abre o modal
            let product = null;
            if (window.adminAPI && typeof window.adminAPI.getProductById === "function") {
                product = await window.adminAPI.getProductById(productId);
            } else if (Array.isArray(window.productsList)) {
                product = window.productsList.find(p => String(p.id || p.productId) === String(productId));
            }

            if (product) {
                openProductEditor(product);
            } else {
                alert("Produto não encontrado para edição.");
            }
        } catch (error) {
            console.error("Erro ao carregar produto para edição:", error);
        }
        return;
    }

    // 2. Navegação por seções
    const sectionButton = event.target.closest("[data-admin-section]");
    if (sectionButton) {
        // Navegação interna entre as seções do Admin
    }
});

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

            event.preventDefault();
            event.stopImmediatePropagation();

            const modal =
                document.querySelector(
                    "#adminOrderModal"
                );

            if (!modal) {
                return;
            }

            const activeElement =
                document.activeElement;

            if (
                activeElement &&
                modal.contains(activeElement)
            ) {
                activeElement.blur();
            }

            modal.classList.remove(
                "is-open"
            );

            modal.setAttribute(
                "aria-hidden",
                "true"
            );

            modal.setAttribute(
                "inert",
                ""
            );

            if (
                document.activeElement &&
                document.activeElement !== document.body
            ) {
                document.activeElement.blur();
            }

            return;
        }


        if (
            event.target.closest(
                "#adminLogout"
            )
        ) {
window.location.href =
                "./admin-login.html";
        }

    }
);


/* ============================================================
   INICIALIZACAO
   ============================================================ */

load("dashboard");

/** NEFER_PRODUCT_EDIT_HANDLER_V2_START */
(function installAureaProductEditHandler() {
    if (window.__aureaProductEditHandlerV2) {
        return;
    }

    document.addEventListener("click", async function (event) {
        const button = event.target.closest(
            "button.admin-product-edit"
        );

        if (!button) {
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();

        const productId = String(
            button.getAttribute("data-product-id") || ""
        ).trim();

        if (!productId) {
            console.error(
                "[NEFER ADMIN] Editar: data-product-id vazio."
            );
            return;
        }

        console.log(
            "[NEFER ADMIN] Editar clicado:",
            productId
        );

        let products = Array.isArray(
            window.__aureaAdminProducts
        )
            ? window.__aureaAdminProducts
            : [];

        let product = products.find(function (item) {
            return String(
                item?.id ??
                item?.productId ??
                item?.docId ??
                ""
            ) === productId;
        });

        /*
         * Se a lista global ainda nao estiver preenchida,
         * tenta obter os produtos pela API administrativa.
         */
        if (!product) {
            try {
                if (
                    window.AdminAPI &&
                    typeof window.AdminAPI.products === "function"
                ) {
                    console.log(
                        "[NEFER ADMIN] Buscando produto pela AdminAPI..."
                    );

                    const result =
                        await window.AdminAPI.products();

                    products = Array.isArray(result)
                        ? result
                        : Array.isArray(result?.products)
                            ? result.products
                            : Array.isArray(result?.data)
                                ? result.data
                                : [];

                    product = products.find(function (item) {
                        return String(
                            item?.id ??
                            item?.productId ??
                            item?.docId ??
                            ""
                        ) === productId;
                    });

                    if (product) {
                        window.__aureaAdminProducts = products;
                    }
                }
            } catch (error) {
                console.error(
                    "[NEFER ADMIN] Falha ao buscar produto:",
                    error
                );
            }
        }

        if (!product) {
            console.error(
                "[NEFER ADMIN] Produto nao encontrado:",
                productId
            );
            return;
        }

        if (typeof openProductEditor !== "function") {
            console.error(
                "[NEFER ADMIN] openProductEditor() nao esta acessivel."
            );
            return;
        }

        console.log(
            "[NEFER ADMIN] Abrindo editor:",
            product
        );

        openProductEditor(product);
    }, true);

    window.__aureaProductEditHandlerV2 = true;

    console.log(
        "[NEFER ADMIN] Handler V2 do Editar instalado."
    );
})();
/** NEFER_PRODUCT_EDIT_HANDLER_V2_END */
/* ============================================================
   NEFER ? POP-UP REAL DO EDITOR DE PRODUTOS
   ============================================================ */

(function installAureaProductEditorPopupStyle() {

    if (document.getElementById("aurea-product-editor-popup-style")) {
        return;
    }

    const style = document.createElement("style");

    style.id = "aurea-product-editor-popup-style";

    style.textContent = `
        /* CAMADA ESCURA */
        .admin-product-editor-overlay {
            position: fixed !important;
            inset: 0 !important;
            z-index: 99999 !important;

            display: flex !important;
            align-items: center !important;
            justify-content: center !important;

            width: 100vw !important;
            height: 100vh !important;

            padding: 24px !important;
            box-sizing: border-box !important;

            background: rgba(0, 0, 0, 0.62) !important;
            backdrop-filter: blur(5px) !important;

            overflow-y: auto !important;
        }

        /* PAINEL CENTRAL */
        .admin-product-editor-overlay .admin-product-editor {
            position: relative !important;

            width: min(820px, 100%) !important;
            max-width: 820px !important;

            max-height: calc(100vh - 48px) !important;
            overflow-y: auto !important;

            margin: auto !important;
            padding: 28px !important;

            box-sizing: border-box !important;

            background: #ffffff !important;
            color: #171717 !important;

            border-radius: 18px !important;

            box-shadow:
                0 25px 80px rgba(0, 0, 0, 0.38),
                0 8px 30px rgba(0, 0, 0, 0.18) !important;

            transform: none !important;
            opacity: 1 !important;
        }

        /* CABE?ALHO */
        .admin-product-editor .admin-product-editor-header {
            display: flex !important;
            align-items: flex-start !important;
            justify-content: space-between !important;

            gap: 20px !important;
            margin-bottom: 24px !important;

            padding-bottom: 18px !important;

            border-bottom: 1px solid #eeeeee !important;
        }

        .admin-product-editor .admin-product-editor-header h2 {
            margin: 0 0 6px 0 !important;

            color: #171717 !important;

            font-size: 22px !important;
            line-height: 1.25 !important;
        }

        .admin-product-editor .admin-product-editor-header p {
            margin: 0 !important;

            color: #777777 !important;

            font-size: 13px !important;
        }

        /* botão X */
        .admin-product-editor .admin-product-editor-close {
            flex: 0 0 auto !important;

            width: 38px !important;
            height: 38px !important;

            padding: 0 !important;

            border: 0 !important;
            border-radius: 50% !important;

            background: #f1f1f1 !important;
            color: #222222 !important;

            font-size: 24px !important;
            line-height: 38px !important;

            cursor: pointer !important;

            transition:
                background 0.15s ease,
                transform 0.15s ease !important;
        }

        .admin-product-editor .admin-product-editor-close:hover {
            background: #e5e5e5 !important;
            transform: scale(1.05) !important;
        }

        /* FORMULÁRIO */
        .admin-product-editor .admin-product-editor-form {
            display: grid !important;
            gap: 18px !important;

            width: 100% !important;
        }

        /* GRID DOS CAMPOS */
        .admin-product-editor .admin-product-editor-grid {
            display: grid !important;

            grid-template-columns:
                repeat(2, minmax(0, 1fr)) !important;

            gap: 16px !important;

            width: 100% !important;
        }

        /* LABEL */
        .admin-product-editor label {
            display: flex !important;
            flex-direction: column !important;

            gap: 7px !important;

            color: #333333 !important;

            font-size: 13px !important;
            font-weight: 600 !important;
        }

        /* CAMPOS */
        .admin-product-editor input,
        .admin-product-editor textarea,
        .admin-product-editor select {
            width: 100% !important;

            min-height: 42px !important;

            box-sizing: border-box !important;

            padding: 10px 12px !important;

            border: 1px solid #d8d8d8 !important;
            border-radius: 9px !important;

            background: #ffffff !important;
            color: #171717 !important;

            font-family: inherit !important;
            font-size: 14px !important;

            outline: none !important;

            transition:
                border-color 0.15s ease,
                box-shadow 0.15s ease !important;
        }

        .admin-product-editor input:focus,
        .admin-product-editor textarea:focus,
        .admin-product-editor select:focus {
            border-color: #888888 !important;

            box-shadow:
                0 0 0 3px rgba(0, 0, 0, 0.06) !important;
        }

        .admin-product-editor textarea {
            min-height: 110px !important;
            resize: vertical !important;
        }

        /* ?REA DOS BOT?ES */
        .admin-product-editor .admin-product-editor-actions {
            display: flex !important;

            justify-content: flex-end !important;
            align-items: center !important;

            gap: 10px !important;

            margin-top: 4px !important;
            padding-top: 18px !important;

            border-top: 1px solid #eeeeee !important;
        }

        .admin-product-editor .admin-product-editor-actions button {
            min-height: 42px !important;

            padding: 10px 20px !important;

            border: 0 !important;
            border-radius: 9px !important;

            cursor: pointer !important;

            font-family: inherit !important;
            font-size: 14px !important;
            font-weight: 700 !important;
        }

        .admin-product-editor .admin-product-editor-cancel {
            background: #eeeeee !important;
            color: #222222 !important;
        }

        .admin-product-editor .admin-product-editor-save {
            background: #171717 !important;
            color: #ffffff !important;
        }

        .admin-product-editor .admin-product-editor-save:hover {
            background: #333333 !important;
        }

        /* MOBILE */
        @media (max-width: 700px) {

            .admin-product-editor-overlay {
                padding: 12px !important;
            }

            .admin-product-editor-overlay .admin-product-editor {
                width: 100% !important;
                max-height: calc(100vh - 24px) !important;

                padding: 20px !important;

                border-radius: 14px !important;
            }

            .admin-product-editor .admin-product-editor-grid {
                grid-template-columns: 1fr !important;
            }

            .admin-product-editor .admin-product-editor-actions {
                flex-direction: column-reverse !important;
            }

            .admin-product-editor .admin-product-editor-actions button {
                width: 100% !important;
            }
        }
    `;

    document.head.appendChild(style);

    console.log(
        "[NEFER ADMIN] Estilo do popup de produtos instalado."
    );

})();