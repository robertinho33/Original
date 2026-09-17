'use strict';

import {
    observeAdminAuth,
    logoutAdmin
} from '../auth/admin-auth.js';

import {
    getAllOrders
} from '../orders/order-service.js';

import {
    buildCustomerSummaries
} from './customer-service.js';

import {
    getCustomerDetail
} from './customer-detail-service.js';

import {
    getOrderStatusLabel
} from '../orders/order-status.js';

import {
    getLogisticsStatusLabel,
    LOGISTICS_FLOW
} from '../orders/logistics-status.js';

import {
    confirmPayment,
    advanceLogistics
} from '../orders/order-admin-service.js';

const elements = {
    userEmail: document.getElementById('adminUserEmail'),
    logoutButton: document.getElementById('adminLogoutButton'),

    ordersCount: document.getElementById('ordersCount'),
    pendingPaymentsCount:
        document.getElementById('pendingPaymentsCount'),
    activeOrdersCount:
        document.getElementById('activeOrdersCount'),

    customersCount:
        document.getElementById('customersCount'),

    customersEmpty:
        document.getElementById('adminCustomersEmpty'),

    customersList:
        document.getElementById('adminCustomersList'),

    customerDetail:
        document.getElementById('adminCustomerDetail'),

    customerDetailName:
        document.getElementById('customerDetailName'),

    customerDetailContact:
        document.getElementById('customerDetailContact'),

    customerDetailOrdersCount:
        document.getElementById('customerDetailOrdersCount'),

    customerDetailTotalSpent:
        document.getElementById('customerDetailTotalSpent'),

    customerDetailLastOrder:
        document.getElementById('customerDetailLastOrder'),

    customerDetailOrders:
        document.getElementById('customerDetailOrders'),

    customerCommunicationActions:
        document.getElementById(
            'customerCommunicationActions'
        ),

    closeCustomerDetailButton:
        document.getElementById(
            'closeCustomerDetailButton'
        ),

    refreshButton:
        document.getElementById('refreshOrdersButton'),

    message:
        document.getElementById('adminMessage'),

    loading:
        document.getElementById('adminOrdersLoading'),

    empty:
        document.getElementById('adminOrdersEmpty'),

    ordersList:
        document.getElementById('adminOrdersList')
};

function showMessage(message) {
    elements.message.textContent = message;
    elements.message.hidden = false;
}

function clearMessage() {
    elements.message.textContent = '';
    elements.message.hidden = true;
}

function setLoading(loading) {
    elements.loading.hidden = !loading;
    elements.refreshButton.disabled = loading;
}

function formatCurrency(value) {
    const amount = Number(value || 0);

    return amount.toLocaleString(
        'pt-BR',
        {
            style: 'currency',
            currency: 'BRL'
        }
    );
}

function formatDate(value) {
    if (!value) {
        return 'Data não informada';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'Data inválida';
    }

    return date.toLocaleString(
        'pt-BR',
        {
            dateStyle: 'short',
            timeStyle: 'short'
        }
    );
}

function getCustomerName(order) {
    return order?.customer?.name ||
        'Cliente não informado';
}

function getPaymentLabel(order) {
    const status =
        order?.payment?.status || 'pending';

    switch (status) {
        case 'confirmed':
            return 'Confirmado';

        case 'cancelled':
        case 'rejected':
            return 'Cancelado';

        case 'pending':
        default:
            return 'Aguardando';
    }
}

