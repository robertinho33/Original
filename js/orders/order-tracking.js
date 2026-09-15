'use strict';

import {
    findTrackingById
} from './order-repository.js';

import {
    getLogisticsStatusLabel
} from './logistics-status.js';

import {
    ORDER_EVENT_LABELS
} from './order-history.js';


const elements = {
    form:
        document.getElementById('trackingForm'),

    input:
        document.getElementById('trackingOrderId'),

    error:
        document.getElementById('trackingError'),

    result:
        document.getElementById('trackingResult'),

    orderId:
        document.getElementById('trackingDisplayedOrderId'),

    status:
        document.getElementById('trackingStatus'),

    payment:
        document.getElementById('trackingPayment'),

    timeline:
        document.getElementById('trackingTimeline')
};


function formatCurrency(value) {

    return Number(value || 0).toLocaleString(
        'pt-BR',
        {
            style: 'currency',
            currency: 'BRL'
        }
    );
}


function formatDate(value) {

    if (!value) {
        return '';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return date.toLocaleString(
        'pt-BR'
    );
}


function showError(message) {

    if (elements.error) {
        elements.error.textContent = message;

        elements.error.classList.add(
            'visible'
        );
    }

    if (elements.result) {
        elements.result.classList.remove(
            'visible'
        );
    }
}


function renderOrder(order) {

    if (!order) {
        showError(
            'Pedido não encontrado. Confira o número informado.'
        );

        return;
    }

    const logisticsStatus =
        order.logisticsStatus || 'new';

    if (elements.orderId) {
        elements.orderId.textContent =
            order.id || '—';
    }

    if (elements.status) {
        elements.status.textContent =
            getLogisticsStatusLabel(
                logisticsStatus
            );
    }

    const paymentStatus =
        order.paymentStatus === 'pending'
            ? 'Aguardando pagamento'
            : order.paymentStatus === 'confirmed'
                ? 'Pagamento confirmado'
                : order.paymentStatus === 'cancelled'
                    ? 'Pagamento cancelado'
                    : order.paymentStatus === 'rejected'
                        ? 'Pagamento recusado'
                        : 'Não informado';

    if (elements.payment) {
        elements.payment.textContent =
            `Pagamento: ${paymentStatus} · Total: ${formatCurrency(order.total)}`;
    }

    if (elements.timeline) {

        elements.timeline.innerHTML = '';

        const history =
            Array.isArray(order.history)
                ? order.history
                : [];

        if (!history.length) {

            elements.timeline.innerHTML =
                '<p>Nenhum evento registrado.</p>';

        } else {

            history.forEach(event => {

                const item =
                    document.createElement('div');

                item.className =
                    'tracking-event active';

                const label =
                    ORDER_EVENT_LABELS[event.type] ||
                    event.label ||
                    'Evento do pedido';

                item.innerHTML = `
                    <div class="tracking-event-label">
                        ${label}
                    </div>

                    <div class="tracking-event-date">
                        ${formatDate(event.createdAt)}
                    </div>
                `;

                elements.timeline.appendChild(
                    item
                );
            });
        }
    }

    if (elements.error) {
        elements.error.classList.remove(
            'visible'
        );
    }

    if (elements.result) {
        elements.result.classList.add(
            'visible'
        );
    }
}


async function loadTracking(orderId) {

    if (!orderId) {
        showError(
            'Informe o número do pedido.'
        );

        return;
    }

    try {

        const order =
            await findTrackingById(orderId);

        if (!order) {

            showError(
                'Pedido não encontrado. Confira o número informado.'
            );

            return;
        }

        renderOrder(order);

    } catch (error) {

        console.error(
            '[TRACKING] Erro ao consultar pedido:',
            error
        );

        showError(
            'Não foi possível consultar o pedido. Tente novamente.'
        );
    }
}


if (elements.form) {

    elements.form.addEventListener(
        'submit',
        event => {

            event.preventDefault();

            const orderId =
                elements.input?.value.trim() || '';

            loadTracking(orderId);
        }
    );
}


const params =
    new URLSearchParams(
        window.location.search
    );

const initialOrderId =
    params.get('pedido');

if (initialOrderId) {

    if (elements.input) {
        elements.input.value =
            initialOrderId;
    }

    loadTracking(initialOrderId);
}
