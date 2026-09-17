const MODULES = {
    dashboard: "Dashboard",
    orders: "Pedidos",
    products: "Produtos",
    categories: "Categorias",
    inventory: "Estoque",
    customers: "Clientes",
    finance: "Financeiro",
    coupons: "Cupons",
    logistics: "Logística",
    reports: "Relatórios",
    audit: "Auditoria",
    settings: "Configurações"
};

const API_BASE = "/api/admin";

const state = {
    cache: {},
    loading: false
};

async function api(module) {
    if (state.cache[module]) {
        return state.cache[module];
    }

    const response = await fetch(
        `${API_BASE}/${module}`,
        {
            headers: {
                Accept: "application/json"
            }
        }
    );

    if (!response.ok) {
        throw new Error(
            `Falha ao carregar ${module}: HTTP ${response.status}`
        );
    }

    const payload = await response.json();

    if (!payload.success) {
        throw new Error(
            payload.message || `Falha ao carregar ${module}`
        );
    }

    state.cache[module] = payload.data;

    return payload.data;
}

function money(value) {
    return new Intl.NumberFormat(
        "pt-BR",
        {
            style: "currency",
            currency: "BRL"
        }
    ).format(Number(value || 0));
}

function number(value) {
    return new Intl.NumberFormat(
        "pt-BR"
    ).format(Number(value || 0));
}

function date(value) {
    if (!value) {
        return "—";
    }

    return new Intl.DateTimeFormat(
        "pt-BR",
        {
            dateStyle: "short",
            timeStyle: "short"
        }
    ).format(new Date(value));
}

function statusClass(status) {
    const value = String(status || "").toLowerCase();

    if (
        value.includes("paid") ||
        value.includes("pago") ||
        value.includes("active") ||
        value.includes("ativo") ||
        value.includes("success") ||
        value.includes("sucesso") ||
        value.includes("delivered") ||
        value.includes("enviado")
    ) {
        return "success";
    }

    if (
        value.includes("pending") ||
        value.includes("pendente") ||
        value.includes("prepar") ||
        value.includes("aguard")
    ) {
        return "warning";
    }

    if (
        value.includes("cancel") ||
        value.includes("error") ||
        value.includes("erro") ||
        value.includes("expired") ||
        value.includes("inactive")
    ) {
        return "danger";
    }

    return "info";
}

function status(value) {
    return `
        <span class="status ${statusClass(value)}">
            ${value || "—"}
        </span>
    `;
}

function metricCard(
    label,
    value,
    detail
) {
    return `
        <article class="admin-metric">
            <span>${label}</span>
            <strong>${value}</strong>
            <small>${detail}</small>
        </article>
    `;
}

function table(
    headers,
    rows
) {
    if (!rows.length) {
        return `
            <div class="empty-module">
                <div class="empty-module-icon">◈</div>
                <strong>Nenhum registro</strong>
                <span>Não existem dados disponíveis para esta área.</span>
            </div>
        `;
    }

    return `
        <div class="admin-table-wrap">
            <table class="admin-table">
                <thead>
                    <tr>
                        ${headers
                            .map(header => `<th>${header}</th>`)
                            .join("")}
                    </tr>
                </thead>

                <tbody>
                    ${rows.join("")}
                </tbody>
            </table>
        </div>
    `;
}

function moduleShell(
    title,
    description,
    actions,
    content
) {
    return `
        <section class="module-panel">

            <div class="module-toolbar">
                <div>
                    <h2>${title}</h2>
                    <p>${description}</p>
                </div>

                <div class="module-actions">
                    ${actions || ""}
                </div>
            </div>

            ${content}

        </section>
    `;
}

function loading() {
    return `
        <section class="module-panel">
            <div class="admin-loading">
                <div class="admin-loading-spinner"></div>
                <strong>Carregando ${MODULES[currentSection()]}</strong>
                <span>Consultando dados da AURÉA.</span>
            </div>
        </section>
    `;
}

function errorView(error) {
    return `
        <section class="module-panel">
            <div class="admin-error">
                <div class="empty-module-icon">!</div>
                <strong>Não foi possível carregar os dados.</strong>
                <span>${error.message}</span>
                <button
                    class="admin-button primary"
                    data-admin-retry
                >
                    Tentar novamente
                </button>
            </div>
        </section>
    `;
}