function getPaymentClass(order) {
    const status =
        order?.payment?.status || 'pending';

    return `payment-${status}`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getNextLogisticsStatus(order) {
    const currentStatus =
        order?.logistics?.status || 'new';

    const currentIndex =
        LOGISTICS_FLOW.indexOf(currentStatus);

    if (currentIndex === -1) {
        return null;
    }

    return LOGISTICS_FLOW[currentIndex + 1] || null;
}

function formatCustomerPhone(phone) {
    const digits = String(phone || '')
        .replace(/\D/g, '');

    if (digits.length === 11) {
        return digits.replace(
            /^(\d{2})(\d{5})(\d{4})$/,
            '($1) $2-$3'
        );
    }

    if (digits.length === 10) {
        return digits.replace(
            /^(\d{2})(\d{4})(\d{4})$/,
            '($1) $2-$3'
        );
    }

    return String(phone || '').trim() ||
        'Telefone não informado';
}

function createCustomerCard(customer, orders) {
    const card =
        document.createElement('article');

    card.className =
        'admin-customer-card';

    const customerName =
        escapeHtml(
            customer.name ||
            'Cliente não informado'
        );

    const customerEmail =
        escapeHtml(
            customer.email ||
            'E-mail não informado'
        );

    const customerPhone =
        escapeHtml(
            formatCustomerPhone(
                customer.phone
            )
        );

    const ordersCount =
        Number(customer.ordersCount || 0);

    const totalSpent =
        formatCurrency(
            customer.totalSpent
        );

    const lastOrderId =
        escapeHtml(
            customer.lastOrderId ||
            '—'
        );

    const lastOrderAt =
        formatDate(
            customer.lastOrderAt
        );

    card.innerHTML = `
        <div class="admin-customer-card-header">

            <div>
                <h3 class="admin-customer-name">
                    ${customerName}
                </h3>

                <p class="admin-customer-email">
                    ${customerEmail}
                </p>
            </div>

            <span class="admin-customer-orders">
                ${ordersCount}
                ${ordersCount === 1 ? 'pedido' : 'pedidos'}
            </span>

        </div>

        <div class="admin-customer-card-body">

            <div class="admin-customer-data">
                <span>Telefone</span>
                <strong>
                    ${customerPhone}
                </strong>
            </div>

            <div class="admin-customer-data">
                <span>Total comprado</span>
                <strong>
                    ${totalSpent}
                </strong>
            </div>

            <div class="admin-customer-data">
                <span>Último pedido</span>
                <strong>
                    ${lastOrderId}
                </strong>
            </div>

            <div class="admin-customer-data">
                <span>Data do último pedido</span>
                <strong>
                    ${lastOrderAt}
                </strong>
            </div>

        </div>
    `;

    card.setAttribute(
        'role',
        'button'
    );

    card.setAttribute(
        'tabindex',
        '0'
    );

    const openDetail = () => {
        openCustomerDetail(
            customer,
            orders
        );
    };

    card.addEventListener(
        'click',
        openDetail
    );

    card.addEventListener(
        'keydown',
        event => {

            if (
                event.key === 'Enter' ||
                event.key === ' '
            ) {
                event.preventDefault();
                openDetail();
            }
        }
    );

    return card;
}

function renderCustomers(orders) {
    const customers =
        buildCustomerSummaries(orders);

    elements.customersList.innerHTML = '';

    elements.customersCount.textContent =
        `${customers.length} ${
            customers.length === 1
                ? 'cliente'
                : 'clientes'
        }`;

    elements.customersEmpty.hidden =
        customers.length !== 0;

    if (!customers.length) {
        return;
    }

    const fragment =
        document.createDocumentFragment();

    customers.forEach(customer => {
        fragment.appendChild(
            createCustomerCard(
                customer,
                orders
            )
        );
    });

    elements.customersList.appendChild(
        fragment
    );
}
let selectedCustomerDetail = null;
let selectedCustomerOrder = null;


function formatCustomerMoney(value) {

    const numericValue =
        Number(value || 0);

    return numericValue.toLocaleString(
        'pt-BR',
        {
            style: 'currency',
            currency: 'BRL'
        }
    );
}


function formatCustomerOrderDate(value) {

    if (!value) {
        return 'Data não informada';
    }

    const date =
        new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'Data inválida';
    }

    return date.toLocaleDateString(
        'pt-BR',
        {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }
    );
}


function renderCustomerOrderHistory() {

    const container =
        elements.customerDetailOrders;

    container.innerHTML = '';

    const orders =
        selectedCustomerDetail?.orders || [];

    if (!orders.length) {

        container.innerHTML = `
            <div class="admin-empty">
                <strong>Nenhum pedido encontrado.</strong>
            </div>
        `;

        return;
    }

    orders.forEach(order => {

        const item =
            document.createElement('button');

        item.type = 'button';

        item.className =
            'admin-customer-history-item';

        if (
            selectedCustomerOrder &&
            selectedCustomerOrder.id === order.id
        ) {
            item.classList.add('is-selected');
        }

        item.innerHTML = `
            <span class="admin-customer-history-order">
                <strong>
                    ${escapeHtml(
                        order.id || 'Pedido sem identificação'
                    )}
                </strong>

                <span>
                    ${formatCustomerOrderDate(
                        order.createdAt
                    )}
                </span>
            </span>

            <span class="admin-customer-history-total">
                ${formatCustomerMoney(order.total)}
            </span>

            <span class="admin-customer-history-status">
                ${escapeHtml(
                    order.logisticsStatus || 'new'
                )}
            </span>
        `;

        item.addEventListener(
            'click',
            () => {

                selectedCustomerOrder =
                    order;

                renderCustomerOrderHistory();

                renderCustomerCommunication();
            }
        );

        container.appendChild(item);
    });
}


