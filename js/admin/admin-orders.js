'use strict';

import {
    listOrders,
    updateOrder
} from './order-repository.js';

const elements = {
    total: document.querySelector('#ordersTotal'),
    pending: document.querySelector('#ordersPending'),
    paid: document.querySelector('#ordersPaid'),
    cancelled: document.querySelector('#ordersCancelled'),
    tableBody: document.querySelector('#ordersTableBody'),
    empty: document.querySelector('#ordersEmpty'),
    details: document.querySelector('#orderDetails'),
    refresh: document.querySelector('#refreshOrders')
};

let orders = [];

function money(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function formatDate(value) {
    if (!value) return 'Ã¢â‚¬â€';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'Ã¢â‚¬â€';
    }

    return date.toLocaleString('pt-BR');
}

function statusLabel(status) {
    const labels = {
        new: 'Novo',
        pending: 'Pendente',
        confirmed: 'Confirmado',
        paid: 'Pago',
        processing: 'Preparando',
        shipped: 'Enviado',
        delivered: 'Entregue',
        cancelled: 'Cancelado'
    };

    return labels[status] || status || 'Ã¢â‚¬â€';
}

function paymentStatusLabel(status) {
    const labels = {
        pending: 'Pendente',
        paid: 'Pago',
        failed: 'Falhou',
        cancelled: 'Cancelado'
    };

    return labels[status] || status || 'Ã¢â‚¬â€';
}

function renderSummary() {
    elements.total.textContent = orders.length;

    elements.pending.textContent = orders.filter(order =>
        ['new', 'pending', 'confirmed', 'processing'].includes(order.status)
    ).length;

    elements.paid.textContent = orders.filter(order =>
        order.payment?.status === 'paid'
    ).length;

    elements.cancelled.textContent = orders.filter(order =>
        order.status === 'cancelled'
    ).length;
}

function renderOrders() {
    if (!orders.length) {
        elements.tableBody.innerHTML = '';
        elements.empty.hidden = false;
        return;
    }

    elements.empty.hidden = true;

    elements.tableBody.innerHTML = orders.map(order => `
        <tr data-order-id="${escapeHtml(order.id)}">
            <td>
                <strong>${escapeHtml(order.orderId || order.id)}</strong>
            </td>

            <td>
                ${escapeHtml(order.customer?.name || 'Cliente nÃƒÂ£o informado')}
            </td>

            <td>
                ${escapeHtml(order.customer?.email || 'Ã¢â‚¬â€')}
            </td>

            <td>
                ${escapeHtml(statusLabel(order.status))}
            </td>

            <td>
                ${escapeHtml(paymentStatusLabel(order.payment?.status))}
            </td>

            <td>
                <strong>${money(order.total)}</strong>
            </td>

            <td>
                ${formatDate(order.createdAt)}
            </td>

            <td>
                <button
                    type="button"
                    class="order-view-button"
                    data-order-id="${escapeHtml(order.id)}"
                >
                    Ver
                </button>
            </td>
        </tr>
    `).join('');

    document.querySelectorAll('.order-view-button').forEach(button => {
        button.addEventListener('click', () => {
            const order = orders.find(item =>
                item.id === button.dataset.orderId
            );

            if (order) {
                renderDetails(order);
            }
        });
    });
}