function currentSection() {
    const active = document.querySelector(
        ".admin-section.active"
    );

    return active
        ? active.id.replace("section-", "")
        : "dashboard";
}

async function renderDashboard() {
    const data = await api("dashboard");

    return moduleShell(
        "Dashboard",
        "Visão geral da operação AURÉA em tempo real.",
        `
            <button
                class="admin-button"
                data-admin-refresh
            >
                Atualizar
            </button>
        `,
        `
            <div class="admin-summary-grid">

                ${metricCard(
                    "Faturamento",
                    money(data.revenue),
                    "Receita de pedidos pagos"
                )}

                ${metricCard(
                    "Pedidos",
                    number(data.orders),
                    "Pedidos registrados"
                )}

                ${metricCard(
                    "Clientes",
                    number(data.customers),
                    "Clientes cadastrados"
                )}

                ${metricCard(
                    "Ticket médio",
                    money(data.averageTicket),
                    "Pedidos pagos"
                )}

            </div>

            <div class="admin-summary-grid">

                ${metricCard(
                    "Estoque crítico",
                    number(data.lowStock),
                    "Produtos abaixo do mínimo"
                )}

                ${metricCard(
                    "Pagamentos pendentes",
                    number(data.pendingPayments),
                    "Aguardando pagamento"
                )}

                ${metricCard(
                    "Para expedir",
                    number(data.ordersToShip),
                    "Pedidos na logística"
                )}

                ${metricCard(
                    "Pedidos pagos",
                    number(data.paidOrders),
                    "Pedidos confirmados"
                )}

            </div>
        `
    );
}

async function renderOrders() {
    const rows = await api("orders");

    return moduleShell(
        "Pedidos",
        "Pedidos registrados no banco de dados.",
        `
            <button
                class="admin-button"
                data-admin-refresh
            >
                Atualizar
            </button>
        `,
        table(
            [
                "Pedido",
                "Cliente",
                "Pagamento",
                "Total",
                "Status",
                "Data"
            ],
            rows.map(item => `
                <tr>
                    <td>
                        <strong>${item.order_number}</strong>
                    </td>

                    <td>
                        ${item.customer_name || "Cliente"}
                    </td>

                    <td>
                        ${status(item.payment_status)}
                    </td>

                    <td>
                        <strong>
                            ${money(item.total_amount)}
                        </strong>
                    </td>

                    <td>
                        ${status(item.status)}
                    </td>

                    <td>
                        ${date(item.created_at)}
                    </td>
                </tr>
            `)
        )
    );
}

async function renderProducts() {
    const rows = await api("products");

    return moduleShell(
        "Produtos",
        "Catálogo comercial conectado ao PostgreSQL.",
        `
            <button class="admin-button primary">
                + Produto
            </button>
        `,
        table(
            [
                "SKU",
                "Produto",
                "Categoria",
                "Preço",
                "Disponível",
                "Status"
            ],
            rows.map(item => `
                <tr>
                    <td>
                        <strong>${item.sku}</strong>
                    </td>

                    <td>
                        ${item.name}
                    </td>

                    <td>
                        ${item.category || "—"}
                    </td>

                    <td>
                        ${money(item.price)}
                    </td>

                    <td>
                        ${number(item.available_quantity)}
                    </td>

                    <td>
                        ${item.active
                            ? status("Ativo")
                            : status("Inativo")}
                    </td>
                </tr>
            `)
        )
    );
}

async function renderCategories() {
    const rows = await api("categories");

    return moduleShell(
        "Categorias",
        "Categorias vinculadas diretamente aos produtos.",
        `
            <button class="admin-button primary">
                + Categoria
            </button>
        `,
        table(
            [
                "Categoria",
                "Slug",
                "Produtos",
                "Status"
            ],
            rows.map(item => `
                <tr>
                    <td>
                        <strong>${item.name}</strong>
                    </td>

                    <td>${item.slug}</td>

                    <td>
                        ${number(item.product_count)}
                    </td>

                    <td>
                        ${item.active
                            ? status("Ativo")
                            : status("Inativo")}
                    </td>
                </tr>
            `)
        )
    );
}

