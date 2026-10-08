'use strict';

import {
    findTrackingById,
    findTrackingByToken
} from './order-repository.js';

const elements = {
    form: document.getElementById('trackingForm'),
    input: document.getElementById('trackingOrderId'),
    error: document.getElementById('trackingError'),
    result: document.getElementById('trackingResult'),
    orderId: document.getElementById('trackingDisplayedOrderId'),
    status: document.getElementById('trackingStatus'),
    payment: document.getElementById('trackingPayment'),
    shipping: document.getElementById('trackingShipping'),
    timeline: document.getElementById('trackingTimeline'),
    share: document.getElementById('trackingShare'),
    shareButton: document.getElementById('trackingShareButton'),
    shareMessage: document.getElementById('trackingShareMessage')
};

const FLOW = [
    { key: 'placed', label: 'Pedido realizado' },
    { key: 'paid', label: 'Pagamento' },
    { key: 'preparing', label: 'Em preparação' },
    { key: 'transit', label: 'A caminho' },
    { key: 'delivered', label: 'Entregue' }
];
const PAYMENT_OK = new Set(['paid', 'pago', 'confirmed', 'confirmado', 'approved', 'aprovado']);
const PREPARING = new Set(['preparing', 'processing', 'packed', 'em preparação', 'preparando']);
const TRANSIT = new Set(['shipped', 'in_transit', 'out_for_delivery', 'a caminho', 'em trânsito', 'saiu para entrega']);
const CANCELLED = new Set(['cancelled', 'canceled', 'cancelado', 'cancelada']);
const REFUNDED = new Set(['refunded', 'refund', 'reembolsado', 'reembolsada', 'estornado']);

function normalize(value) {
    return String(value ?? '').trim().toLowerCase();
}

