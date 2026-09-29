'use strict';

import {
    getFirestore,
    collection,
    getDocs,
    addDoc,
    updateDoc,
    doc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

import { db } from './firebase-config.js';

const COLLECTION_NAME = 'coupons';

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function money(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return 'R$ 0,00';
    }

    return number.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function normalizeCoupon(id, data) {
    return {
        id,

        code:
            String(data.code || '')
                .trim()
                .toUpperCase(),

        description:
            String(data.description || '')
                .trim(),

        type:
            data.type === 'fixed'
                ? 'fixed'
                : 'percentage',

        value:
            Number(data.value) || 0,

        minimumOrder:
            Number(data.minimumOrder) || 0,

        usageLimit:
            Number(data.usageLimit) || 0,

        usageCount:
            Number(data.usageCount) || 0,

        active:
            data.active !== false,

        influencerId:
            String(data.influencerId || '')
                .trim(),

        influencerName:
            String(data.influencerName || '')
                .trim(),

        createdAt:
            data.createdAt || null
    };
}

async function listCoupons() {
    const snapshot =
        await getDocs(
            collection(
                db,
                COLLECTION_NAME
            )
        );

    return snapshot.docs.map(item =>
        normalizeCoupon(
            item.id,
            item.data()
        )
    );
}

function renderCoupons(container, coupons) {
    if (!coupons.length) {
        container.innerHTML = `
            <div class="admin-empty-state">
                <strong>Nenhum cupom cadastrado.</strong>
                <span>Crie o primeiro cupom para iniciar uma campanha.</span>
            </div>
        `;

        return;
    }

    container.innerHTML = `
        <div class="admin-table-wrapper">
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
                    ${coupons.map(coupon => `
                        <tr>
                            <td>
                                <strong>
                                    ${escapeHtml(coupon.code)}
                                </strong>
                            </td>

                            <td>
                                ${
                                    coupon.type === 'percentage'
                                        ? 'Percentual'
                                        : 'Valor fixo'
                                }
                            </td>

                            <td>
                                ${
                                    coupon.type === 'percentage'
                                        ? `${coupon.value}%`
                                        : money(coupon.value)
                                }
                            </td>

                            <td>
                                ${money(coupon.minimumOrder)}
                            </td>

                            <td>
                                ${coupon.usageCount}
                                ${
                                    coupon.usageLimit > 0
                                        ? ` / ${coupon.usageLimit}`
                                        : ' / ilimitado'
                                }
                            </td>

                            <td>
                                <span class="admin-status ${
                                    coupon.active
                                        ? 'is-success'
                                        : 'is-muted'
                                }">
                                    ${
                                        coupon.active
                                            ? 'Ativo'
                                            : 'Inativo'
                                    }
                                </span>
                            </td>

                            <td>
                                <button
                                    type="button"
                                    class="admin-action-button"
                                    data-coupon-toggle="${escapeHtml(coupon.id)}"
                                    data-active="${coupon.active}">
                                    ${
                                        coupon.active
                                            ? 'Desativar'
                                            : 'Ativar'
                                    }
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderCreateForm(container) {
    container.innerHTML = `
        <section class="admin-panel">

            <div class="admin-panel-header">
                <div>
                    <h3>Novo cupom</h3>
                    <p>
                        Crie uma campanha promocional.
                    </p>
                </div>
            </div>

            <form id="admin-coupon-form">

                <div class="admin-form-grid">

                    <label>
                        Código
                        <input
                            name="code"
                            type="text"
                            maxlength="30"
                            required
                            placeholder="EX: NEFER10">
                    </label>

                    <label>
                        Tipo
                        <select name="type">
                            <option value="percentage">
                                Percentual
                            </option>

                            <option value="fixed">
                                Valor fixo
                            </option>
                        </select>
                    </label>

                    <label>
                        Valor
                        <input
                            name="value"
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            placeholder="10">
                    </label>

                    <label>
                        Pedido mínimo
                        <input
                            name="minimumOrder"
                            type="number"
                            min="0"
                            step="0.01"
                            value="0">
                    </label>

                    <label>
                        Limite de uso
                        <input
                            name="usageLimit"
                            type="number"
                            min="0"
                            step="1"
                            value="0">
                    </label>

                    <label>
                        Influenciador
                        <input
                            name="influencerName"
                            type="text"
                            maxlength="120"
                            placeholder="Opcional">
                    </label>

                </div>

                <label>
                    Descrição
                    <textarea
                        name="description"
                        rows="3"
                        maxlength="300"
                        placeholder="Descrição da campanha"></textarea>
                </label>

                <button
                    type="submit"
                    class="admin-primary-button">
                    Criar cupom
                </button>

            </form>

        </section>
    `;
}

async function createCoupon(form) {
    const formData =
        new FormData(form);

    const code =
        String(
            formData.get('code') || ''
        )
            .trim()
            .toUpperCase();

    const type =
        String(
            formData.get('type') || 'percentage'
        );

    const value =
        Number(
            formData.get('value')
        );

    const minimumOrder =
        Number(
            formData.get('minimumOrder')
        ) || 0;

    const usageLimit =
        Number(
            formData.get('usageLimit')
        ) || 0;

    const influencerName =
        String(
            formData.get('influencerName') || ''
        ).trim();

    const description =
        String(
            formData.get('description') || ''
        ).trim();

    if (!code) {
        throw new Error(
            'Informe o código do cupom.'
        );
    }

    if (!Number.isFinite(value) || value <= 0) {
        throw new Error(
            'Informe um valor válido para o cupom.'
        );
    }

    if (
        type === 'percentage' &&
        value > 100
    ) {
        throw new Error(
            'O desconto percentual não pode ser maior que 100%.'
        );
    }

    await addDoc(
        collection(
            db,
            COLLECTION_NAME
        ),
        {
            code,
            type,
            value,
            minimumOrder,
            usageLimit,
            usageCount: 0,
            active: true,
            description,
            influencerId: '',
            influencerName,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        }
    );
}

async function toggleCoupon(
    couponId,
    active
) {
    await updateDoc(
        doc(
            db,
            COLLECTION_NAME,
            couponId
        ),
        {
            active: !active,
            updatedAt: serverTimestamp()
        }
    );
}

export async function renderCouponsModule(
    container
) {
    if (!container) {
        throw new Error(
            'Container do módulo Cupons não encontrado.'
        );
    }

    container.innerHTML = `
        <div class="admin-module">

            <header class="admin-module-header">
                <div>
                    <span class="admin-eyebrow">
                        NEFER ADMIN
                    </span>

                    <h2>Cupons</h2>

                    <p>
                        Campanhas e desempenho comercial.
                    </p>
                </div>

                <button
                    type="button"
                    id="admin-new-coupon"
                    class="admin-primary-button">
                    Novo cupom
                </button>
            </header>

            <section class="admin-panel">
                <div class="admin-panel-header">
                    <div>
                        <h3>Cupons cadastrados</h3>
                    </div>

                    <strong id="admin-coupon-count">
                        0
                    </strong>
                </div>

                <div id="admin-coupon-list">
                    Carregando...
                </div>
            </section>

            <div id="admin-coupon-form-container"></div>

        </div>
    `;

    const list =
        container.querySelector(
            '#admin-coupon-list'
        );

    const count =
        container.querySelector(
            '#admin-coupon-count'
        );

    const formContainer =
        container.querySelector(
            '#admin-coupon-form-container'
        );

    const newButton =
        container.querySelector(
            '#admin-new-coupon'
        );

    async function refresh() {
        const coupons =
            await listCoupons();

        count.textContent =
            String(coupons.length);

        renderCoupons(
            list,
            coupons
        );
    }

    newButton.addEventListener(
        'click',
        () => {
            renderCreateForm(
                formContainer
            );

            const form =
                formContainer.querySelector(
                    '#admin-coupon-form'
                );

            form.addEventListener(
                'submit',
                async event => {
                    event.preventDefault();

                    try {
                        await createCoupon(form);

                        formContainer.innerHTML = '';

                        await refresh();

                        alert(
                            'Cupom criado com sucesso.'
                        );
                    } catch (error) {
                        console.error(
                            '[COUPONS] Erro ao criar cupom:',
                            error
                        );

                        alert(
                            error.message ||
                            'Não foi possível criar o cupom.'
                        );
                    }
                }
            );
        }
    );

    list.addEventListener(
        'click',
        async event => {
            const button =
                event.target.closest(
                    '[data-coupon-toggle]'
                );

            if (!button) {
                return;
            }

            const couponId =
                button.dataset.couponToggle;

            const active =
                button.dataset.active === 'true';

            try {
                await toggleCoupon(
                    couponId,
                    active
                );

                await refresh();
            } catch (error) {
                console.error(
                    '[COUPONS] Erro ao atualizar cupom:',
                    error
                );

                alert(
                    'Não foi possível atualizar o cupom.'
                );
            }
        }
    );

    try {
        await refresh();
    } catch (error) {
        console.error(
            '[COUPONS] Erro ao carregar:',
            error
        );

        list.innerHTML = `
            <div class="admin-error-state">
                Não foi possível carregar os cupons.
            </div>
        `;
    }
}js
