'use strict';

/* ============================================================
   AUREA — ADMIN TOAST
   ============================================================ */

function showAdminToast(message, type = 'info') {
    let toast = document.getElementById('aurea-admin-toast');

    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'aurea-admin-toast';

        Object.assign(toast.style, {
            position: 'fixed',
            right: '24px',
            bottom: '24px',
            zIndex: '1000000',
            maxWidth: '360px',
            padding: '13px 17px',
            borderRadius: '10px',
            background: '#25241f',
            color: '#fff',
            fontSize: '14px',
            fontWeight: '600',
            lineHeight: '1.4',
            boxShadow: '0 12px 35px rgba(0,0,0,.22)',
            opacity: '0',
            transform: 'translateY(10px)',
            transition: 'opacity .18s ease, transform .18s ease',
            pointerEvents: 'none'
        });

        document.body.appendChild(toast);
    }

    const colors = {
        success: '#2f6b45',
        error: '#9b3535',
        warning: '#8a681f',
        info: '#25241f'
    };

    toast.style.background = colors[type] || colors.info;
    toast.textContent = String(message ?? '');

    clearTimeout(toast.__hideTimer);

    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    toast.__hideTimer = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
    }, 3000);
}


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
} from './modules/operational-environment.js';


import { renderRelationships, renderContracts } from './modules/partnerships-contracts.js';
import { renderCommissionLedger } from './modules/commission-ledger.js';
import { renderStorefront, renderIncentiveCampaigns } from './modules/marketing-tools.js';
import { createWhatsAppUrl } from '../communication/whatsapp-service.js';

const root =
    document.querySelector('#admin-root');

const navigation =
    document.querySelectorAll(
        '[data-admin-section]'
    );


const sections = [
    'dashboard',
    'orders',
    'products',
    'categories',
    'inventory',
    'customers',
    'finance',
    'coupons',
    'storefront',
    'campaigns',
    'influencers',
    'commissions',
    'partnerships',
    'contracts',
    'logistics',
    'reports',
    'audit',
    'settings'
];


const state = {
    section: 'dashboard',
    ready: false
};


/* ============================================================
   UTILITÁRIOS
   ============================================================ */

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}


function formatCurrency(value) {
    const number =
        Number(value) || 0;

    return number.toLocaleString(
        'pt-BR',
        {
            style: 'currency',
            currency: 'BRL'
        }
    );
}


function formatNumber(value) {
    const number =
        Number(value);

    if (!Number.isFinite(number)) {
        return '0';
    }

    return number.toLocaleString('pt-BR');
}


function formatDate(value) {
    if (!value) {
        return '—';
    }

    let date;

    if (
        typeof value === 'object' &&
        typeof value.toDate === 'function'
    ) {
        date = value.toDate();
    } else if (
        typeof value === 'object' &&
        typeof value.seconds === 'number'
    ) {
        date = new Date(
            value.seconds * 1000
        );
    } else {
        date = new Date(value);
    }

    if (Number.isNaN(date.getTime())) {
        return escapeHtml(value);
    }

    return date.toLocaleString(
        'pt-BR',
        {
            dateStyle: 'short',
            timeStyle: 'short'
        }
    );
}


function pick(object, keys, fallback = null) {
    if (!object || typeof object !== 'object') {
        return fallback;
    }

    for (const key of keys) {
        if (
            object[key] !== undefined &&
            object[key] !== null &&
            object[key] !== ''
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
        value === ''
    ) {
        return '—';
    }

    return String(value)
        .replaceAll('_', ' ')
        .replaceAll('-', ' ')
        .replace(/\b\w/g, char =>
            char.toUpperCase()
        );
}


function renderStatus(status) {
    const value =
        String(status ?? '—');

    const normalized =
        value
            .toLowerCase()
            .trim();

    let label =
        labelize(value);

    if (
        normalized === 'paid' ||
        normalized === 'confirmed' ||
        normalized === 'approved' ||
        normalized === 'completed'
    ) {
        label = 'Pago';
    } else if (
        normalized === 'pending'
    ) {
        label = 'Pendente';
    } else if (
        normalized === 'cancelled' ||
        normalized === 'canceled'
    ) {
        label = 'Cancelado';
    } else if (
        normalized === 'processing'
    ) {
        label = 'Processando';
    } else if (
        normalized === 'shipped'
    ) {
        label = 'Enviado';
    } else if (
        normalized === 'delivered'
    ) {
        label = 'Entregue';
    } else if (
        normalized === 'active' ||
        normalized === 'ativo'
    ) {
        label = 'Ativo';
    } else if (
        normalized === 'inactive' ||
        normalized === 'inativo'
    ) {
        label = 'Inativo';
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
            'active',
            item.dataset.adminSection === section
        );
    });
}


function shell(title, subtitle = '') {
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
                            : ''
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


function metricCard(label, value, detail = '') {
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
                    : ''
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

                ${emptyState('Nenhum registro encontrado.')}

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
                            `).join('')}

                        </tr>
                    </thead>

                    <tbody>

                        ${list.map(row => `
                            <tr>

                                ${columns.map(column => `
                                    <td>
                                        ${
                                            typeof column.render === 'function'
                                                ? column.render(row)
                                                : escapeHtml(
                                                    pick(
                                                        row,
                                                        column.keys || [],
                                                        '—'
                                                    )
                                                )
                                        }
                                    </td>
                                `).join('')}

                            </tr>
                        `).join('')}

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
            '[NEFER ADMIN] #admin-root não encontrado.'
        );

        return;
    }

    if (!sections.includes(section)) {
        section = 'dashboard';
    }

    state.section = section;

    setActiveNavigation(section);

    if (section === 'dashboard') {
        await renderOperationalEnvironment(root);

        updateHeader(
            'Dashboard',
            'Visão geral da operação da NEFER'
        );

        state.ready = true;

        return;
    }

    const labels = {

        orders: [
            'Pedidos',
            'Gestão completa dos pedidos.'
        ],

        products: [
            'Produtos',
            'Catálogo, SKU, preços e disponibilidade.'
        ],

        categories: [
            'Categorias',
            'Organização do catálogo.'
        ],

        inventory: [
            'Estoque',
            'Saldo, movimentações e disponibilidade.'
        ],

        customers: [
            'Clientes',
            'Base comercial e histórico.'
        ],

        finance: [
            'Financeiro',
            'Receitas, pagamentos e indicadores.'
        ],



        coupons: [
            'Cupons',
            'Campanhas e desempenho comercial.'
        ],

        influencers: [
            'Influenciadores',
            'Gerencie influenciadores e comissões.'
        ],

        commissions: [
            'Comissões',
            'Conciliação e pagamento das comissões de influenciadores.'
        ],

        partnerships: [
            'Relacionamentos',
            'Relacionamentos e atribuição de vendas.'
        ],

        contracts: [
            'Contratos',
            'Termos, vigência e histórico das parcerias.'
        ],

        storefront: [
            'Banner da vitrine',
            'Crie e programe campanhas promocionais para a página inicial.'
        ],

        campaigns: [
            'Campanhas de incentivo',
            'Segmente clientes e influenciadores pelas atividades registradas.'
        ],

        logistics: [
            'Logística',
            'Expedição, envio e rastreamento.'
        ],

        reports: [
            'Relatórios',
            'Inteligência operacional e comercial.'
        ],

        audit: [
            'Auditoria',
            'Histórico das operações administrativas.'
        ],

        settings: [
            'Configurações',
            'Parâmetros centrais da NEFER.'
        ]

    };


    const info =
        labels[section] || [
            'NEFER ADMIN',
            ''
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


    if (section === 'partnerships' || section === 'contracts' || section === 'commissions' || section === 'storefront' || section === 'campaigns') {
        try {
            const content = root.querySelector('.admin-loading');
            if (section === 'partnerships') await renderRelationships(content);
            else if (section === 'contracts') await renderContracts(content);
            else if (section === 'commissions') await renderCommissionLedger(content);
            else if (section === 'storefront') await renderStorefront(content);
            else await renderIncentiveCampaigns(content);
        } catch (error) {
            root.innerHTML = '';
            const errorBox = document.createElement('div');
            errorBox.className = 'admin-error';
            errorBox.textContent = error?.message || 'Falha ao carregar o módulo.';
            root.appendChild(errorBox);
        }
        state.ready = true;
        return;
    }
    await loadModuleData(section);

    state.ready = true;
}


function updateHeader(title, description) {
    const titleElement =
        document.querySelector(
            '#adminSectionTitle'
        );

    if (titleElement) {
        titleElement.textContent = title;
    }

    const descriptionElement =
        document.querySelector(
            '#adminPageDescription'
        );

    if (descriptionElement) {
        descriptionElement.textContent =
            description;
    }
}


/* ============================================================
   CARREGAMENTO DOS MÓDULOS
   ============================================================ */

async function loadModuleData(section) {
    const content =
        root.querySelector(
            '.admin-loading'
        );

    if (!content) {
        return;
    }

    try {
        let response;

        switch (section) {

            case 'orders':
                response =
                    await adminApi.orders();
                break;

            case 'products':
                {
                    const [productsResponse, visibilityResponse] = await Promise.all([
                        adminApi.products(),
                        adminApi.catalogVisibility()
                    ]);
                    response = {
                        success: true,
                        data: {
                            products: productsResponse?.data ?? productsResponse ?? [],
                            visibility: visibilityResponse?.data ?? visibilityResponse ?? {}
                        }
                    };
                }
                break;

            case 'categories':
                response =
                    await adminApi.categories();
                break;

            case 'inventory':
                response =
                    await adminApi.inventory();
                break;

            case 'customers':
                response =
                    await adminApi.customers();
                break;

            case 'finance':
                response =
                    await adminApi.finance();
                break;



            case 'coupons':
                response =
                    await adminApi.coupons();
                break;

            case 'influencers':
                response =
                    await adminApi.influencers();
                break;

            case 'logistics':
                response =
                    await adminApi.logistics();
                break;

            case 'reports':
                response =
                    await adminApi.reports();
                break;

            case 'audit':
                response =
                    await adminApi.audit();
                break;

            case 'settings':
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
            response?.data ?? response ?? [];


        if (section === 'orders') {
            renderOrders(
                content,
                Array.isArray(data)
                    ? data
                    : []
            );
            return;
        }


        if (section === 'products') {
            renderProducts(
                content,
                Array.isArray(data)
                    ? data
                    : Array.isArray(data?.products)
                        ? data.products
                        : [],
                data?.visibility || {}
            );
            return;
        }


        if (section === 'categories') {
            renderCategories(
                content,
                Array.isArray(data)
                    ? data
                    : []
            );
            return;
        }


        if (section === 'inventory') {
            renderInventory(
                content,
                Array.isArray(data)
                    ? data
                    : []
            );
            return;
        }


        if (section === 'customers') {
            renderCustomers(
                content,
                Array.isArray(data)
                    ? data
                    : []
            );
            return;
        }


        if (section === 'finance') {
            renderFinance(
                content,
                data
            );
            return;
        }




        if (section === 'coupons') {
            renderCoupons(
                content,
                Array.isArray(data)
                    ? data
                    : []
            );
            return;
        }

        if (section === 'influencers') {
            window.NEFERInfluencers.render(
                content,
                Array.isArray(data)
                    ? data
                    : []
            );
            return;
        }


        if (section === 'logistics') {
            renderLogistics(
                content,
                Array.isArray(data)
                    ? data
                    : []
            );
            return;
        }


        if (section === 'reports') {
            renderReports(
                content,
                data
            );
            return;
        }


        if (section === 'audit') {
            renderAudit(
                content,
                Array.isArray(data)
                    ? data
                    : []
            );
            return;
        }


        if (section === 'settings') {
            renderSettings(
                content,
                Array.isArray(data)
                    ? data
                    : []
            );
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
                        'Erro desconhecido.'
                    )}
                </div>

            </div>
        `;
    }
}


