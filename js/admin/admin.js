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
                        ${title}
                    </h2>

                    ${
                        subtitle
                            ? `<p>${subtitle}</p>`
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


function escapeHtml(value) {

    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}


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


window.AUREA_ADMIN = {

    state,

    load,

    refresh: () =>
        load(state.section)

};


state.ready = true;


load("dashboard");