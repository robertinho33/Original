const adminApi = window.AdminAPI;

import {
    money,
    number,
    date,
    escapeHtml,
    metric
} from "./admin-formatters.js";

export async function renderOperationalEnvironment(root) {
    root.innerHTML = `
        <section class="module-panel">
            <div class="module-panel-header">
                <div>
                    <span class="module-eyebrow">AURÉA COSMETICS</span>
                    <h2>Ambiente operacional</h2>
                    <p>Visão consolidada da operação.</p>
                </div>
                <button class="admin-primary-button"
                        data-refresh-admin>
                    Atualizar
                </button>
            </div>

            <div id="admin-operational-content"
                 class="admin-operational-content">
                <div class="admin-loading">
                    Carregando operação...
                </div>
            </div>
        </section>
    `;

    const content = root.querySelector(
        "#admin-operational-content"
    );

    try {
        const [overview, timeline, alerts, customers] =
            await Promise.all([
                adminApi.overview(),
                adminApi.timeline(30),
                adminApi.alerts(),
                adminApi.customers()
            ]);

        const data = overview.data || {};
        const rows = timeline.data || [];
        const notifications = alerts.data || [];

        /*
         * CONTRATO DO OVERVIEW
         *
         * O backend entrega:
         *   faturamentoHoje
         *   pedidosHoje
         *   pedidosTotal
         *   produtos
         *   estoqueBaixo
         *   semEstoque
         *   pagamentosPendentes
         *   enviosPendentes
         *
         * O frontend antigo esperava nomes diferentes.
         * A normalização abaixo mantém o backend intacto.
         */
        const overviewData = {
            revenue: data.faturamentoHoje,
            ordersToday: data.pedidosHoje,
            customers: Array.isArray(customers?.data) ? customers.data.length : (data.clientes ?? data.customers ?? 0),
            products: data.produtos,
            inventory: {
                low_stock: data.estoqueBaixo,
                out_of_stock: data.semEstoque
            },
            payments: {
                pending: data.pagamentosPendentes
            },
            shipping: data.enviosPendentes
        };

        content.innerHTML = `
            <div class="admin-metrics-grid">
                ${metric(
                    "Faturamento hoje",
                    money(overviewData.revenue)
                )}

                ${metric(
                    "Pedidos hoje",
                    number(overviewData.ordersToday)
                )}

                ${metric(
                    "Clientes",
                    number(overviewData.customers)
                )}

                ${metric(
                    "Produtos",
                    number(overviewData.products)
                )}

                ${metric(
                    "Estoque baixo",
                    number(overviewData.inventory?.low_stock)
                )}

                ${metric(
                    "Sem estoque",
                    number(overviewData.inventory?.out_of_stock)
                )}

                ${metric(
                    "Pagamentos pendentes",
                    number(overviewData.payments?.pending)
                )}

                ${metric(
                    "Envios pendentes",
                    number(overviewData.shipping)
                )}
            </div>

            <div class="admin-operation-grid">

                <div class="module-panel">
                    <div class="module-panel-header">
                        <h3>Vendas recentes</h3>
                    </div>

                    <div class="admin-table-wrap">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Pedidos</th>
                                    <th>Faturamento</th>
                                    <th>Ticket</th>
                                </tr>
                            </thead>

                            <tbody>
                                ${
                                    rows.length
                                    ? rows.map(row => `
                                        <tr>
                                            <td>${date(row.date)}</td>
                                            <td>${number(row.orders)}</td>
                                            <td>${money(row.revenue)}</td>
                                            <td>${money(row.revenue / Math.max(Number(row.orders), 1))}</td>
                                        </tr>
                                    `).join("")
                                    : `
                                        <tr>
                                            <td colspan="4"
                                                class="admin-empty-cell">
                                                Nenhum dado disponível.
                                            </td>
                                        </tr>
                                    `
                                }
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="module-panel">
                    <div class="module-panel-header">
                        <h3>Alertas operacionais</h3>
                    </div>

                    <div class="admin-notifications">
                        ${
                            notifications.length
                            ? notifications.map(item => `
                                <article class="admin-notification">
                                    <strong>
                                        ${escapeHtml(item.title)}
                                    </strong>
                                    <span>
                                        ${escapeHtml(item.message)}
                                    </span>
                                </article>
                            `).join("")
                            : `
                                <div class="admin-empty-state">
                                    Operação sem alertas.
                                </div>
                            `
                        }
                    </div>
                </div>

            </div>
        `;

    } catch (error) {
        content.innerHTML = `
            <div class="admin-error">
                ${escapeHtml(error.message)}
            </div>
        `;
    }
}