async function renderInventory() {
    const rows = await api("inventory");

    return moduleShell(
        "Estoque",
        "Disponibilidade, reservas e estoque mínimo.",
        `
            <button class="admin-button">
                Movimentações
            </button>

            <button class="admin-button primary">
                Entrada de estoque
            </button>
        `,
        table(
            [
                "SKU",
                "Produto",
                "Estoque",
                "Reservado",
                "Disponível",
                "Mínimo"
            ],
            rows.map(item => `
                <tr>
                    <td>
                        <strong>${item.sku}</strong>
                    </td>

                    <td>${item.name}</td>

                    <td>
                        ${number(item.stock_quantity)}
                    </td>

                    <td>
                        ${number(item.reserved_quantity)}
                    </td>

                    <td>
                        <strong>
                            ${number(item.available_quantity)}
                        </strong>
                    </td>

                    <td>
                        ${number(item.minimum_stock)}
                    </td>
                </tr>
            `)
        )
    );
}

async function renderCustomers() {
    const rows = await api("customers");

    return moduleShell(
        "Clientes",
        "Base de clientes consolidada.",
        `
            <button class="admin-button">
                Exportar
            </button>
        `,
        table(
            [
                "Cliente",
                "E-mail",
                "Telefone",
                "Pedidos",
                "Total gasto",
                "Cadastro"
            ],
            rows.map(item => `
                <tr>
                    <td>
                        <strong>${item.name}</strong>
                    </td>

                    <td>${item.email || "—"}</td>

                    <td>${item.phone || "—"}</td>

                    <td>
                        ${number(item.order_count)}
                    </td>

                    <td>
                        ${money(item.total_spent)}
                    </td>

                    <td>
                        ${date(item.created_at)}
                    </td>
                </tr>
            `)
        )
    );
}

async function renderFinance() {
    const data = await api("finance");

    return moduleShell(
        "Financeiro",
        "Indicadores financeiros derivados dos pedidos.",
        `
            <button
                class="admin-button"
                data-admin-refresh
            >
                Atualizar
            </button>
        `,
        `
            <div class="admin-summary-grid">

                ${metricCard(
                    "Faturamento",
                    money(data.revenue),
                    "Pedidos pagos"
                )}

                ${metricCard(
                    "Pedidos",
                    number(data.total_orders),
                    "Total registrado"
                )}

                ${metricCard(
                    "Ticket médio",
                    money(data.average_ticket),
                    "Pedidos pagos"
                )}

                ${metricCard(
                    "Pagamentos pendentes",
                    money(data.pending_revenue),
                    "Valor aguardando pagamento"
                )}

            </div>

            <div class="module-card">
                <h3>Descontos concedidos</h3>
                <strong class="finance-highlight">
                    ${money(data.discounts)}
                </strong>
            </div>
        `
    );
}

async function renderCoupons() {
    const rows = await api("coupons");

    return moduleShell(
        "Cupons",
        "Campanhas promocionais armazenadas no banco.",
        `
            <button class="admin-button primary">
                + Novo cupom
            </button>
        `,
        table(
            [
                "Código",
                "Tipo",
                "Desconto",
                "Uso",
                "Validade",
                "Status"
            ],
            rows.map(item => `
                <tr>
                    <td>
                        <strong>${item.code}</strong>
                    </td>

                    <td>${item.type}</td>

                    <td>
                        ${money(item.discount_value)}
                    </td>

                    <td>
                        ${number(item.usage_count)}
                        /
                        ${item.usage_limit || "∞"}
                    </td>

                    <td>
                        ${date(item.expires_at)}
                    </td>

                    <td>
                        ${status(item.computed_status)}
                    </td>
                </tr>
            `)
        )
    );
}