function renderDetails(order) {
    const items = Array.isArray(order.items)
        ? order.items
        : [];

    const history = Array.isArray(order.history)
        ? order.history
        : [];
    const coupon = order.coupon && typeof order.coupon === 'object'
        ? order.coupon
        : null;
    const couponCode = coupon?.code || (Number(order.discount || 0) > 0
        ? 'Dados do cupom não foram salvos'
        : 'Sem cupom');
    const influencerName = coupon?.affiliateName || coupon?.influencerName || 'Não identificado';

    elements.details.hidden = false;

    elements.details.innerHTML = `
        <div class="order-details-header">
            <div>
                <span class="order-details-label">PEDIDO</span>
                <h2>${escapeHtml(order.orderId || order.id)}</h2>
            </div>

            <button
                type="button"
                id="closeOrderDetails"
                class="order-close-button"
            >
                Fechar
            </button>
        </div>

        <div class="order-details-grid">

            <section>
                <h3>Cliente</h3>

                <p>
                    <strong>Nome:</strong>
                    ${escapeHtml(order.customer?.name || 'Ã¢â‚¬â€')}
                </p>

                <p>
                    <strong>E-mail:</strong>
                    ${escapeHtml(order.customer?.email || 'Ã¢â‚¬â€')}
                </p>

                <p>
                    <strong>Telefone:</strong>
                    ${escapeHtml(order.customer?.phone || 'Ã¢â‚¬â€')}
                </p>
            </section>

            <section>
                <h3>Pedido</h3>

                <p>
                    <strong>Status:</strong>
                    ${escapeHtml(statusLabel(order.status))}
                </p>

                <p>
                    <strong>Pagamento:</strong>
                    ${escapeHtml(paymentStatusLabel(order.payment?.status))}
                </p>

                <p>
                    <strong>Criado:</strong>
                    ${formatDate(order.createdAt)}
                </p>
            </section>

            <section>
                <h3>Entrega</h3>

                <p>
                    <strong>MÃƒÂ©todo:</strong>
                    ${escapeHtml(order.delivery?.method || 'Ã¢â‚¬â€')}
                </p>

                <p>
                    <strong>EndereÃƒÂ§o:</strong>
                    ${formatAddress(order.delivery?.address)}
                </p>
            </section>

            <section>
                <h3>Totais</h3>

                <p>
                    <strong>Subtotal:</strong>
                    ${money(order.subtotal)}
                </p>

                <p>
                    <strong>Desconto:</strong>
                    ${money(order.discount)}
                </p>

                <p>
                    <strong>Frete:</strong>
                    ${money(order.shipping)}
                </p>

                <p>
                    <strong>Total:</strong>
                    ${money(order.total)}
                </p>
            </section>

            <section>
                <h3>Parceria</h3>

                <p>
                    <strong>Cupom:</strong>
                    ${escapeHtml(couponCode)}
                </p>

                <p>
                    <strong>Influenciador:</strong>
                    ${escapeHtml(influencerName)}
                </p>

                <p>
                    <strong>Comissão:</strong>
                    ${coupon && coupon.influencerId
                        ? `${Number(coupon.commission || 0).toFixed(2)}% — conciliada em Comissões após confirmação do pagamento`
                        : Number(order.discount || 0) > 0
                            ? 'Revisão necessária; identifique o cupom antes do repasse.'
                            : 'Não se aplica'}
                </p>
            </section>

        </div>

        <section class="order-items">
            <h3>Itens</h3>

            ${
                items.length
                    ? `
                        <table>
                            <thead>
                                <tr>
                                    <th>SKU</th>
                                    <th>Produto</th>
                                    <th>Qtd.</th>
                                    <th>UnitÃƒÂ¡rio</th>
                                    <th>Total</th>
                                </tr>
                            </thead>

                            <tbody>
                                ${items.map(item => `
                                    <tr>
                                        <td>${escapeHtml(item.sku)}</td>
                                        <td>${escapeHtml(item.name)}</td>
                                        <td>${item.quantity}</td>
                                        <td>${money(item.unitPrice)}</td>
                                        <td>${money(item.total)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `
                    : '<p>Nenhum item registrado.</p>'
            }
        </section>

        <section class="order-status-editor">
            <h3>Alterar status</h3>

            <div class="status-editor-row">
                <select id="orderStatusSelect">
                    ${[
                        'new',
                        'pending',
                        'confirmed',
                        'paid',
                        'processing',
                        'shipped',
                        'delivered',
                        'cancelled'
                    ].map(status => `
                        <option
                            value="${status}"
                            ${order.status === status ? 'selected' : ''}
                        >
                            ${statusLabel(status)}
                        </option>
                    `).join('')}
                </select>

                <button
                    type="button"
                    id="saveOrderStatus"
                >
                    Salvar status
                </button>
            </div>
        </section>

        <section class="order-history">
            <h3>HistÃƒÂ³rico</h3>

            ${
                history.length
                    ? `
                        <ul>
                            ${history.slice().reverse().map(event => `
                                <li>
                                    <strong>
                                        ${escapeHtml(event.type || event.event || 'Evento')}
                                    </strong>

                                    ${
                                        event.createdAt
                                            ? ` Ã¢â‚¬â€ ${formatDate(event.createdAt)}`
                                            : ''
                                    }
                                </li>
                            `).join('')}
                        </ul>
                    `
                    : '<p>Nenhum evento registrado.</p>'
            }
        </section>
    `;

    document
        .querySelector('#closeOrderDetails')
        ?.addEventListener('click', () => {
            elements.details.hidden = true;
        });

    document
        .querySelector('#saveOrderStatus')
        ?.addEventListener('click', async () => {

            const select = document.querySelector('#orderStatusSelect');
            const newStatus = select.value;

            if (!newStatus || newStatus === order.status) {
                return;
            }

            try {
                select.disabled = true;

                const changes = {
                    status: newStatus
                };

                if (newStatus === 'paid') {
                    changes.payment = {
                        ...(order.payment || {}),
                        status: 'paid',
                        paidAt: new Date().toISOString()
                    };
                }

                await updateOrder(
                    order.id,
                    changes
                );

                if (changes.payment?.status === 'paid') {
                    try {
                        await window.AdminAPI.syncCommissions();
                    } catch (commissionError) {
                        console.error('[NEFER] Pedido pago, mas a conciliação automática de comissões falhou:', commissionError);
                    }
                }

                await loadOrders();

                const updated = orders.find(item =>
                    item.id === order.id
                );

                if (updated) {
                    renderDetails(updated);
                }

                window.alert('Status do pedido atualizado.');
            } catch (error) {
                console.error(error);
                window.alert(
                    error?.message ||
                    'NÃƒÂ£o foi possÃƒÂ­vel atualizar o pedido.'
                );
            } finally {
                select.disabled = false;
            }
        });
}

function formatAddress(address) {
    if (!address) {
        return 'Ã¢â‚¬â€';
    }

    if (typeof address === 'string') {
        return escapeHtml(address);
    }

    const parts = [
        address.street,
        address.number,
        address.complement,
        address.neighborhood,
        address.city,
        address.state,
        address.zipCode || address.cep
    ].filter(Boolean);

    return escapeHtml(parts.join(', ') || 'Ã¢â‚¬â€');
}

async function loadOrders() {
    try {
        elements.tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="orders-loading">
                    Carregando pedidos...
                </td>
            </tr>
        `;

        elements.empty.hidden = true;

        orders = await listOrders(200);

        renderSummary();
        renderOrders();

    } catch (error) {
        console.error('[ADMIN ORDERS]', error);

        elements.tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="orders-error">
                    NÃƒÂ£o foi possÃƒÂ­vel carregar os pedidos.
                </td>
            </tr>
        `;
    }
}

elements.refresh?.addEventListener('click', loadOrders);

loadOrders();