/* ============================================================
   PRODUTOS
   ============================================================ */

function renderProducts(content, products, visibility = {}) {

    const list =
        Array.isArray(products)
            ? products
            : [];

    window.__aureaAdminProducts = list;

    const total =
        list.length;

    const available =
        list.filter(product =>
            Number(
                pick(
                    product,
                    ['stock', 'inventory', 'quantity'],
                    0
                )
            ) > 0
        ).length;

    const withoutStock =
        list.filter(product =>
            Number(
                pick(
                    product,
                    ['stock', 'inventory', 'quantity'],
                    0
                )
            ) <= 0
        ).length;

    const sources = Array.isArray(visibility.sources)
        ? visibility.sources
        : [];

    const sourceControls = sources.length
        ? sources.map(source => `
            <article class="admin-catalog-source-control">
                <div>
                    <strong>${escapeHtml(source.name || source.id)}</strong>
                    <small>${source.visible ? 'Visível na vitrine' : 'Oculto na vitrine'}</small>
                </div>
                <button
                    type="button"
                    class="admin-catalog-source-toggle"
                    data-source-id="${escapeHtml(source.id)}"
                    data-visible="${source.visible ? 'true' : 'false'}"
                    aria-pressed="${source.visible ? 'true' : 'false'}"
                >${source.visible ? 'Desativar fornecedor' : 'Ativar fornecedor'}</button>
            </article>
        `).join('')
        : '<p>Não há fornecedores configurados no catálogo.</p>';


    const html = `

        <div class="admin-module-data" id="admin-products-module">

            <div class="admin-metrics-grid">

                ${metricCard(
                    'Produtos cadastrados',
                    formatNumber(total)
                )}

                ${metricCard(
                    'Disponíveis',
                    formatNumber(available)
                )}

                ${metricCard(
                    'Sem estoque',
                    formatNumber(withoutStock)
                )}

                ${metricCard(
                    'Fonte',
                    'Firebase / Firestore'
                )}

            </div>

            <section class="admin-catalog-visibility" aria-labelledby="admin-catalog-visibility-title">
                <div class="admin-catalog-visibility-heading">
                    <div>
                        <h3 id="admin-catalog-visibility-title">Visibilidade na vitrine</h3>
                        <p>Ative ou oculte fornecedores inteiros; os itens também podem ser controlados individualmente na lista.</p>
                    </div>
                </div>
                <div class="admin-catalog-source-controls">${sourceControls}</div>
            </section>


            ${table(
                'Catálogo de produtos',

                [
                    {
                        label: 'Produto',
                        render: row => `
                            <strong>
                                ${escapeHtml(
                                    pick(
                                        row,
                                        [
                                            'name',
                                            'product_name',
                                            'title'
                                        ],
                                        'Produto'
                                    )
                                )}
                            </strong>
                        `
                    },

                    {
                        label: 'SKU',
                        keys: [
                            'sku',
                            'code',
                            'product_code'
                        ]
                    },

                    {
                        label: 'Fornecedor',
                        render: row => escapeHtml(
                            row.sourceName || row.source_name || row.supplierName || row.supplier || row.sourceId || '—'
                        )
                    },

                    {
                        label: 'Categoria',
                        render: row =>
                            escapeHtml(
                                pick(
                                    row,
                                    [
                                        'category_name',
                                        'categoryName',
                                        'category'
                                    ],
                                    'Sem categoria'
                                )
                            )
                    },

                    {
                        label: 'Preço',
                        render: row =>
                            formatCurrency(
                                pick(
                                    row,
                                    [
                                        'price',
                                        'sale_price',
                                        'amount'
                                    ],
                                    0
                                )
                            )
                    },

                    {
                        label: 'Estoque',
                        render: row =>
                            formatNumber(
                                pick(
                                    row,
                                    [
                                        'stock',
                                        'inventory',
                                        'quantity'
                                    ],
                                    0
                                )
                            )
                    },

                    {
                        label: 'Situação',
                        render: row =>
                            stockStatus(
                                pick(
                                    row,
                                    [
                                        'stock',
                                        'inventory',
                                        'quantity'
                                    ],
                                    0
                                )
                            )
                    },

                    {
                        label: 'Vitrine',
                        render: row => {
                            const visible = row.active !== false;
                            return `
                                <button
                                    type="button"
                                    class="admin-catalog-product-toggle"
                                    data-product-id="${escapeHtml(String(row.id || row.productId || row.docId || ''))}"
                                    data-visible="${visible ? 'true' : 'false'}"
                                    aria-pressed="${visible ? 'true' : 'false'}"
                                >${visible ? 'Visível · ocultar' : 'Oculto · exibir'}</button>
                            `;
                        }
                    },

                    {
                        label: 'Ações',
                        render: row => `
                            <button
                                type="button"
                                class="admin-product-edit"
                                data-product-id="${escapeHtml(
                                    String(
                                        row.id ||
                                        row.productId ||
                                        row.docId ||
                                        ''
                                    )
                                )}"
                            >
                                Editar
                            </button>
                        `
                    }
                ],

                list
            )}

        </div>
    `;


    content.outerHTML =
        html;

    const module = document.getElementById('admin-products-module');
    module?.addEventListener('click', async event => {
        const sourceButton = event.target.closest('.admin-catalog-source-toggle');
        const productButton = event.target.closest('.admin-catalog-product-toggle');
        const button = sourceButton || productButton;
        if (!button || button.disabled) return;

        const visible = button.dataset.visible !== 'true';
        button.disabled = true;
        try {
            if (sourceButton) {
                await adminApi.setCatalogSourceVisibility(button.dataset.sourceId, visible);
                button.textContent = visible ? 'Desativar fornecedor' : 'Ativar fornecedor';
            } else {
                await adminApi.setCatalogProductVisibility(button.dataset.productId, visible);
                button.textContent = visible ? 'Visível · ocultar' : 'Oculto · exibir';
            }

            button.dataset.visible = String(visible);
            button.setAttribute('aria-pressed', String(visible));
            const status = sourceButton ? button.previousElementSibling?.querySelector('small') : null;
            if (status) status.textContent = visible ? 'Visível na vitrine' : 'Oculto na vitrine';
            showAdminToast?.(
                sourceButton
                    ? `Fornecedor ${visible ? 'ativado' : 'ocultado'} na vitrine.`
                    : `Produto ${visible ? 'ativado' : 'ocultado'} na vitrine.`,
                'success'
            );
        } catch (error) {
            showAdminToast?.(error?.message || 'Não foi possível atualizar a vitrine.', 'error');
        } finally {
            button.disabled = false;
        }
    });
}