function renderCustomerCommunication() {

    const container =
        elements.customerCommunicationActions;

    container.innerHTML = '';

    if (!selectedCustomerDetail) {
        return;
    }

    if (!selectedCustomerOrder) {

        container.innerHTML = `
            <span class="admin-section-count">
                Selecione um pedido
            </span>
        `;

        return;
    }

    const whatsappButton =
        document.createElement('button');

    whatsappButton.type = 'button';

    whatsappButton.className =
        'admin-communication-button';

    whatsappButton.textContent =
        'WhatsApp';


    const emailButton =
        document.createElement('button');

    emailButton.type = 'button';

    emailButton.className =
        'admin-communication-button secondary';

    emailButton.textContent =
        'E-mail';


    container.append(
        whatsappButton,
        emailButton
    );
}


function openCustomerDetail(
    customer,
    orders
) {

    const detail =
        getCustomerDetail(
            customer,
            orders
        );

    if (!detail) {
        return;
    }

    selectedCustomerDetail =
        detail;

    selectedCustomerOrder =
        detail.lastOrder || null;

    elements.customerDetailName.textContent =
        detail.name;

    const contactParts = [];

    if (detail.email) {
        contactParts.push(detail.email);
    }

    if (detail.phone) {
        contactParts.push(
            formatCustomerPhone(detail.phone)
        );
    }

    elements.customerDetailContact.textContent =
        contactParts.length
            ? contactParts.join(' • ')
            : 'Contato não informado';

    elements.customerDetailOrdersCount.textContent =
        String(detail.ordersCount);

    elements.customerDetailTotalSpent.textContent =
        formatCustomerMoney(detail.totalSpent);

    elements.customerDetailLastOrder.textContent =
        detail.lastOrder?.id || '—';

    renderCustomerOrderHistory();

    renderCustomerCommunication();

    elements.customerDetail.hidden = false;

    elements.customerDetail.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}


function closeCustomerDetail() {

    selectedCustomerDetail = null;
    selectedCustomerOrder = null;

    elements.customerDetail.hidden = true;

    elements.customerDetailOrders.innerHTML = '';
    elements.customerCommunicationActions.innerHTML = '';
}

function createOrderCard(order) {
    const card =
        document.createElement('article');

    card.className = 'admin-order-card';

    const orderId =
        order?.id ||
        order?.orderId ||
        '';

    const safeOrderId =
        escapeHtml(orderId);

    const status =
        order?.status || 'new';

    const logisticsStatus =
        order?.logistics?.status || 'new';

    const paymentStatus =
        order?.payment?.status || 'pending';

    const customerName =
        escapeHtml(
            getCustomerName(order)
        );

    const paymentLabel =
        getPaymentLabel(order);

    const logisticsLabel =
        getLogisticsStatusLabel(
            logisticsStatus
        );

    let actionHtml = '';

    if (paymentStatus === 'pending') {

        actionHtml = `
            <button
                class="admin-action-button primary"
                type="button"
                data-action="confirm-payment"
                data-order-id="${safeOrderId}"
            >
                Confirmar pagamento PIX
            </button>
        `;

    } else if (paymentStatus === 'confirmed') {

        const nextStatus =
            getNextLogisticsStatus(order);

        if (nextStatus) {

            const nextLabel =
                getLogisticsStatusLabel(
                    nextStatus
                );

            actionHtml = `
                <button
                    class="admin-action-button primary"
                    type="button"
                    data-action="advance-logistics"
                    data-order-id="${safeOrderId}"
                >
                    Avançar: ${escapeHtml(nextLabel)}
                </button>
            `;
        }
    }

    card.innerHTML = `
        <div class="admin-order-card-header">

            <div>
                <h3 class="admin-order-id">
                    ${safeOrderId}
                </h3>

                <div class="admin-order-date">
                    ${formatDate(order?.createdAt)}
                </div>
            </div>

            <span class="admin-order-status">
                ${escapeHtml(
                    getOrderStatusLabel(status)
                )}
            </span>

        </div>

        <div class="admin-order-card-body">

            <div class="admin-order-data">
                <span>Cliente</span>
                <strong>
                    ${customerName}
                </strong>
            </div>

            <div class="admin-order-data">
                <span>Pagamento</span>
                <strong class="${escapeHtml(
                    getPaymentClass(order)
                )}">
                    ${escapeHtml(paymentLabel)}
                </strong>
            </div>

            <div class="admin-order-data">
                <span>LogÃ­stica</span>
                <strong>
                    ${escapeHtml(logisticsLabel)}
                </strong>
            </div>

            <div class="admin-order-data">
                <span>Total</span>
                <strong>
                    ${formatCurrency(order?.total)}
                </strong>
            </div>

        </div>

        <div class="admin-order-card-footer">

            ${actionHtml}

        </div>
    `;

    return card;
}