function formatDate(value) {
    if (!value) return '';
    const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function showError(message) {
    elements.error.textContent = message;
    elements.error.classList.add('visible');
    elements.result.classList.remove('visible');
}

function findEventDate(order, predicate) {
    return (order.history || []).find(predicate)?.createdAt || null;
}

function stepDate(order, key) {
    if (key === 'placed') return order.createdAt;
    if (key === 'paid') {
        return order.paymentConfirmedAt ||
            findEventDate(order, event =>
                normalize(event.type).includes('payment_confirmed') ||
                PAYMENT_OK.has(normalize(event.paymentStatus))
            );
    }
    if (key === 'preparing') {
        return findEventDate(order, event =>
            ['preparing', 'packed'].includes(normalize(event.type)) ||
            PREPARING.has(normalize(event.status))
        );
    }
    if (key === 'transit') {
        return order.postedAt ||
            findEventDate(order, event =>
                ['shipped', 'in_transit', 'out_for_delivery'].includes(normalize(event.type)) ||
                TRANSIT.has(normalize(event.status))
            );
    }
    return order.deliveredAt ||
        findEventDate(order, event =>
            normalize(event.type) === 'delivered' ||
            normalize(event.status) === 'delivered'
        );
}

function currentStep(order) {
    const orderStatus = normalize(order.status);
    const logisticsStatus = normalize(order.logisticsStatus);
    const paymentStatus = normalize(order.paymentStatus);
    if (logisticsStatus === 'delivered' || orderStatus === 'delivered') return 4;
    if (TRANSIT.has(logisticsStatus) || orderStatus === 'shipped') return 3;
    if (PREPARING.has(logisticsStatus) || ['processing', 'confirmed'].includes(orderStatus)) return 2;
    if (PAYMENT_OK.has(paymentStatus)) return 1;
    return 1;
}

function renderTimeline(order) {
    const active = currentStep(order);
    const paymentStatus = normalize(order.paymentStatus);
    const logisticsStatus = normalize(order.logisticsStatus);
    const cancelled = CANCELLED.has(normalize(order.status)) ||
        CANCELLED.has(paymentStatus) || CANCELLED.has(logisticsStatus);
    const refunded = REFUNDED.has(paymentStatus) || REFUNDED.has(normalize(order.status));
    elements.timeline.replaceChildren();

    FLOW.forEach((step, index) => {
        const row = document.createElement('article');
        const done = index < active ||
            (index === 1 && PAYMENT_OK.has(paymentStatus)) ||
            (index === 4 && (logisticsStatus === 'delivered' || normalize(order.status) === 'delivered'));
        row.className = 'tracking-step' + (done ? ' is-done' : index === active ? ' is-current' : '');

        const marker = document.createElement('span');
        marker.className = 'tracking-step-marker';
        marker.setAttribute('aria-hidden', 'true');
        const content = document.createElement('div');
        content.className = 'tracking-step-content';
        const heading = document.createElement('strong');
        heading.textContent = step.key === 'paid' && !PAYMENT_OK.has(paymentStatus)
            ? 'Aguardando pagamento'
            : step.label;
        const timestamp = document.createElement('span');
        const date = formatDate(stepDate(order, step.key));
        timestamp.textContent = date || (index === active && !cancelled && !refunded ? 'Etapa atual' : 'Aguardando esta etapa');
        content.append(heading, timestamp);
        row.append(marker, content);
        elements.timeline.appendChild(row);
    });

    if (cancelled || refunded) {
        const message = document.createElement('p');
        message.className = 'tracking-terminal';
        message.textContent = refunded
            ? 'Este pedido foi reembolsado. Consulte o atendimento se precisar de ajuda.'
            : 'Este pedido foi cancelado. Consulte o atendimento se precisar de ajuda.';
        elements.timeline.prepend(message);
    }
}

function renderOrder(order) {
    const current = currentStep(order);
    const paymentPending = !PAYMENT_OK.has(normalize(order.paymentStatus));
    elements.orderId.textContent = order.orderNumber || order.id || '—';
    elements.status.textContent = CANCELLED.has(normalize(order.status))
        ? 'Pedido cancelado'
        : REFUNDED.has(normalize(order.paymentStatus))
            ? 'Pedido reembolsado'
            : paymentPending && current === 1
                ? 'Aguardando pagamento'
                : FLOW[current].label;
    elements.payment.textContent = !paymentPending
        ? 'Pagamento confirmado'
        : 'Aguardando pagamento';

    const shippingDetails = [];
    if (order.carrier) shippingDetails.push('Transportadora: ' + order.carrier);
    if (order.trackingCode) shippingDetails.push('Código de rastreio: ' + order.trackingCode);
    if (order.estimatedDelivery) shippingDetails.push('Previsão: ' + (formatDate(order.estimatedDelivery) || order.estimatedDelivery));
    elements.shipping.textContent = shippingDetails.join(' · ') ||
        (currentStep(order) >= 3 ? 'Os dados de rastreio ainda não foram informados.' : 'As informações de envio aparecerão após a postagem.');

    renderTimeline(order);
    elements.share.hidden = !order.trackingToken;
    if (order.trackingToken) {
        elements.share.dataset.url = window.location.origin + window.location.pathname + '#token=' + encodeURIComponent(order.trackingToken);
    }
    elements.error.classList.remove('visible');
    elements.result.classList.add('visible');
}

async function loadTracking(orderIdOrToken, isToken = false) {
    elements.error.classList.remove('visible');
    elements.result.classList.remove('visible');
    try {
        const order = isToken
            ? await findTrackingByToken(orderIdOrToken)
            : await findTrackingById(orderIdOrToken);
        if (!order) {
            showError('Pedido não encontrado. Use o link privado recebido na confirmação ou consulte no dispositivo da compra.');
            return;
        }
        renderOrder(order);
    } catch (error) {
        console.error('[TRACKING] Falha na consulta:', error);
        showError('Não foi possível consultar o pedido. Tente novamente.');
    }
}

elements.form?.addEventListener('submit', event => {
    event.preventDefault();
    const orderId = elements.input.value.trim().toUpperCase();
    if (!orderId) {
        showError('Informe o número do pedido.');
        return;
    }
    loadTracking(orderId);
});

elements.shareButton?.addEventListener('click', async () => {
    const url = elements.share?.dataset.url;
    if (!url) return;
    try {
        await navigator.clipboard.writeText(url);
        elements.shareMessage.textContent = 'Link privado copiado. Compartilhe apenas com quem pode acompanhar seu pedido.';
    } catch {
        elements.shareMessage.textContent = url;
    }
});

const params = new URLSearchParams(window.location.search);
const token = new URLSearchParams(window.location.hash.slice(1)).get('token') || params.get('token');
if (params.has('token')) { params.delete('token'); history.replaceState(null, '', window.location.pathname + (params.size ? '?' + params : '') + '#token=' + encodeURIComponent(token)); }
const initialOrder = params.get('pedido');
if (initialOrder && !token) {
    elements.input.value = initialOrder;
    loadTracking(initialOrder);
}
if (token) {
    elements.input.closest('form')?.classList.add('tracking-token-mode');
    loadTracking(token, true);
}