async function renderLogistics() {
    const rows = await api("logistics");

    return moduleShell(
        "Logística",
        "Expedição e entrega vinculadas aos pedidos.",
        `
            <button class="admin-button primary">
                Gerar expedição
            </button>
        `,
        table(
            [
                "Pedido",
                "Cliente",
                "Método",
                "Transportadora",
                "Rastreamento",
                "Status",
                "Previsão"
            ],
            rows.map(item => `
                <tr>
                    <td>
                        <strong>${item.order_number}</strong>
                    </td>

                    <td>
                        ${item.customer_name || "Cliente"}
                    </td>

                    <td>
                        ${item.method}
                    </td>

                    <td>
                        ${item.carrier || "—"}
                    </td>

                    <td>
                        ${item.tracking_code || "—"}
                    </td>

                    <td>
                        ${status(item.status)}
                    </td>

                    <td>
                        ${item.estimated_delivery
                            ? new Intl.DateTimeFormat(
                                "pt-BR"
                            ).format(
                                new Date(
                                    item.estimated_delivery
                                )
                            )
                            : "—"}
                    </td>
                </tr>
            `)
        )
    );
}

async function renderReports() {
    const data = await api("reports");
    const summary = data.summary || {};

    return moduleShell(
        "Relatórios",
        "Indicadores comerciais calculados pelo PostgreSQL.",
        `
            <button class="admin-button">
                Atualizar
            </button>

            <button class="admin-button primary">
                Exportar
            </button>
        `,
        `
            <div class="admin-summary-grid">

                ${metricCard(
                    "Faturamento",
                    money(summary.revenue),
                    "Pedidos pagos"
                )}

                ${metricCard(
                    "Pedidos",
                    number(summary.orders),
                    "Período consolidado"
                )}

                ${metricCard(
                    "Ticket médio",
                    money(summary.average_ticket),
                    "Pedidos pagos"
                )}

                ${metricCard(
                    "Produtos vendidos",
                    number(
                        (data.products || [])
                            .reduce(
                                (sum, item) =>
                                    sum +
                                    Number(
                                        item.quantity || 0
                                    ),
                                0
                            )
                    ),
                    "Unidades vendidas"
                )}

            </div>

            <div class="module-subgrid">

                <div class="module-card">
                    <h3>Produtos por faturamento</h3>

                    ${table(
                        [
                            "Produto",
                            "Unidades",
                            "Faturamento"
                        ],
                        (data.products || []).map(
                            item => `
                                <tr>
                                    <td>
                                        <strong>
                                            ${item.product_name}
                                        </strong>
                                    </td>

                                    <td>
                                        ${number(item.quantity)}
                                    </td>

                                    <td>
                                        ${money(item.revenue)}
                                    </td>
                                </tr>
                            `
                        )
                    )}
                </div>

                <div class="module-card">
                    <h3>Pedidos por status</h3>

                    ${table(
                        [
                            "Status",
                            "Total"
                        ],
                        (data.orderStatus || []).map(
                            item => `
                                <tr>
                                    <td>
                                        ${status(item.status)}
                                    </td>

                                    <td>
                                        <strong>
                                            ${number(item.total)}
                                        </strong>
                                    </td>
                                </tr>
                            `
                        )
                    )}
                </div>

            </div>
        `
    );
}