function renderOrders(orders) {
    elements.ordersList.innerHTML = '';

    elements.empty.hidden =
        orders.length !== 0;

    if (!orders.length) {
        return;
    }

    const sortedOrders =
        [...orders].sort(
            (a, b) => {

                const dateA =
                    new Date(
                        a?.createdAt || 0
                    ).getTime();

                const dateB =
                    new Date(
                        b?.createdAt || 0
                    ).getTime();

                return dateB - dateA;
            }
        );

    const fragment =
        document.createDocumentFragment();

    sortedOrders.forEach(order => {
        fragment.appendChild(
            createOrderCard(order)
        );
    });

    elements.ordersList.appendChild(
        fragment
    );
}

function renderSummary(orders) {

    const pendingPayments =
        orders.filter(order =>
            (order?.payment?.status || 'pending') ===
            'pending'
        );

    const activeOrders =
        orders.filter(order => {

            const logisticsStatus =
                order?.logistics?.status || 'new';

            return logisticsStatus !== 'delivered';
        });

    elements.ordersCount.textContent =
        orders.length;

    elements.pendingPaymentsCount.textContent =
        pendingPayments.length;

    elements.activeOrdersCount.textContent =
        activeOrders.length;
}

async function loadOrders() {

    clearMessage();
    setLoading(true);

    try {

        const orders =
            await getAllOrders();

        renderSummary(orders);
        renderCustomers(orders);
        renderOrders(orders);

    } catch (error) {

        console.error(
            '[ADMIN] Erro ao carregar pedidos:',
            error
        );

        showMessage(
            'NÃ£o foi possÃ­vel carregar os pedidos.'
        );

        elements.ordersList.innerHTML = '';
        elements.empty.hidden = false;

    } finally {

        setLoading(false);
    }
}

async function handleConfirmPayment(button) {

    const orderId =
        button.dataset.orderId;

    if (!orderId) {
        showMessage(
            'Pedido sem identificação.'
        );

        return;
    }

    const confirmed =
        window.confirm(
            `Confirmar o pagamento PIX do pedido ${orderId}?`
        );

    if (!confirmed) {
        return;
    }

    button.disabled = true;
    button.textContent =
        'Confirmando...';

    try {

        await confirmPayment(orderId);

        showMessage(
            `Pagamento do pedido ${orderId} confirmado com sucesso.`
        );

        await loadOrders();

    } catch (error) {

        console.error(
            '[ADMIN] Erro ao confirmar pagamento:',
            error
        );

        showMessage(
            error?.message ||
            'NÃ£o foi possÃ­vel confirmar o pagamento.'
        );

        button.disabled = false;
        button.textContent =
            'Confirmar pagamento PIX';
    }
}

async function handleAdvanceLogistics(button) {

    const orderId =
        button.dataset.orderId;

    if (!orderId) {
        showMessage(
            'Pedido sem identificação.'
        );

        return;
    }

    const confirmed =
        window.confirm(
            `Avançar a etapa logÃ­stica do pedido ${orderId}?`
        );

    if (!confirmed) {
        return;
    }

    button.disabled = true;
    button.textContent =
        'Atualizando...';

    try {

        await advanceLogistics(orderId);

        showMessage(
            `Etapa logÃ­stica do pedido ${orderId} atualizada com sucesso.`
        );

        await loadOrders();

    } catch (error) {

        console.error(
            '[ADMIN] Erro ao avanÃ§ar logÃ­stica:',
            error
        );

        showMessage(
            error?.message ||
            'NÃ£o foi possÃ­vel atualizar a etapa logÃ­stica.'
        );

        button.disabled = false;
        button.textContent =
            'Avançar etapa';
    }
}

elements.ordersList.addEventListener(
    'click',
    event => {

        const paymentButton =
            event.target.closest(
                '[data-action="confirm-payment"]'
            );

        if (paymentButton) {
            handleConfirmPayment(paymentButton);
            return;
        }

        const logisticsButton =
            event.target.closest(
                '[data-action="advance-logistics"]'
            );

        if (logisticsButton) {
            handleAdvanceLogistics(logisticsButton);
        }
    }
);

elements.refreshButton.addEventListener(
    'click',
    loadOrders
);

elements.logoutButton.addEventListener(
    'click',
    async () => {

        try {

            await logoutAdmin();

            window.location.replace(
                './admin-login.html'
            );

        } catch (error) {

            console.error(
                '[ADMIN AUTH] Erro ao sair:',
                error
            );

            showMessage(
                'NÃ£o foi possÃ­vel sair da conta.'
            );
        }
    }
);

observeAdminAuth(user => {

    if (!user) {

        window.location.replace(
            './admin-login.html'
        );

        return;
    }

    elements.userEmail.textContent =
        user.email || '';

    loadOrders();
});





