'use strict';

import {
    listInventory,
    getInventoryItem,
    updateInventory,
    listInventoryMovements
} from './inventory-repository.js';

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function statusLabel(status) {
    const labels = {
        OK: 'Estoque normal',
        BAIXO: 'Estoque baixo',
        ZERADO: 'Sem estoque'
    };

    return labels[status] || status;
}

export async function loadInventory() {
    const container =
        document.querySelector('#inventoryList') ||
        document.querySelector(
            "[data-module='inventory']"
        );

    if (!container) {
        console.warn(
            '[ADMIN] Container de estoque não encontrado.'
        );

        return [];
    }

    try {
        const items =
            await listInventory();

        container.innerHTML = items.length
            ? items.map(item => `
                <article
                    class="admin-inventory-item"
                    data-id="${escapeHtml(item.id)}"
                >
                    <div>
                        <strong>
                            ${escapeHtml(item.name)}
                        </strong>

                        <small>
                            SKU: ${escapeHtml(item.sku)}
                        </small>
                    </div>

                    <div>
                        <span>
                            Estoque: ${item.stock}
                        </span>

                        <span>
                            Mínimo: ${item.minimumStock}
                        </span>

                        <span
                            data-stock-status="${escapeHtml(
                                item.status
                            )}"
                        >
                            ${escapeHtml(
                                statusLabel(item.status)
                            )}
                        </span>
                    </div>
                </article>
            `).join('')
            : '<p>Nenhum produto encontrado.</p>';

        return items;
    } catch (error) {
        console.error(
            '[ADMIN] Erro ao carregar estoque:',
            error
        );

        container.innerHTML =
            `<p>Erro ao carregar estoque: ${
                escapeHtml(error.message)
            }</p>`;

        return [];
    }
}

export async function getInventory(
    productId
) {
    return getInventoryItem(productId);
}

export async function changeInventory(
    productId,
    quantity,
    type,
    reason = ''
) {
    const result =
        await updateInventory(
            productId,
            quantity,
            type,
            reason
        );

    await loadInventory();

    return result;
}

export async function getInventoryMovements(
    productId = null,
    maxResults = 100
) {
    return listInventoryMovements(
        productId,
        maxResults
    );
}

window.AdminInventory = {
    load: loadInventory,
    get: getInventory,
    change: changeInventory,
    movements: getInventoryMovements
};

document.addEventListener(
    'DOMContentLoaded',
    () => {
        loadInventory();
    }
);