async function renderAudit() {
    const rows = await api("audit");

    return moduleShell(
        "Auditoria",
        "Registro real das operações administrativas.",
        `
            <button class="admin-button">
                Atualizar
            </button>

            <button class="admin-button primary">
                Exportar log
            </button>
        `,
        table(
            [
                "Data",
                "Usuário",
                "Ação",
                "Entidade",
                "Resultado"
            ],
            rows.map(item => `
                <tr>
                    <td>${date(item.created_at)}</td>

                    <td>
                        ${item.user_name}
                    </td>

                    <td>
                        <strong>${item.action}</strong>
                    </td>

                    <td>
                        ${item.entity_type || "—"}
                        ${item.entity_id
                            ? ` #${item.entity_id}`
                            : ""}
                    </td>

                    <td>
                        ${status(item.result)}
                    </td>
                </tr>
            `)
        )
    );
}

async function renderSettings() {
    const data = await api("settings");

    return moduleShell(
        "Configurações",
        "Informações operacionais da AURÉA.",
        `
            <button class="admin-button primary">
                Salvar alterações
            </button>
        `,
        `
            <div class="settings-grid">

                <section class="settings-card">

                    <div class="settings-icon">
                        ◈
                    </div>

                    <div class="settings-heading">
                        <h3>Loja</h3>
                        <span>
                            Informações gerais da operação.
                        </span>
                    </div>

                    <label>Nome</label>
                    <input
                        class="admin-input"
                        value="AURÉA COSMETICS"
                    >

                    <label>Descrição</label>
                    <input
                        class="admin-input"
                        value="Beauty • Care • Ritual"
                    >

                    <button class="admin-button primary">
                        Salvar
                    </button>

                </section>

                <section class="settings-card">

                    <div class="settings-icon">
                        ◇
                    </div>

                    <div class="settings-heading">
                        <h3>Base operacional</h3>
                        <span>
                            Informações vindas do PostgreSQL.
                        </span>
                    </div>

                    <div class="settings-data-row">
                        <span>Produtos</span>
                        <strong>
                            ${number(data.products)}
                        </strong>
                    </div>

                    <div class="settings-data-row">
                        <span>Categorias</span>
                        <strong>
                            ${number(data.categories)}
                        </strong>
                    </div>

                    <div class="settings-data-row">
                        <span>Clientes</span>
                        <strong>
                            ${number(data.customers)}
                        </strong>
                    </div>

                </section>

            </div>
        `
    );
}

const RENDERERS = {
    dashboard: renderDashboard,
    orders: renderOrders,
    products: renderProducts,
    categories: renderCategories,
    inventory: renderInventory,
    customers: renderCustomers,
    finance: renderFinance,
    coupons: renderCoupons,
    logistics: renderLogistics,
    reports: renderReports,
    audit: renderAudit,
    settings: renderSettings
};

async function renderSection(name) {
    const target = document.getElementById(
        `section-${name}`
    );

    if (!target) {
        return;
    }

    target.innerHTML = loading();

    try {
        const renderer = RENDERERS[name];

        if (!renderer) {
            throw new Error(
                `Módulo ${name} não possui renderer.`
            );
        }

        target.innerHTML = await renderer();

        bindDynamicActions(target);

    } catch (error) {
        console.error(
            "[AUREA ADMIN]",
            error
        );

        target.innerHTML = errorView(error);

        const retry = target.querySelector(
            "[data-admin-retry]"
        );

        if (retry) {
            retry.addEventListener(
                "click",
                () => {
                    delete state.cache[name];
                    renderSection(name);
                }
            );
        }
    }
}

function bindDynamicActions(target) {
    const refresh = target.querySelector(
        "[data-admin-refresh]"
    );

    if (refresh) {
        refresh.addEventListener(
            "click",
            () => {
                const section = currentSection();

                delete state.cache[section];

                renderSection(section);
            }
        );
    }
}

function showSection(name) {
    document
        .querySelectorAll(".admin-section")
        .forEach(section => {
            section.classList.remove("active");
        });

    const target = document.getElementById(
        `section-${name}`
    );

    if (target) {
        target.classList.add("active");
    }

    document
        .querySelectorAll(".admin-nav-item")
        .forEach(item => {
            item.classList.toggle(
                "active",
                item.dataset.section === name
            );
        });

    const title = document.querySelector(
        "[data-admin-title]"
    );

    if (title) {
        title.textContent =
            MODULES[name] || "Administração";
    }

    renderSection(name);

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

document.addEventListener(
    "DOMContentLoaded",
    () => {

        document
            .querySelectorAll(".admin-nav-item")
            .forEach(item => {

                item.addEventListener(
                    "click",
                    event => {
                        event.preventDefault();

                        const section =
                            item.dataset.section;

                        if (section) {
                            showSection(section);
                        }
                    }
                );
            });

        document
            .querySelectorAll("[data-section-link]")
            .forEach(item => {

                item.addEventListener(
                    "click",
                    event => {
                        event.preventDefault();

                        const section =
                            item.dataset.sectionLink;

                        if (section) {
                            showSection(section);
                        }
                    }
                );
            });

        document
            .querySelectorAll("[data-admin-logout]")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {
                        window.location.href =
                            "../index.html";
                    }
                );
            });

        showSection("dashboard");
    }
);

window.AUREA_ADMIN = {
    modules: MODULES,
    showSection,
    refresh(module) {
        delete state.cache[module];

        return renderSection(module);
    }
};