function openProductEditor(product) {

    const oldModal =
        document.getElementById(
            'aurea-product-editor'
        );

    if (oldModal) {
        oldModal.remove();
    }


    const read = (
        keys,
        fallback = ''
    ) =>
        String(
            pick(
                product,
                keys,
                fallback
            ) ??
            fallback
        );


    const productId =
        product?.id ??
        product?.productId ??
        product?.docId ??
        '';


    if (!productId) {
        console.error(
            '[ADMIN PRODUCTS] Produto sem ID:',
            product
        );

        showAdminToast?.(
            'Não foi possível identificar o produto.',
            'error'
        );

        return;
    }


    const modal =
        document.createElement('div');

    modal.id =
        'aurea-product-editor';

    modal.className =
        'admin-product-editor-overlay';


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
                        Alterações salvas no Firebase / Firestore.
                    </p>

                </div>

                <button
                    type="button"
                    class="admin-product-editor-close"
                    aria-label="Fechar"
                >
                    ×
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
                                    'name',
                                    'product_name',
                                    'title'
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
                                    'sku',
                                    'code',
                                    'product_code'
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
                                        'price',
                                        'sale_price',
                                        'amount'
                                    ],
                                    '0'
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
                                    'promotionalPrice',
                                    'promotional_price',
                                    'promoPrice'
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
                                read(
                                    ['stock'],
                                    '0'
                                )
                            )}"
                        >
                    </label>


                    <label>
                        Categoria

                        <input
                            name="categoryName"
                            type="text"
                            value="${escapeHtml(
                                read([
                                    'categoryName',
                                    'category_name',
                                    'category'
                                ])
                            )}"
                        >
                    </label>


                    <label class="admin-product-editor-full">
                        Descrição

                        <textarea
                            name="description"
                            rows="5"
                        >${escapeHtml(
                            read([
                                'description',
                                'details'
                            ])
                        )}</textarea>

                    </label>


                    <label class="admin-product-editor-full">
                        Imagem

                        <input
                            name="image"
                            type="text"
                            value="${escapeHtml(
                                read([
                                    'image',
                                    'imageUrl',
                                    'image_url'
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
            '#aurea-product-editor-form'
        );


    const close =
        () => {
            modal.remove();
        };


    modal
        .querySelector(
            '.admin-product-editor-close'
        )
        ?.addEventListener(
            'click',
            close
        );


    modal
        .querySelector(
            '.admin-product-editor-cancel'
        )
        ?.addEventListener(
            'click',
            close
        );


    modal.addEventListener(
        'click',
        event => {
            if (event.target === modal) {
                close();
            }
        }
    );


    form.addEventListener(
        'submit',
        async event => {

            event.preventDefault();


            const saveButton =
                form.querySelector(
                    '.admin-product-editor-save'
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

            const optionalNumeric =
                value => {
                    if (String(value ?? '').trim() === '') {
                        return null;
                    }

                    const parsed = Number(value);

                    return Number.isFinite(parsed)
                        ? parsed
                        : null;
                };


            const updatedProduct = {

                name:
                    String(
                        formData.get('name') ?? ''
                    ).trim(),

                sku:
                    String(
                        formData.get('sku') ?? ''
                    ).trim(),

                price:
                    numeric(
                        formData.get('price')
                    ),

                promotionalPrice:
                    optionalNumeric(
                        formData.get(
                            'promotionalPrice'
                        )
                    ),

                stock:
                    Math.max(
                        0,
                        Math.trunc(
                            numeric(
                                formData.get('stock')
                            )
                        )
                    ),

                categoryName:
                    String(
                        formData.get('categoryName') ?? ''
                    ).trim(),

                description:
                    String(
                        formData.get('description') ?? ''
                    ).trim(),

                image:
                    String(
                        formData.get('image') ?? ''
                    ).trim()
            };


            if (!updatedProduct.name) {
                showAdminToast?.(
                    'Informe o nome do produto.',
                    'error'
                );

                return;
            }


            if (!updatedProduct.sku) {
                showAdminToast?.(
                    'Informe o SKU do produto.',
                    'error'
                );

                return;
            }


            saveButton.disabled = true;

            saveButton.dataset.originalText =
                saveButton.textContent;

            saveButton.textContent =
                'Salvando...';


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
                                ''
                            ) ===
                            String(productId)
                    );


                const normalizedSaved =
                    saved &&
                    typeof saved === 'object'
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
                    'Produto atualizado com sucesso.',
                    'success'
                );


                await load('products');

            } catch (error) {

                console.error(
                    '[ADMIN PRODUCTS] Erro ao salvar produto:',
                    error
                );


                showAdminToast?.(
                    error?.message ||
                    'Não foi possível salvar o produto.',
                    'error'
                );

            } finally {

                saveButton.disabled =
                    false;

                saveButton.textContent =
                    saveButton.dataset.originalText ||
                    'Salvar alterações';
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
                    'Categorias cadastradas',
                    formatNumber(list.length)
                )}

                ${metricCard(
                    'Fonte',
                    'Firebase / Firestore'
                )}

            </div>


            ${table(
                'Categorias',

                [
                    {
                        label: 'ID',
                        keys: ['id']
                    },

                    {
                        label: 'Nome',
                        render: row => `
                            <strong>
                                ${escapeHtml(
                                    pick(
                                        row,
                                        [
                                            'name',
                                            'title',
                                            'category_name'
                                        ],
                                        'Categoria'
                                    )
                                )}
                            </strong>
                        `
                    },

                    {
                        label: 'Descrição',
                        keys: [
                            'description',
                            'details'
                        ]
                    },

                    {
                        label: 'Status',
                        render: row =>
                            renderStatus(
                                pick(
                                    row,
                                    [
                                        'status',
                                        'state'
                                    ],
                                    'active'
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
                            [
                                'stock',
                                'inventory',
                                'quantity'
                            ],
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
                    [
                        'stock',
                        'inventory',
                        'quantity'
                    ],
                    0
                )
            ) <= 5
        ).length;

    const emptyStock =
        list.filter(row =>
            Number(
                pick(
                    row,
                    [
                        'stock',
                        'inventory',
                        'quantity'
                    ],
                    0
                )
            ) <= 0
        ).length;

    content.outerHTML = `

        <div class="admin-module-data">

            <div class="admin-metrics-grid">

                ${metricCard(
                    'Itens monitorados',
                    formatNumber(list.length)
                )}

                ${metricCard(
                    'Unidades em estoque',
                    formatNumber(totalUnits)
                )}

                ${metricCard(
                    'Estoque baixo',
                    formatNumber(lowStock)
                )}

                ${metricCard(
                    'Sem estoque',
                    formatNumber(emptyStock)
                )}

            </div>

            ${table(
                'Controle de estoque',

                [
                    {
                        label: 'Produto',
                        render: row => `
                            <strong>
                                ${escapeHtml(
                                    pick(
                                        row,
                                        [
                                            'name',
                                            'product_name',
                                            'title'
                                        ],
                                        'Produto'
                                    )
                                )}
                            </strong>
                        `
                    },

                    {
                        label: 'SKU',
                        keys: [
                            'sku',
                            'code'
                        ]
                    },

                    {
                        label: 'Quantidade',
                        render: row =>
                            formatNumber(
                                pick(
                                    row,
                                    [
                                        'stock',
                                        'inventory',
                                        'quantity'
                                    ],
                                    0
                                )
                            )
                    },

                    {
                        label: 'Preço',
                        render: row =>
                            formatCurrency(
                                pick(
                                    row,
                                    [
                                        'price',
                                        'sale_price'
                                    ],
                                    0
                                )
                            )
                    },

                    {
                        label: 'Situação',
                        render: row =>
                            stockStatus(
                                pick(
                                    row,
                                    [
                                        'stock',
                                        'inventory',
                                        'quantity'
                                    ],
                                    0
                                )
                            )
                    },

                    {
                        label: 'Movimentar',
                        render: row => {

                            const productId =
                                pick(
                                    row,
                                    [
                                        'productId',
                                        'product_id'
                                    ],
                                    ''
                                );

                            const sku =
                                pick(
                                    row,
                                    [
                                        'sku',
                                        'code'
                                    ],
                                    ''
                                );

                            return `
                                <div class="admin-stock-actions">

                                    <button
                                        type="button"
                                        class="admin-btn admin-btn-secondary admin-stock-movement"
                                        data-product-id="${escapeHtml(productId)}"
                                        data-sku="${escapeHtml(sku)}"
                                        data-delta="-1"
                                        title="Retirar 1 unidade"
                                    >-1</button>

                                    <button
                                        type="button"
                                        class="admin-btn admin-btn-primary admin-stock-movement"
                                        data-product-id="${escapeHtml(productId)}"
                                        data-sku="${escapeHtml(sku)}"
                                        data-delta="1"
                                        title="Adicionar 1 unidade"
                                    >+1</button>

                                </div>
                            `;
                        }
                    }
                ],

                list
            )}

        </div>
    `;

        document
        .querySelectorAll('.admin-stock-movement')
        .forEach(button => {

            button.addEventListener(
                'click',
                async () => {

                    const productId =
                        button.dataset.productId;

                    const delta =
                        Number(
                            button.dataset.delta
                        );

                    if (!productId || !delta) {
                        return;
                    }

                    button.disabled = true;

                    try {

                        const response =
                            await adminApi.createInventoryMovement({
                                product_id: productId,
                                quantity: delta
                            });

                        if (!response?.success) {
                            throw new Error(
                                response?.message ||
                                'Não foi possível movimentar o estoque.'
                            );
                        }

                        await load('inventory');

                    } catch (error) {

                        console.error(
                            '[ADMIN] Falha ao movimentar estoque:',
                            error
                        );

                        alert(
                            error?.message ||
                            'Não foi possível movimentar o estoque.'
                        );

                        button.disabled = false;
                    }
                }
            );
        });
}
function renderCustomers(content, customers) {
    const list =
        Array.isArray(customers)
            ? customers
            : [];
    const paidOrders = list.reduce((sum, item) => sum + Number(item.paidOrders || 0), 0);
    const totalSpent = list.reduce((sum, item) => sum + Number(item.totalSpent || 0), 0);
    content.outerHTML = `
        <div class="admin-module-data">
            <div class="admin-metrics-grid">
                ${metricCard('Clientes com atividade', formatNumber(list.length))}
                ${metricCard('Pedidos pagos', formatNumber(paidOrders))}
                ${metricCard('Valor pago registrado', formatCurrency(totalSpent))}
            </div>
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead><tr><th>Cliente</th><th>Contato</th><th>Pedidos</th><th>Compras pagas</th><th>Última atividade</th><th>Histórico</th></tr></thead>
                    <tbody>
                        ${list.length ? list.map(customer => {
                            const history = Array.isArray(customer.activityHistory) ? customer.activityHistory : [];
                            const name = customer.name || customer.full_name || 'Cliente';
                            return `<tr>
                                <td><strong>${escapeHtml(name)}</strong><small>${escapeHtml(customer.status || 'Ativo')}</small></td>
                                <td>${escapeHtml(customer.email || '—')}<small>${escapeHtml(customer.phone || customer.whatsapp || '—')}</small></td>
                                <td>${formatNumber(customer.ordersCount || 0)}</td>
                                <td>${formatNumber(customer.paidOrders || 0)}<small>${formatCurrency(customer.totalSpent || 0)}</small></td>
                                <td>${formatDate(customer.lastPurchaseAt || customer.updatedAt || customer.createdAt)}</td>
                                <td><details><summary>Ver ${history.length} evento(s)</summary><ul class="customer-activity-history">${history.length ? history.map(event => `<li><time>${escapeHtml(formatDate(event.at))}</time> ${escapeHtml(event.label || event.type || 'Atividade registrada')}</li>`).join('') : '<li>Sem atividade registrada.</li>'}</ul></details></td>
                            </tr>`;
                        }).join('') : '<tr><td colspan="6">Ainda não há clientes ou pedidos registrados.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}


/* ============================================================
   FINANCEIRO
   ============================================================ */

function renderFinance(content, finance) {

    const data =
        finance &&
        typeof finance === 'object' &&
        !Array.isArray(finance)
            ? finance
            : {};


    const revenue =
        pick(
            data,
            [
                'grossRevenue',
                'revenue',
                'totalRevenue',
                'sales'
            ],
            0
        );


    const orders =
        pick(
            data,
            [
                'confirmedOrders',
                'orders',
                'totalOrders'
            ],
            0
        );


    const average =
        pick(
            data,
            [
                'averageTicket',
                'average_ticket',
                'ticket'
            ],
            Number(orders) > 0
                ? Number(revenue) / Number(orders)
                : 0
        );


    content.outerHTML = `

        <div class="admin-module-data">

            <div class="admin-metrics-grid">

                ${metricCard(
                    'Faturamento',
                    formatCurrency(revenue)
                )}

                ${metricCard(
                    'Pedidos',
                    formatNumber(orders)
                )}

                ${metricCard(
                    'Ticket médio',
                    formatCurrency(average)
                )}

                ${metricCard(
                    'Fonte',
                    'Firebase / Firestore'
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
}


/* ============================================================
   CUPONS
   ============================================================ */

function couponId(coupon) {
    return String(
        coupon?.id ??
        coupon?.couponId ??
        coupon?.docId ??
        ''
    );
}


function couponIsActive(coupon) {
    if (
        typeof coupon?.active === 'boolean'
    ) {
        return coupon.active;
    }

    const status =
        String(
            pick(
                coupon,
                [
                    'status',
                    'state'
                ],
                'active'
            )
        )
            .trim()
            .toLowerCase();

    return (
        status === 'active' ||
        status === 'ativo'
    );
}


function couponType(coupon) {
    const type =
        String(
            pick(
                coupon,
                [
                    'type',
                    'discountType',
                    'discount_type'
                ],
                'percentage'
            )
        )
            .trim()
            .toLowerCase();

    return (
        type === 'fixed' ||
        type === 'valor_fixo' ||
        type === 'fixed_amount'
    )
        ? 'fixed'
        : 'percentage';
}


function couponValue(coupon) {
    return Number(
        pick(
            coupon,
            [
                'value',
                'discount',
                'discount_value',
                'percentage'
            ],
            0
        )
    ) || 0;
}


function couponUsageCount(coupon) {
    return Number(
        pick(
            coupon,
            [
                'usageCount',
                'usage_count',
                'uses',
                'used',
                'uses_count'
            ],
            0
        )
    ) || 0;
}


function couponUsageLimit(coupon) {
    const value =
        pick(
            coupon,
            [
                'usageLimit',
                'usage_limit',
                'max_uses',
                'limit'
            ],
            0
        );

    return Number(value) || 0;
}


function renderCoupons(content, coupons) {

    const list =
        Array.isArray(coupons)
            ? coupons
            : [];


    const active =
        list.filter(
            couponIsActive
        ).length;


    const inactive =
        list.length - active;


    const totalUses =
        list.reduce(
            (sum, coupon) =>
                sum +
                couponUsageCount(coupon),
            0
        );


    content.outerHTML = `

        <div class="admin-module-data">

            <div class="admin-metrics-grid">

                ${metricCard(
                    'Cupons cadastrados',
                    formatNumber(list.length)
                )}

                ${metricCard(
                    'Cupons ativos',
                    formatNumber(active)
                )}

                ${metricCard(
                    'Cupons inativos',
                    formatNumber(inactive)
                )}

                ${metricCard(
                    'Usos realizados',
                    formatNumber(totalUses)
                )}

            </div>


            <section class="module-panel">

                <div class="module-panel-header">

                    <div>

                        <span class="module-eyebrow">
                            NEFER ADMIN
                        </span>

                        <h3>
                            Campanhas e cupons
                        </h3>

                        <p>
                            Crie, edite, ative, desative e exclua cupons.
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
                    list.length
                        ? `
                            <div class="admin-table-wrap">

                                <table class="admin-table">

                                    <thead>

                                        <tr>
                                            <th>Código</th>
                                            <th>Tipo</th>
                                            <th>Valor</th>
                                            <th>Mínimo</th>
                                            <th>Uso</th>
                                            <th>Status</th>
                                            <th>Ações</th>
                                        </tr>

                                    </thead>


                                    <tbody>

                                        ${list.map(coupon => {

                                            const id =
                                                couponId(coupon);

                                            const code =
                                                pick(
                                                    coupon,
                                                    [
                                                        'code',
                                                        'coupon_code',
                                                        'couponCode'
                                                    ],
                                                    '—'
                                                );

                                            const type =
                                                couponType(coupon);

                                            const value =
                                                couponValue(coupon);

                                            const minimumOrder =
                                                Number(
                                                    pick(
                                                        coupon,
                                                        [
                                                            'minimumOrder',
                                                            'minimum_order',
                                                            'minOrder',
                                                            'min_order'
                                                        ],
                                                        0
                                                    )
                                                ) || 0;

                                            const uses =
                                                couponUsageCount(
                                                    coupon
                                                );

                                            const usageLimit =
                                                couponUsageLimit(
                                                    coupon
                                                );

                                            const activeStatus =
                                                couponIsActive(
                                                    coupon
                                                );

                                            return `

                                                <tr>

                                                    <td>
                                                        <strong>
                                                            ${escapeHtml(
                                                                String(code)
                                                            )}
                                                        </strong>
                                                    </td>


                                                    <td>
                                                        ${
                                                            type === 'percentage'
                                                                ? 'Percentual'
                                                                : 'Valor fixo'
                                                        }
                                                    </td>


                                                    <td>
                                                        ${
                                                            type === 'percentage'
                                                                ? `${escapeHtml(String(value))}%`
                                                                : formatCurrency(value)
                                                        }
                                                    </td>


                                                    <td>
                                                        ${formatCurrency(
                                                            minimumOrder
                                                        )}
                                                    </td>


                                                    <td>
                                                        ${
                                                            usageLimit > 0
                                                                ? `${formatNumber(uses)} / ${formatNumber(usageLimit)}`
                                                                : `${formatNumber(uses)} / ilimitado`
                                                        }
                                                    </td>


                                                    <td>
                                                        ${
                                                            activeStatus
                                                                ? renderStatus('active')
                                                                : renderStatus('inactive')
                                                        }
                                                    </td>


                                                    <td>

                                                        <div class="table-actions">

                                                            <button
                                                                type="button"
                                                                class="admin-button admin-coupon-edit"
                                                                data-coupon-id="${escapeHtml(id)}"
                                                            >
                                                                Editar
                                                            </button>


                                                            <button
                                                                type="button"
                                                                class="admin-button admin-coupon-toggle"
                                                                data-coupon-id="${escapeHtml(id)}"
                                                                data-active="${activeStatus ? 'true' : 'false'}"
                                                            >
                                                                ${
                                                                    activeStatus
                                                                        ? 'Desativar'
                                                                        : 'Ativar'
                                                                }
                                                            </button>


                                                            <button
                                                                type="button"
                                                                class="admin-button admin-coupon-delete"
                                                                data-coupon-id="${escapeHtml(id)}"
                                                            >
                                                                Excluir
                                                            </button>

                                                        </div>

                                                    </td>

                                                </tr>
                                            `;
                                        }).join('')}

                                    </tbody>

                                </table>

                            </div>
                        `
                        : emptyState(
                            'Nenhum cupom cadastrado no Firebase / Firestore.'
                        )
                }

            </section>

        </div>
    `;


    document
        .getElementById(
            'admin-new-coupon'
        )
        ?.addEventListener(
            'click',
            () => openCouponEditor()
        );


    document
        .querySelectorAll(
            '.admin-coupon-edit'
        )
        .forEach(button => {

            button.addEventListener(
                'click',
                () => {

                    const id =
                        button.dataset.couponId;

                    const coupon =
                        list.find(
                            item =>
                                couponId(item) ===
                                String(id)
                        );

                    if (!coupon) {

                        showAdminToast?.(
                            'Cupom não encontrado.',
                            'error'
                        );

                        return;
                    }

                    openCouponEditor(
                        coupon
                    );
                }
            );
        });


    document
        .querySelectorAll(
            '.admin-coupon-toggle'
        )
        .forEach(button => {

            button.addEventListener(
                'click',
                async () => {

                    const id =
                        button.dataset.couponId;

                    const currentActive =
                        button.dataset.active === 'true';


                    if (!id) {
                        return;
                    }


                    button.disabled = true;


                    try {

                        if (
                            !adminApi ||
                            typeof adminApi.updateCoupon !== 'function'
                        ) {
                            throw new Error(
                                'A API de cupons não possui a operação de atualização.'
                            );
                        }


                        await adminApi.updateCoupon(
                            id,
                            {
                                active:
                                    !currentActive
                            }
                        );


                        showAdminToast?.(
                            currentActive
                                ? 'Cupom desativado.'
                                : 'Cupom ativado.',
                            'success'
                        );


                        await load(
                            'coupons'
                        );

                    } catch (error) {

                        console.error(
                            '[NEFER COUPONS] Erro ao alterar status:',
                            error
                        );


                        showAdminToast?.(
                            error?.message ||
                            'Não foi possível alterar o status do cupom.',
                            'error'
                        );


                        button.disabled =
                            false;
                    }
                }
            );
        });


    document
        .querySelectorAll(
            '.admin-coupon-delete'
        )
        .forEach(button => {

            button.addEventListener(
                'click',
                async () => {

                    const id =
                        button.dataset.couponId;

                    if (!id) {
                        return;
                    }


                    const confirmed =
                        window.confirm(
                            'Excluir este cupom? Esta ação não poderá ser desfeita.'
                        );


                    if (!confirmed) {
                        return;
                    }


                    button.disabled = true;


                    try {

                        if (
                            !adminApi ||
                            typeof adminApi.deleteCoupon !== 'function'
                        ) {
                            throw new Error(
                                'A API de cupons não possui a operação de exclusão.'
                            );
                        }


                        await adminApi.deleteCoupon(
                            id
                        );


                        showAdminToast?.(
                            'Cupom excluído com sucesso.',
                            'success'
                        );


                        await load(
                            'coupons'
                        );

                    } catch (error) {

                        console.error(
                            '[NEFER COUPONS] Erro ao excluir:',
                            error
                        );


                        showAdminToast?.(
                            error?.message ||
                            'Não foi possível excluir o cupom.',
                            'error'
                        );


                        button.disabled =
                            false;
                    }
                }
            );
        });
}


function openCouponEditor(coupon = null) {

    const editing =
        Boolean(coupon);


    const oldModal =
        document.getElementById(
            'nefer-coupon-editor'
        );


    if (oldModal) {
        oldModal.remove();
    }


    const type =
        couponType(
            coupon || {}
        );


    const active =
        couponIsActive(
            coupon || {}
        );


    const modal =
        document.createElement('div');


    modal.id =
        'nefer-coupon-editor';


    modal.className =
        'admin-modal-overlay';


    modal.innerHTML = `

        <div
            class="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="coupon-editor-title"
        >

            <div class="admin-modal-header">

                <div>

                    <h2 id="coupon-editor-title">
                        ${
                            editing
                                ? 'Editar cupom'
                                : 'Novo cupom'
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
                    aria-label="Fechar"
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
                            autocomplete="off"
                            value="${escapeHtml(
                                String(
                                    coupon?.code ||
                                    coupon?.coupon_code ||
                                    ''
                                )
                            )}"
                        >

                    </label>


                    <label>

                        <span>Tipo de desconto</span>

                        <select
                            id="coupon-type"
                            required
                        >

                            <option
                                value="percentage"
                                ${
                                    type === 'percentage'
                                        ? 'selected'
                                        : ''
                                }
                            >
                                Percentual
                            </option>

                            <option
                                value="fixed"
                                ${
                                    type === 'fixed'
                                        ? 'selected'
                                        : ''
                                }
                            >
                                Valor fixo
                            </option>

                        </select>

                    </label>


                    <label>

                        <span>Valor do desconto</span>

                        <input
                            id="coupon-value"
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            value="${escapeHtml(
                                String(
                                    couponValue(
                                        coupon || {}
                                    )
                                )
                            )}"
                        >

                    </label>


                    <label>

                        <span>Pedido mínimo</span>

                        <input
                            id="coupon-minimum-order"
                            type="number"
                            min="0"
                            step="0.01"
                            value="${escapeHtml(
                                String(
                                    Number(
                                        pick(
                                            coupon || {},
                                            [
                                                'minimumOrder',
                                                'minimum_order',
                                                'minOrder',
                                                'min_order'
                                            ],
                                            0
                                        )
                                    ) || 0
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
                                    couponUsageLimit(
                                        coupon || {}
                                    )
                                )
                            )}"
                        >

                        <small>
                            0 = uso ilimitado
                        </small>

                    </label>


                    <label>

                        <span>Status</span>

                        <select
                            id="coupon-active"
                        >

                            <option
                                value="true"
                                ${
                                    active
                                        ? 'selected'
                                        : ''
                                }
                            >
                                Ativo
                            </option>

                            <option
                                value="false"
                                ${
                                    !active
                                        ? 'selected'
                                        : ''
                                }
                            >
                                Inativo
                            </option>

                        </select>

                    </label>


                    <label class="admin-form-full">
                        <span>Influenciador vinculado</span>
                        <input type="hidden" id="coupon-influencer-name" value="${escapeHtml(String(pick(coupon || {}, ['influencerName', 'influencer_name', 'affiliateName'], '')))}">
                        <select id="coupon-influencer-id" data-saved-id="${escapeHtml(String(pick(coupon || {}, ['influencerId', 'influencer_id'], '')))}">
                            <option value="">Sem vínculo (cupom geral)</option>
                            ${pick(coupon || {}, ['influencerId', 'influencer_id'], '') ? `<option value="${escapeHtml(String(pick(coupon || {}, ['influencerId', 'influencer_id'], '')))}" selected>Carregando influenciador…</option>` : ''}
                        </select>
                        <small id="coupon-influencer-help">Selecione pelo nome. Cada opção mostra também o ID que será salvo no cupom.</small>
                    </label>
                    <label
                        class="admin-form-full"
                    >

                        <span>Descrição</span>

                        <textarea
                            id="coupon-description"
                            rows="4"
                            maxlength="500"
                        >${escapeHtml(
                            String(
                                pick(
                                    coupon || {},
                                    [
                                        'description'
                                    ],
                                    ''
                                )
                            )
                        )}</textarea>

                    </label>

                </div>


                ${
                    editing
                        ? `
                            <div class="admin-operation-grid">

                                <article class="admin-operation-card">

                                    <span>
                                        Usos realizados
                                    </span>

                                    <strong>
                                        ${formatNumber(
                                            couponUsageCount(
                                                coupon
                                            )
                                        )}
                                    </strong>

                                </article>

                            </div>
                        `
                        : ''
                }


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
                        id="coupon-editor-save"
                    >
                        ${
                            editing
                                ? 'Salvar alterações'
                                : 'Criar cupom'
                        }
                    </button>

                </div>

            </form>

        </div>
    `;


    document.body.appendChild(
        modal
    );

    const influencerSelect = modal.querySelector("#coupon-influencer-id");
    const influencerNameField = modal.querySelector("#coupon-influencer-name");
    const influencerHelp = modal.querySelector("#coupon-influencer-help");
    const saveButtonForInfluencers = modal.querySelector("#coupon-editor-save");
    const savedInfluencerId = influencerSelect?.dataset.savedId || "";
    const savedInfluencerName = influencerNameField?.value || "";
    if (saveButtonForInfluencers) {
        saveButtonForInfluencers.disabled = true;
        saveButtonForInfluencers.textContent = "Carregando influenciadores…";
    }
    influencerSelect?.addEventListener("change", () => {
        const option = influencerSelect.selectedOptions[0];
        influencerNameField.value = option?.dataset.name || "";
        const rate = option?.dataset.commission;
        influencerHelp.textContent = option?.value
            ? `ID vinculado: ${option.value}${rate ? ` · Comissão padrão: ${rate}%` : ""}`
            : "Cupom geral: nenhuma venda será atribuída a um influenciador.";
    });
    (async () => {
        try {
            const response = await adminApi.influencers();
            if (!response?.success || !Array.isArray(response.data)) throw new Error(response?.error || "Lista indisponível.");
            const influencers = response.data;
            const currentMatch = savedInfluencerId
                ? influencers.find(item => String(item.id) === savedInfluencerId)
                : influencers.filter(item => String(item.name || "").trim().toLowerCase() === savedInfluencerName.trim().toLowerCase()).length === 1
                    ? influencers.find(item => String(item.name || "").trim().toLowerCase() === savedInfluencerName.trim().toLowerCase())
                    : null;
            influencerSelect.replaceChildren(new Option("Sem vínculo (cupom geral)", ""));
            for (const influencer of influencers) {
                const option = new Option(`${influencer.name} — ID: ${influencer.id}`, String(influencer.id));
                option.dataset.name = String(influencer.name || "");
                option.dataset.commission = String(Number(influencer.commissionDefault || 0));
                influencerSelect.add(option);
            }
            if (currentMatch) {
                influencerSelect.value = String(currentMatch.id);
                influencerNameField.value = String(currentMatch.name || "");
                influencerHelp.textContent = `ID vinculado: ${currentMatch.id} · Comissão padrão: ${Number(currentMatch.commissionDefault || 0)}%`;
            } else if (savedInfluencerId) {
                const legacy = new Option(`${savedInfluencerName || "Vínculo anterior"} — ID não localizado: ${savedInfluencerId}`, savedInfluencerId);
                legacy.dataset.name = savedInfluencerName;
                influencerSelect.add(legacy);
                influencerSelect.value = savedInfluencerId;
                influencerHelp.textContent = "O ID atual não apareceu na lista. Escolha um influenciador válido antes de salvar.";
            } else if (savedInfluencerName) {
                influencerHelp.textContent = `Vínculo antigo pelo nome “${savedInfluencerName}” sem ID. Selecione o influenciador para salvar o vínculo correto.`;
            }
        } catch (error) {
            if (influencerHelp) influencerHelp.textContent = `Não foi possível carregar a lista: ${error.message} Tente novamente antes de vincular.`;
        } finally {
            if (saveButtonForInfluencers) {
                saveButtonForInfluencers.disabled = false;
                saveButtonForInfluencers.textContent = editing ? "Salvar alterações" : "Criar cupom";
            }
        }
    })();


    const close =
        () => {
            modal.remove();
        };


    modal
        .querySelector(
            '#coupon-editor-close'
        )
        ?.addEventListener(
            'click',
            close
        );


    modal
        .querySelector(
            '#coupon-editor-cancel'
        )
        ?.addEventListener(
            'click',
            close
        );


    modal.addEventListener(
        'click',
        event => {

            if (
                event.target ===
                modal
            ) {
                close();
            }
        }
    );


    const form =
        modal.querySelector(
            '#coupon-editor-form'
        );


    form?.addEventListener(
        'submit',
        async event => {

            event.preventDefault();


            const saveButton =
                modal.querySelector(
                    '#coupon-editor-save'
                );


            if (!saveButton) {
                return;
            }


            const code =
                String(
                    modal
                        .querySelector(
                            '#coupon-code'
                        )
                        ?.value ||
                    ''
                )
                    .trim()
                    .toUpperCase();


            const couponTypeValue =
                String(
                    modal
                        .querySelector(
                            '#coupon-type'
                        )
                        ?.value ||
                    'percentage'
                );


            const value =
                Number(
                    modal
                        .querySelector(
                            '#coupon-value'
                        )
                        ?.value ||
                    0
                );


            const minimumOrder =
                Number(
                    modal
                        .querySelector(
                            '#coupon-minimum-order'
                        )
                        ?.value ||
                    0
                );


            const usageLimit =
                Math.max(
                    0,
                    Math.trunc(
                        Number(
                            modal
                                .querySelector(
                                    '#coupon-usage-limit'
                                )
                                ?.value ||
                            0
                        )
                    )
                );


            const active =
                modal
                    .querySelector(
                        '#coupon-active'
                    )
                    ?.value === 'true';


            const influencerName =
                String(
                    modal
                        .querySelector(
                            '#coupon-influencer-name'
                        )
                        ?.value ||
                    ''
                ).trim();


            const influencerId =
                String(
                    modal
                        .querySelector(
                            '#coupon-influencer-id'
                        )
                        ?.value ||
                    ''
                ).trim();


            const description =
                String(
                    modal
                        .querySelector(
                            '#coupon-description'
                        )
                        ?.value ||
                    ''
                ).trim();


            if (!code) {

                showAdminToast?.(
                    'Informe o código do cupom.',
                    'error'
                );

                return;
            }


            if (
                ![
                    'percentage',
                    'fixed'
                ].includes(
                    couponTypeValue
                )
            ) {

                showAdminToast?.(
                    'Tipo de desconto inválido.',
                    'error'
                );

                return;
            }


            if (
                !Number.isFinite(value) ||
                value <= 0
            ) {

                showAdminToast?.(
                    'Informe um valor de desconto maior que zero.',
                    'error'
                );

                return;
            }


            if (
                couponTypeValue ===
                'percentage' &&
                value > 100
            ) {

                showAdminToast?.(
                    'O desconto percentual não pode ser maior que 100%.',
                    'error'
                );

                return;
            }


            if (
                !Number.isFinite(
                    minimumOrder
                ) ||
                minimumOrder < 0
            ) {

                showAdminToast?.(
                    'O pedido mínimo não pode ser negativo.',
                    'error'
                );

                return;
            }


            saveButton.disabled =
                true;

            saveButton.textContent =
                'Salvando...';


            const payload = {

                code,

                type:
                    couponTypeValue,

                value,

                minimumOrder,

                usageLimit,

                active,

                description,

                influencerId,

                influencerName
            };


            try {

                if (
                    !adminApi
                ) {
                    throw new Error(
                        'AdminAPI não está disponível.'
                    );
                }


                if (
                    editing
                ) {

                    if (
                        typeof adminApi.updateCoupon !==
                        'function'
                    ) {
                        throw new Error(
                            'A API de cupons não possui atualização.'
                        );
                    }


                    await adminApi.updateCoupon(
                        couponId(coupon),
                        payload
                    );


                    showAdminToast?.(
                        'Cupom atualizado com sucesso.',
                        'success'
                    );

                } else {

                    if (
                        typeof adminApi.createCoupon !==
                        'function'
                    ) {
                        throw new Error(
                            'A API de cupons não possui criação.'
                        );
                    }


                    await adminApi.createCoupon(
                        payload
                    );


                    showAdminToast?.(
                        'Cupom criado com sucesso.',
                        'success'
                    );
                }


                close();


                await load(
                    'coupons'
                );

            } catch (error) {

                console.error(
                    '[NEFER COUPONS] Erro ao salvar:',
                    error
                );


                showAdminToast?.(
                    error?.message ||
                    'Não foi possível salvar o cupom.',
                    'error'
                );


                saveButton.disabled =
                    false;

                saveButton.textContent =
                    editing
                        ? 'Salvar alterações'
                        : 'Criar cupom';
            }
        }
    );


    setTimeout(
        () => {
            modal
                .querySelector(
                    '#coupon-code'
                )
                ?.focus();
        },
        0
    );
}


/* ============================================================
   LOGÍSTICA
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
                    'Envios registrados',
                    formatNumber(list.length)
                )}

                ${metricCard(
                    'Pendentes',
                    formatNumber(
                        list.filter(row =>
                            [
                                'pending',
                                'processing',
                                'ready',
                                'awaiting_shipment',
                                'to_ship'
                            ].includes(
                                String(
                                    pick(
                                        row,
                                        [
                                            'status',
                                            'state'
                                        ],
                                        ''
                                    )
                                ).toLowerCase()
                            )
                        ).length
                    )
                )}

                ${metricCard(
                    'Fonte',
                    'Firebase / Firestore'
                )}

            </div>


            ${table(
                'Expedição e rastreamento',

                [
                    {
                        label: 'ID',
                        keys: ['id']
                    },

                    {
                        label: 'Pedido',
                        keys: [
                            'order_id',
                            'order_number'
                        ]
                    },

                    {
                        label: 'Transportadora',
                        keys: [
                            'carrier',
                            'shipping_carrier'
                        ]
                    },

                    {
                        label: 'Rastreamento',
                        keys: [
                            'tracking_code',
                            'tracking_number'
                        ]
                    },

                    {
                        label: 'Status',
                        render: row =>
                            renderStatus(
                                pick(
                                    row,
                                    [
                                        'status',
                                        'state'
                                    ],
                                    'pending'
                                )
                            )
                    },

                    {
                        label: 'Atualização',
                        render: row =>
                            formatDate(
                                pick(
                                    row,
                                    [
                                        'updated_at',
                                        'updatedAt',
                                        'created_at',
                                        'createdAt'
                                    ],
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
   RELATÓRIOS
   ============================================================ */

function renderReports(content, reports) {

    const data =
        reports &&
        typeof reports === 'object' &&
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
                    'Faturamento',
                    formatCurrency(
                        pick(
                            metrics,
                            ['revenue'],
                            0
                        )
                    )
                )}

                ${metricCard(
                    'Pedidos',
                    formatNumber(
                        pick(
                            metrics,
                            ['orders'],
                            0
                        )
                    )
                )}

                ${metricCard(
                    'Ticket médio',
                    formatCurrency(
                        pick(
                            metrics,
                            ['averageTicket'],
                            0
                        )
                    )
                )}

                ${metricCard(
                    'Dias registrados',
                    formatNumber(sales.length)
                )}

            </div>


            ${table(
                'Evolução das vendas',

                [
                    {
                        label: 'Data',
                        render: row =>
                            formatDate(
                                pick(
                                    row,
                                    [
                                        'day',
                                        'date'
                                    ],
                                    null
                                )
                            )
                    },

                    {
                        label: 'Pedidos',
                        render: row =>
                            formatNumber(
                                pick(
                                    row,
                                    [
                                        'orders',
                                        'count'
                                    ],
                                    0
                                )
                            )
                    },

                    {
                        label: 'Faturamento',
                        render: row =>
                            formatCurrency(
                                pick(
                                    row,
                                    [
                                        'revenue',
                                        'total'
                                    ],
                                    0
                                )
                            )
                    }
                ],

                sales
            )}


            ${table(
                'Pedidos recentes',

                [
                    {
                        label: 'Pedido',
                        render: row => `
                            <strong>
                                ${escapeHtml(
                                    pick(
                                        row,
                                        [
                                            'order_number',
                                            'number',
                                            'id'
                                        ],
                                        '—'
                                    )
                                )}
                            </strong>
                        `
                    },

                    {
                        label: 'Data',
                        render: row =>
                            formatDate(
                                pick(
                                    row,
                                    [
                                        'created_at',
                                        'createdAt'
                                    ],
                                    null
                                )
                            )
                    },

                    {
                        label: 'Total',
                        render: row =>
                            formatCurrency(
                                pick(
                                    row,
                                    [
                                        'total',
                                        'total_amount'
                                    ],
                                    0
                                )
                            )
                    },

                    {
                        label: 'Status',
                        render: row =>
                            renderStatus(
                                pick(
                                    row,
                                    ['status'],
                                    'pending'
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
                    'Registros de auditoria',
                    formatNumber(list.length)
                )}

                ${metricCard(
                    'Fonte',
                    'Firebase / Firestore'
                )}

            </div>


            ${table(
                'Histórico administrativo',

                [
                    {
                        label: 'Data',
                        render: row =>
                            formatDate(
                                pick(
                                    row,
                                    [
                                        'created_at',
                                        'createdAt',
                                        'timestamp'
                                    ],
                                    null
                                )
                            )
                    },

                    {
                        label: 'Ação',
                        render: row => `
                            <strong>
                                ${escapeHtml(
                                    labelize(
                                        pick(
                                            row,
                                            [
                                                'action',
                                                'event',
                                                'operation'
                                            ],
                                            '—'
                                        )
                                    )
                                )}
                            </strong>
                        `
                    },

                    {
                        label: 'Usuário',
                        keys: [
                            'user_name',
                            'admin_name',
                            'email',
                            'user_id'
                        ]
                    },

                    {
                        label: 'Entidade',
                        keys: [
                            'entity',
                            'resource',
                            'table_name'
                        ]
                    },

                    {
                        label: 'Status',
                        render: row =>
                            renderStatus(
                                pick(
                                    row,
                                    [
                                        'status',
                                        'result'
                                    ],
                                    'completed'
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
   CONFIGURAÇÕES
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
                    'Parâmetros cadastrados',
                    formatNumber(list.length)
                )}

                ${metricCard(
                    'Fonte',
                    'Firebase / Firestore'
                )}

            </div>


            ${table(
                'Parâmetros da NEFER',

                [
                    {
                        label: 'Chave',
                        render: row => `
                            <strong>
                                ${escapeHtml(
                                    pick(
                                        row,
                                        [
                                            'key',
                                            'name',
                                            'setting_key'
                                        ],
                                        '—'
                                    )
                                )}
                            </strong>
                        `
                    },

                    {
                        label: 'Valor',
                        render: row => {

                            const value =
                                pick(
                                    row,
                                    [
                                        'value',
                                        'setting_value',
                                        'content'
                                    ],
                                    '—'
                                );

                            return `
                                <span>
                                    ${escapeHtml(value)}
                                </span>
                            `;
                        }
                    },

                    {
                        label: 'Descrição',
                        keys: [
                            'description',
                            'label',
                            'details'
                        ]
                    },

                    {
                        label: 'Atualização',
                        render: row =>
                            formatDate(
                                pick(
                                    row,
                                    [
                                        'updated_at',
                                        'updatedAt',
                                        'created_at',
                                        'createdAt'
                                    ],
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
        list
            .map(order => {

                const orderNumber =
                    order.orderNumber || order.order_number ||
                    `#${order.id ?? '—'}`;


                const customerName =
                    order.customer?.name ||
                    order.customer_name ||
                    'Cliente não identificado';


                const total =
                    Number(
                        order.total ??
                        order.total_amount ??
                        order.totals?.total ??
                        0
                    );


                const orderStatus =
                    order.status ||
                    '—';


                const paymentStatus =
                    order.payment_status ||
                    order.payment?.status ||
                    '—';


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
            })
            .join('');


    content.outerHTML = `

        <div class="admin-module-data">

            <div class="admin-metrics-grid">

                ${metricCard(
                    'Pedidos carregados',
                    formatNumber(list.length)
                )}

                ${metricCard(
                    'Fonte',
                    'Firebase / Firestore'
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
                                <th>Status</th>
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
            '#adminOrderModal'
        );


    const content =
        modal?.querySelector(
            '.admin-modal-content'
        );


    if (!modal || !content) {
        return;
    }


    modal.removeAttribute('inert');

    modal.classList.add('is-open');

    modal.setAttribute(
        'aria-hidden',
        'false'
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
                'Pedido não encontrado.'
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
                    'Não foi possível carregar os detalhes.'
                )}

            </div>
        `;
    }
}


function createOrderModal() {

    if (
        document.querySelector(
            '#adminOrderModal'
        )
    ) {
        return;
    }


    document.body.insertAdjacentHTML(
        'beforeend',
        `

        <div
            id="adminOrderModal"
            class="admin-modal"
            aria-hidden="true"
            inert
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
        order.orderNumber || order.order_number ||
        `#${order.id || '—'}`;


    const customer =
        order.customer || {};


    const paymentStatus =
        order.payment_status ||
        order.payment?.status ||
        'pending';


    const logisticsStatus =
        order.logistics?.status ||
        'new';


    const logisticsLabel =
        LOGISTICS_STATUS_LABELS[
            logisticsStatus
        ] ||
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
            order.shipping?.cost ??
            order.shipping_cost ??
            order.shippingCost ??
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
        items
            .map(item => {

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
                                'Produto'
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
            })
            .join('');


    const normalizedPayment =
        String(
            paymentStatus
        )
            .trim()
            .toLowerCase();


    const showPaymentButton =
        ![
            'paid',
            'confirmed',
            'approved',
            'completed'
        ].includes(
            normalizedPayment
        );


    const showLogisticsButton =
        [
            'paid',
            'confirmed',
            'approved',
            'completed'
        ].includes(
            normalizedPayment
        );

    const orderItemsSummary = items
        .map(item => `${Number(item.quantity) || 1} × ${item.name || item.product_name || 'Produto'}`)
        .join('\n');
    const trackingUrl = `${window.location.origin}/pages/rastrear-pedido.html?pedido=${encodeURIComponent(orderNumber)}`;
    const customerMessage = [
        `Olá, ${customer.name || 'tudo bem'}! Segue a confirmação do seu pedido na NEFER COSMETICS.`,
        `Pedido: ${orderNumber}`,
        orderItemsSummary ? `Itens:\n${orderItemsSummary}` : '',
        `Total: ${formatCurrency(total)}`,
        `Pagamento: ${String(paymentStatus)}`,
        `Acompanhe o pedido: ${trackingUrl}`
    ].filter(Boolean).join('\n');
    let customerWhatsAppUrl = '';
    try {
        if (customer.phone) {
            customerWhatsAppUrl = createWhatsAppUrl({ phone: customer.phone, message: customerMessage });
        }
    } catch (error) {
        console.warn('[ADMIN ORDER] Telefone do cliente inválido para WhatsApp.', error?.message || error);
    }
    const coupon = order.coupon && typeof order.coupon === 'object' ? order.coupon : {};
    const linkedInfluencerId = String(coupon.influencerId || coupon.influencer_id || '').trim();


    content.innerHTML = `

        <div class="admin-order-details">

            <div class="admin-metrics-grid">

                ${metricCard(
                    'Pedido',
                    orderNumber
                )}

                ${metricCard(
                    'Subtotal',
                    formatCurrency(subtotal)
                )}

                ${metricCard(
                    'Frete',
                    formatCurrency(shipping)
                )}

                ${metricCard(
                    'Total',
                    formatCurrency(total)
                )}

            </div>


            <section class="module-panel">

                <div class="module-panel-header">

                    <div>

                        <span class="module-eyebrow">
                            OPERAÇÃO
                        </span>

                        <h3>
                            Detalhes do pedido
                        </h3>

                    </div>

                </div>


                <div class="admin-operation-grid">

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
                                paymentStatus
                            )}
                        </strong>

                    </article>


                    <article class="admin-operation-card">

                        <span>
                            Logística
                        </span>

                        <strong>
                            ${escapeHtml(
                                logisticsLabel
                            )}
                        </strong>

                    </article>


                    <article class="admin-operation-card">

                        <span>
                            Desconto
                        </span>

                        <strong>
                            ${formatCurrency(
                                discount
                            )}
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
                            : ''
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
                            : ''
                    }

                </div>

                <div class="admin-order-whatsapp-actions">
                    ${customerWhatsAppUrl ? `
                        <a class="admin-button" href="${escapeHtml(customerWhatsAppUrl)}" target="_blank" rel="noopener noreferrer">
                            Enviar confirmação ao cliente pelo WhatsApp
                        </a>
                    ` : ''}
                    ${linkedInfluencerId ? `
                        <a class="admin-button" id="adminOrderInfluencerWhatsApp" href="#" target="_blank" rel="noopener noreferrer" hidden>
                            Avisar influenciador pelo WhatsApp
                        </a>
                    ` : ''}
                    <small>O WhatsApp abre a mensagem preenchida; a equipe confirma o envio.</small>
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
                                'Cliente não identificado'
                            )}
                        </h3>

                        <p>
                            ${escapeHtml(
                                customer.email ||
                                'E-mail não informado'
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
                                '—'
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
                                                        'Evento'
                                                    )}
                                                </strong>


                                                ${
                                                    event.createdAt ||
                                                    event.created_at
                                                        ? `
                                                            <span>
                                                                ${escapeHtml(
                                                                    formatDate(
                                                                        event.createdAt ||
                                                                        event.created_at
                                                                    )
                                                                )}
                                                            </span>
                                                        `
                                                        : ''
                                                }

                                            </div>

                                        `)
                                        .join('')
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

    if (linkedInfluencerId) {
        const influencerLink = content.querySelector('#adminOrderInfluencerWhatsApp');
        window.AdminAPI?.influencers?.().then(result => {
            const influencer = (result?.data || []).find(item => String(item.id) === linkedInfluencerId);
            if (!influencer?.phone || !influencerLink) return;
            const influencerMessage = [
                `Olá, ${influencer.name || 'tudo bem'}! Um pedido foi atribuído ao seu cupom.`,
                `Pedido: ${orderNumber}`,
                coupon.code ? `Cupom: ${coupon.code}` : '',
                orderItemsSummary ? `Itens:\n${orderItemsSummary}` : '',
                `Total do pedido: ${formatCurrency(total)}`,
                `Pagamento: ${String(paymentStatus)}`,
                `Acompanhe: ${trackingUrl}`
            ].filter(Boolean).join('\n');
            try {
                influencerLink.href = createWhatsAppUrl({ phone: influencer.phone, message: influencerMessage });
                influencerLink.hidden = false;
            } catch (error) {
                console.warn('[ADMIN ORDER] Telefone do influenciador inválido para WhatsApp.', error?.message || error);
            }
        }).catch(error => {
            console.warn('[ADMIN ORDER] Não foi possível carregar o contato do influenciador.', error?.message || error);
        });
    }


    document
        .querySelector(
            '#confirmOrderPayment'
        )
        ?.addEventListener(
            'click',
            async () => {

                const button =
                    document.querySelector(
                        '#confirmOrderPayment'
                    );


                if (!button) {
                    return;
                }


                try {

                    button.disabled =
                        true;


                    await confirmPayment(
                        order.id
                    );


                    window.alert(
                        'Pagamento confirmado.'
                    );


                    await openOrderDetails(
                        order.id
                    );

                } catch (error) {

                    console.error(
                        '[ADMIN ORDER] Erro ao confirmar pagamento:',
                        error
                    );


                    button.disabled =
                        false;


                    window.alert(
                        error?.message ||
                        'Não foi possível confirmar o pagamento.'
                    );
                }
            }
        );


    document
        .querySelector(
            '#advanceOrderLogistics'
        )
        ?.addEventListener(
            'click',
            async () => {

                const button =
                    document.querySelector(
                        '#advanceOrderLogistics'
                    );


                if (!button) {
                    return;
                }


                try {

                    button.disabled =
                        true;


                    await advanceLogistics(
                        order.id
                    );


                    window.alert(
                        'Status logístico atualizado.'
                    );


                    await openOrderDetails(
                        order.id
                    );

                } catch (error) {

                    console.error(
                        '[ADMIN ORDER] Erro ao avançar logística:',
                        error
                    );


                    button.disabled =
                        false;


                    window.alert(
                        error?.message ||
                        'Não foi possível atualizar a logística.'
                    );
                }
            }
        );
}


/* ============================================================
   EVENTOS
   ============================================================ */

document.addEventListener(
    'click',
    event => {

        const sectionButton =
            event.target.closest(
                '[data-admin-section]'
            );


        if (sectionButton) {

            const section =
                sectionButton.dataset.adminSection;


            load(section);

            return;
        }


        const orderButton =
            event.target.closest(
                '[data-order-details]'
            );


        if (orderButton) {

            openOrderDetails(
                orderButton.dataset.orderDetails
            );

            return;
        }


        if (
            event.target.closest(
                '[data-close-order-modal]'
            )
        ) {

            event.preventDefault();


            const modal =
                document.querySelector(
                    '#adminOrderModal'
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
                'is-open'
            );


            modal.setAttribute(
                'aria-hidden',
                'true'
            );


            modal.setAttribute(
                'inert',
                ''
            );


            return;
        }


        if (
            event.target.closest(
                '#adminLogout'
            )
        ) {

            window.location.href =
                './admin-login.html';
        }

    }
);


/* ============================================================
   EDITOR DE PRODUTO
   ============================================================ */

(function installProductEditHandler() {

    if (
        window.__aureaProductEditHandlerInstalled
    ) {
        return;
    }


    document.addEventListener(
        'click',
        async event => {

            const button =
                event.target.closest(
                    'button.admin-product-edit'
                );


            if (!button) {
                return;
            }


            event.preventDefault();
            event.stopPropagation();


            const productId =
                String(
                    button.getAttribute(
                        'data-product-id'
                    ) || ''
                ).trim();


            if (!productId) {

                console.error(
                    '[NEFER ADMIN] data-product-id vazio.'
                );

                return;
            }


            let products =
                Array.isArray(
                    window.__aureaAdminProducts
                )
                    ? window.__aureaAdminProducts
                    : [];


            let product =
                products.find(
                    item =>
                        String(
                            item?.id ??
                            item?.productId ??
                            item?.docId ??
                            ''
                        ) ===
                        productId
                );


            if (!product) {

                try {

                    const result =
                        await adminApi.products();


                    products =
                        Array.isArray(result)
                            ? result
                            : Array.isArray(
                                result?.data
                            )
                                ? result.data
                                : Array.isArray(
                                    result?.products
                                )
                                    ? result.products
                                    : [];


                    product =
                        products.find(
                            item =>
                                String(
                                    item?.id ??
                                    item?.productId ??
                                    item?.docId ??
                                    ''
                                ) ===
                                productId
                        );


                    if (product) {
                        window.__aureaAdminProducts =
                            products;
                    }

                } catch (error) {

                    console.error(
                        '[NEFER ADMIN] Falha ao buscar produto:',
                        error
                    );
                }
            }


            if (!product) {

                showAdminToast?.(
                    'Produto não encontrado.',
                    'error'
                );

                return;
            }


            openProductEditor(
                product
            );

        },
        true
    );


    window.__aureaProductEditHandlerInstalled =
        true;

})();


/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */

async function initializeAdminAccess() {
    try {
        const response = await adminApi.get("/access");
        if (!response?.success) throw new Error(response?.error || "Acesso não autorizado.");
        const isCollaborator = response.data?.role === "collaborator";
        const roleLabel = document.getElementById("adminUserRole");
        const accessLabel = document.getElementById("adminAccessLabel");
        if (roleLabel) roleLabel.textContent = isCollaborator ? "Colaborador" : "Administrador";
        if (accessLabel) accessLabel.textContent = isCollaborator ? "Consulta e rascunhos" : "Acesso total";
        if (isCollaborator) {
            navigation.forEach(item => {
                item.hidden = !["partnerships", "contracts"].includes(item.dataset.adminSection);
            });
            await load("commissions");
            return;
        }
        await load("dashboard");
    } catch (error) {
        root.innerHTML = "";
        const errorBox = document.createElement("div");
        errorBox.className = "admin-error";
        errorBox.textContent = error?.message || "Não foi possível validar seu acesso.";
        root.appendChild(errorBox);
    }
}

initializeAdminAccess();


/* ============================================================
   ESTILO DO POP-UP DE PRODUTOS
   ============================================================ */

(function installProductEditorPopupStyle() {

    if (
        document.getElementById(
            'aurea-product-editor-popup-style'
        )
    ) {
        return;
    }


    const style =
        document.createElement(
            'style'
        );


    style.id =
        'aurea-product-editor-popup-style';


    style.textContent = `

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

            background:
                rgba(0, 0, 0, 0.62) !important;

            backdrop-filter:
                blur(5px) !important;

            overflow-y: auto !important;
        }


        .admin-product-editor-overlay
        .admin-product-editor {

            position: relative !important;

            width:
                min(820px, 100%) !important;

            max-width:
                820px !important;

            max-height:
                calc(100vh - 48px) !important;

            overflow-y:
                auto !important;

            margin:
                auto !important;

            padding:
                28px !important;

            box-sizing:
                border-box !important;

            background:
                #ffffff !important;

            color:
                #171717 !important;

            border-radius:
                18px !important;

            box-shadow:
                0 25px 80px
                    rgba(0, 0, 0, 0.38),
                0 8px 30px
                    rgba(0, 0, 0, 0.18) !important;

            transform:
                none !important;

            opacity:
                1 !important;
        }


        .admin-product-editor
        .admin-product-editor-header {

            display:
                flex !important;

            align-items:
                flex-start !important;

            justify-content:
                space-between !important;

            gap:
                20px !important;

            margin-bottom:
                24px !important;

            padding-bottom:
                18px !important;

            border-bottom:
                1px solid #eeeeee !important;
        }


        .admin-product-editor
        .admin-product-editor-header h2 {

            margin:
                0 0 6px 0 !important;

            color:
                #171717 !important;

            font-size:
                22px !important;

            line-height:
                1.25 !important;
        }


        .admin-product-editor
        .admin-product-editor-header p {

            margin:
                0 !important;

            color:
                #777777 !important;

            font-size:
                13px !important;
        }


        .admin-product-editor
        .admin-product-editor-close {

            flex:
                0 0 auto !important;

            width:
                38px !important;

            height:
                38px !important;

            padding:
                0 !important;

            border:
                0 !important;

            border-radius:
                50% !important;

            background:
                #f1f1f1 !important;

            color:
                #222222 !important;

            font-size:
                24px !important;

            line-height:
                38px !important;

            cursor:
                pointer !important;
        }


        .admin-product-editor
        .admin-product-editor-close:hover {

            background:
                #e5e5e5 !important;

            transform:
                scale(1.05) !important;
        }


        .admin-product-editor
        .admin-product-editor-form {

            display:
                grid !important;

            gap:
                18px !important;

            width:
                100% !important;
        }


        .admin-product-editor
        .admin-product-editor-grid {

            display:
                grid !important;

            grid-template-columns:
                repeat(
                    2,
                    minmax(0, 1fr)
                ) !important;

            gap:
                16px !important;

            width:
                100% !important;
        }


        .admin-product-editor
        .admin-product-editor-full {

            grid-column:
                1 / -1 !important;
        }


        .admin-product-editor label {

            display:
                flex !important;

            flex-direction:
                column !important;

            gap:
                7px !important;

            color:
                #333333 !important;

            font-size:
                13px !important;

            font-weight:
                600 !important;
        }


        .admin-product-editor input,
        .admin-product-editor textarea,
        .admin-product-editor select {

            width:
                100% !important;

            min-height:
                42px !important;

            box-sizing:
                border-box !important;

            padding:
                10px 12px !important;

            border:
                1px solid #d8d8d8 !important;

            border-radius:
                9px !important;

            background:
                #ffffff !important;

            color:
                #171717 !important;

            font-family:
                inherit !important;

            font-size:
                14px !important;

            outline:
                none !important;
        }


        .admin-product-editor input:focus,
        .admin-product-editor textarea:focus,
        .admin-product-editor select:focus {

            border-color:
                #888888 !important;

            box-shadow:
                0 0 0 3px
                rgba(0, 0, 0, 0.06)
                !important;
        }


        .admin-product-editor textarea {

            min-height:
                110px !important;

            resize:
                vertical !important;
        }


        .admin-product-editor
        .admin-product-editor-actions {

            display:
                flex !important;

            justify-content:
                flex-end !important;

            align-items:
                center !important;

            gap:
                10px !important;

            margin-top:
                4px !important;

            padding-top:
                18px !important;

            border-top:
                1px solid #eeeeee !important;
        }


        .admin-product-editor
        .admin-product-editor-actions button {

            min-height:
                42px !important;

            padding:
                10px 20px !important;

            border:
                0 !important;

            border-radius:
                9px !important;

            cursor:
                pointer !important;

            font-family:
                inherit !important;

            font-size:
                14px !important;

            font-weight:
                700 !important;
        }


        .admin-product-editor
        .admin-product-editor-cancel {

            background:
                #eeeeee !important;

            color:
                #222222 !important;
        }


        .admin-product-editor
        .admin-product-editor-save {

            background:
                #171717 !important;

            color:
                #ffffff !important;
        }


        .admin-product-editor
        .admin-product-editor-save:hover {

            background:
                #333333 !important;
        }


        @media (max-width: 700px) {

            .admin-product-editor-overlay {

                padding:
                    12px !important;
            }


            .admin-product-editor-overlay
            .admin-product-editor {

                width:
                    100% !important;

                max-height:
                    calc(100vh - 24px) !important;

                padding:
                    20px !important;

                border-radius:
                    14px !important;
            }


            .admin-product-editor
            .admin-product-editor-grid {

                grid-template-columns:
                    1fr !important;
            }


            .admin-product-editor
            .admin-product-editor-actions {

                flex-direction:
                    column-reverse !important;
            }


            .admin-product-editor
            .admin-product-editor-actions button {

                width:
                    100% !important;
            }
        }
    `;


    document.head.appendChild(
        style
    );

})();





/* ============================================================
   NEFER — INFLUENCIADORES
   ============================================================ */

(function initInfluencersModule() {

    async function loadInfluencers() {
        const result = await window.AdminAPI.influencers();

        if (!result?.success) {
            throw new Error(result?.error || "Erro ao carregar influenciadores.");
        }

        return result.data || [];
    }

    async function createInfluencer(data) {
        const result =
            await window.AdminAPI.createInfluencer(data);

        if (!result?.success) {
            throw new Error(result?.error || "Erro ao cadastrar influenciador.");
        }

        return result.data;
    }

    async function updateInfluencer(id, data) {
        const result = await window.AdminAPI.updateInfluencer(id, data);
        if (!result?.success) {
            throw new Error(result?.error || "Erro ao atualizar influenciador.");
        }
        return result.data;
    }

    function renderInfluencers(container, influencers) {

        container.innerHTML = `
            <div class="admin-module-header">
                <div>
                    <h2>Influenciadores</h2>
                    <p>Gerencie influenciadores e comissões.</p>
                </div>

                <button
                    type="button"
                    class="btn btn-primary"
                    id="nefer-new-influencer">
                    Novo influenciador
                </button>
            </div>

            <div id="nefer-influencer-form-container"></div>

            <div class="admin-table-wrapper">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>E-mail</th>
                            <th>Telefone</th>
                            <th>Chave PIX</th>
                            <th>Comissão</th>
                            <th>Status</th>
                            <th>Ações</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${
                            influencers.length
                                ? influencers.map(item => `
                                    <tr>
                                        <td>${escapeHtml(item.name)}</td>
                                        <td>${escapeHtml(item.email || "-")}</td>
                                        <td>${escapeHtml(item.phone || "-")}</td>
                                        <td>${escapeHtml(item.pixKey || "Não informada")}</td>
                                        <td>${Number(item.commissionDefault || 0).toFixed(2)}%</td>
                                        <td>${item.active !== false ? "Ativo" : "Inativo"}</td>
                                        <td><button type="button" class="btn nefer-edit-influencer" data-influencer-id="${escapeHtml(item.id)}">Editar</button></td>
                                    </tr>
                                `).join("")
                                : `
                                    <tr>
                                        <td colspan="7">
                                            Nenhum influenciador cadastrado.
                                        </td>
                                    </tr>
                                `
                        }
                    </tbody>
                </table>
            </div>
        `;

        document
            .getElementById("nefer-new-influencer")
            ?.addEventListener("click", () => {
                showInfluencerForm(container);
            });

        container.querySelectorAll(".nefer-edit-influencer").forEach(button => {
            button.addEventListener("click", () => {
                const influencer = influencers.find(item => String(item.id) === button.dataset.influencerId);
                if (influencer) showInfluencerForm(container, influencer);
            });
        });
    }

    function showInfluencerForm(container, influencer = null) {

        const formContainer =
            document.getElementById(
                "nefer-influencer-form-container"
            );

        if (!formContainer) return;

        formContainer.innerHTML = `
            <form id="nefer-influencer-form" class="admin-form">

                <div>
                    <label>Nome</label>
                    <input
                        name="name"
                        required
                        autocomplete="off"
                        value="${escapeHtml(influencer?.name || "")}">
                </div>

                <div>
                    <label>E-mail</label>
                    <input
                        name="email"
                        type="email"
                        autocomplete="off"
                        value="${escapeHtml(influencer?.email || "")}">
                </div>

                <div>
                    <label>Telefone</label>
                    <input
                        name="phone"
                        autocomplete="off"
                        value="${escapeHtml(influencer?.phone || "")}">
                </div>

                <div>
                    <label>Chave PIX para repasses</label>
                    <input
                        name="pixKey"
                        type="text"
                        maxlength="160"
                        autocomplete="off"
                        placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
                        value="${escapeHtml(influencer?.pixKey || "")}">
                </div>

                <div>
                    <label>Comissão padrão (%)</label>
                    <input
                        name="commissionDefault"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value="0">
                </div>

                <div>
                    <label>
                        <input
                            name="active"
                            type="checkbox"
                            ${influencer?.active === false ? "" : "checked"}>
                        Ativo
                    </label>
                </div>

                <div>
                    <button
                        type="submit"
                        class="btn btn-primary">
                        ${influencer ? "Salvar alterações" : "Salvar influenciador"}
                    </button>

                    <button
                        type="button"
                        class="btn"
                        id="nefer-cancel-influencer">
                        Cancelar
                    </button>
                </div>

                <div id="nefer-influencer-message"></div>

            </form>
        `;

        document
            .getElementById("nefer-cancel-influencer")
            ?.addEventListener("click", () => {
                formContainer.innerHTML = "";
            });

        document
            .getElementById("nefer-influencer-form")
            ?.addEventListener("submit", async event => {

                event.preventDefault();

                const form = event.currentTarget;
                const message =
                    document.getElementById(
                        "nefer-influencer-message"
                    );

                const data = {
                    name: form.name.value.trim(),
                    email: form.email.value.trim(),
                    phone: form.phone.value.trim(),
                    pixKey: form.pixKey.value.trim(),
                    commissionDefault:
                        Number(form.commissionDefault.value || 0),
                    active:
                        form.active.checked
                };

                try {

                    if (influencer?.id) {
                        await updateInfluencer(influencer.id, data);
                    } else {
                        await createInfluencer(data);
                    }

                    message.textContent =
                        influencer ? "Dados do influenciador atualizados." : "Influenciador cadastrado com sucesso.";

                    const list =
                        await loadInfluencers();

                    renderInfluencers(
                        container,
                        list
                    );

                } catch (error) {

                    message.textContent =
                        error.message;

                    console.error(
                        "[NEFER INFLUENCERS]",
                        error
                    );
                }
            });
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    window.NEFERInfluencers = {
        load: loadInfluencers,
        render: renderInfluencers
    };

})();
