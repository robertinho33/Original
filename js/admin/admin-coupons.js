"use strict";

/*
 * NEFER ADMIN — Módulo de Cupons
 *
 * Fluxo:
 *
 * Tela
 *   ↓
 * AdminAPI
 *   ↓
 * /api/admin/coupons
 *   ↓
 * Admin Controller
 *   ↓
 * Admin Service
 *   ↓
 * Firebase Admin / Firestore
 *
 * IMPORTANTE:
 * Este módulo NÃO acessa o Firebase diretamente pelo navegador.
 */

const COLLECTION_NAME = "coupons";

function getAdminAPI() {
    const api = window.AdminAPI || window.adminApi;

    if (!api) {
        throw new Error(
            "AdminAPI não está disponível."
        );
    }

    return api;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function money(value) {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : 0;
}

function formatCurrency(value) {
    return money(value).toLocaleString(
        "pt-BR",
        {
            style: "currency",
            currency: "BRL"
        }
    );
}

function formatDate(value) {
    if (!value) {
        return "—";
    }

    if (
        typeof value === "object" &&
        typeof value.toDate === "function"
    ) {
        const date = value.toDate();

        return date.toLocaleDateString(
            "pt-BR"
        );
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString(
        "pt-BR"
    );
}

/* =========================================================
   NORMALIZAÇÃO
   ========================================================= */

function normalizeCoupon(data = {}) {
    return {
        id:
            String(
                data.id ||
                ""
            ),

        code:
            String(
                data.code ||
                ""
            )
                .trim()
                .toUpperCase(),

        description:
            String(
                data.description ||
                ""
            ).trim(),

        type:
            data.discountType === "fixed" ||
            data.type === "fixed"
                ? "fixed"
                : "percentage",

        value:
            money(
                data.discount ??
                data.value
            ),

        minimumOrder:
            money(
                data.minimumOrder ??
                data.minimumOrderValue
            ),

        usageLimit:
            Number(
                data.usageLimit || 0
            ),

        usageCount:
            Number(
                data.uses ??
                data.usageCount ??
                0
            ),

        active:
            data.active !== false,

        influencerId:
            String(
                data.influencerId ||
                ""
            ).trim(),

        influencerName:
            String(
                data.affiliateName ??
                data.influencerName ??
                ""
            ).trim(),

        commission:
            money(
                data.commission
            ),

        expiresAt:
            data.expiresAt ||
            null,

        createdAt:
            data.createdAt ||
            null,

        updatedAt:
            data.updatedAt ||
            null
    };
}

function couponStatus(coupon) {
    if (!coupon.active) {
        return "Inativo";
    }

    if (
        coupon.usageLimit > 0 &&
        coupon.usageCount >= coupon.usageLimit
    ) {
        return "Esgotado";
    }

    return "Ativo";
}

function couponStatusClass(coupon) {
    if (!coupon.active) {
        return "inactive";
    }

    if (
        coupon.usageLimit > 0 &&
        coupon.usageCount >= coupon.usageLimit
    ) {
        return "warning";
    }

    return "active";
}

function couponValue(coupon) {
    if (coupon.type === "fixed") {
        return formatCurrency(
            coupon.value
        );
    }

    return `${coupon.value}%`;
}

function showMessage(
    container,
    message,
    type = "info"
) {
    if (!container) {
        return;
    }

    const old =
        container.querySelector(
            ".nefer-coupon-message"
        );

    old?.remove();

    const element =
        document.createElement(
            "div"
        );

    element.className =
        `nefer-coupon-message ${type}`;

    element.textContent =
        message;

    container.prepend(
        element
    );

    window.setTimeout(
        () => {
            element.remove();
        },
        4000
    );
}

/* =========================================================
   API
   ========================================================= */

async function listCoupons() {
    const api =
        getAdminAPI();

    const response =
        await api.coupons();

    if (
        response &&
        response.success &&
        Array.isArray(response.data)
    ) {
        return response.data.map(
            normalizeCoupon
        );
    }

    if (Array.isArray(response)) {
        return response.map(
            normalizeCoupon
        );
    }

    return [];
}

async function createCoupon(data) {
    const api =
        getAdminAPI();

    if (
        typeof api.createCoupon !==
        "function"
    ) {
        throw new Error(
            "AdminAPI.createCoupon não está disponível."
        );
    }

    return api.createCoupon(
        data
    );
}

async function updateCoupon(
    id,
    data
) {
    const api =
        getAdminAPI();

    if (
        typeof api.updateCoupon !==
        "function"
    ) {
        throw new Error(
            "AdminAPI.updateCoupon não está disponível."
        );
    }

    return api.updateCoupon(
        id,
        data
    );
}

async function deleteCoupon(id) {
    const api =
        getAdminAPI();

    if (
        typeof api.deleteCoupon !==
        "function"
    ) {
        throw new Error(
            "AdminAPI.deleteCoupon não está disponível."
        );
    }

    return api.deleteCoupon(
        id
    );
}

/* =========================================================
   VALIDAÇÃO
   ========================================================= */

function validateCoupon(data) {
    const code =
        String(
            data.code || ""
        )
            .trim()
            .toUpperCase();

    if (!code) {
        throw new Error(
            "Informe o código do cupom."
        );
    }

    if (
        !/^[A-Z0-9_-]+$/.test(code)
    ) {
        throw new Error(
            "O código deve conter apenas letras, números, _ ou -."
        );
    }

    const type =
        data.type === "fixed"
            ? "fixed"
            : "percentage";

    const value =
        Number(
            data.value
        );

    if (
        !Number.isFinite(value) ||
        value <= 0
    ) {
        throw new Error(
            "Informe um valor válido para o desconto."
        );
    }

    if (
        type === "percentage" &&
        value > 100
    ) {
        throw new Error(
            "O desconto percentual não pode ser maior que 100%."
        );
    }

    const minimumOrder =
        Number(
            data.minimumOrder
        ) || 0;

    if (
        !Number.isFinite(
            minimumOrder
        ) ||
        minimumOrder < 0
    ) {
        throw new Error(
            "O pedido mínimo não pode ser negativo."
        );
    }

    const usageLimit =
        Number(
            data.usageLimit
        ) || 0;

    if (
        !Number.isFinite(
            usageLimit
        ) ||
        usageLimit < 0
    ) {
        throw new Error(
            "O limite de uso não pode ser negativo."
        );
    }

    return {
        code,

        type,

        value,

        minimumOrder,

        usageLimit,

        active:
            data.active !== false,

        influencerId:
            String(
                data.influencerId ||
                ""
            ).trim(),

        influencerName:
            String(
                data.influencerName ||
                ""
            ).trim(),

        description:
            String(
                data.description ||
                ""
            ).trim()
    };
}

/* =========================================================
   ESTATÍSTICAS
   ========================================================= */

function renderStats(
    container,
    coupons
) {
    const total =
        coupons.length;

    const active =
        coupons.filter(
            coupon =>
                coupon.active
        ).length;

    const inactive =
        total - active;

    const used =
        coupons.reduce(
            (
                totalUsage,
                coupon
            ) =>
                totalUsage +
                Number(
                    coupon.usageCount ||
                    0
                ),
            0
        );

    container.innerHTML = `
        <div class="admin-metrics-grid">

            <div class="admin-metric-card">
                <span class="admin-metric-label">
                    Cupons cadastrados
                </span>

                <strong class="admin-metric-value">
                    ${total}
                </strong>
            </div>

            <div class="admin-metric-card">
                <span class="admin-metric-label">
                    Cupons ativos
                </span>

                <strong class="admin-metric-value">
                    ${active}
                </strong>
            </div>

            <div class="admin-metric-card">
                <span class="admin-metric-label">
                    Cupons inativos
                </span>

                <strong class="admin-metric-value">
                    ${inactive}
                </strong>
            </div>

            <div class="admin-metric-card">
                <span class="admin-metric-label">
                    Utilizações
                </span>

                <strong class="admin-metric-value">
                    ${used}
                </strong>
            </div>

        </div>
    `;
}

/* =========================================================
   TABELA
   ========================================================= */

function renderTable(
    container,
    coupons,
    onEdit,
    onToggle,
    onDelete
) {
    const panel =
        document.createElement(
            "div"
        );

    panel.className =
        "admin-panel";

    panel.innerHTML = `
        <div class="admin-panel-header">

            <div>
                <h3>
                    Campanhas e cupons
                </h3>

                <p>
                    Gerencie os cupons promocionais da NEFER.
                </p>
            </div>

            <button
                type="button"
                class="admin-primary-button"
                data-action="new-coupon"
            >
                Novo cupom
            </button>

        </div>
    `;

    panel
        .querySelector(
            "[data-action='new-coupon']"
        )
        ?.addEventListener(
            "click",
            () => onEdit(null)
        );

    if (!coupons.length) {
        const empty =
            document.createElement(
                "div"
            );

        empty.className =
            "admin-empty";

        empty.innerHTML = `
            <strong>
                Nenhum cupom cadastrado.
            </strong>

            <p>
                Crie o primeiro cupom para começar.
            </p>
        `;

        panel.appendChild(
            empty
        );

        container.appendChild(
            panel
        );

        return;
    }

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "admin-table-wrapper";

    const table =
        document.createElement(
            "table"
        );

    table.className =
        "admin-table";

    table.innerHTML = `
        <thead>
            <tr>
                <th>Código</th>
                <th>Tipo</th>
                <th>Valor</th>
                <th>Mínimo</th>
                <th>Uso</th>
                <th>Status</th>
                <th>Influenciador</th>
                <th>Atualizado</th>
                <th>Ações</th>
            </tr>
        </thead>

        <tbody></tbody>
    `;

    const tbody =
        table.querySelector(
            "tbody"
        );

    coupons.forEach(
        coupon => {
            const row =
                document.createElement(
                    "tr"
                );

            const status =
                couponStatus(
                    coupon
                );

            const statusClass =
                couponStatusClass(
                    coupon
                );

            const usage =
                coupon.usageLimit > 0
                    ? `${coupon.usageCount} / ${coupon.usageLimit}`
                    : `${coupon.usageCount} / ilimitado`;

            row.innerHTML = `
                <td>
                    <strong>
                        ${escapeHtml(
                            coupon.code
                        )}
                    </strong>

                    ${
                        coupon.description
                            ? `
                                <small>
                                    ${escapeHtml(
                                        coupon.description
                                    )}
                                </small>
                            `
                            : ""
                    }
                </td>

                <td>
                    ${
                        coupon.type === "fixed"
                            ? "Valor fixo"
                            : "Percentual"
                    }
                </td>

                <td>
                    <strong>
                        ${escapeHtml(
                            couponValue(
                                coupon
                            )
                        )}
                    </strong>
                </td>

                <td>
                    ${escapeHtml(
                        formatCurrency(
                            coupon.minimumOrder
                        )
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        usage
                    )}
                </td>

                <td>
                    <span
                        class="admin-status ${statusClass}"
                    >
                        ${escapeHtml(
                            status
                        )}
                    </span>
                </td>

                <td>
                    ${
                        coupon.influencerName
                            ? escapeHtml(
                                coupon.influencerName
                            )
                            : "—"
                    }
                </td>

                <td>
                    ${escapeHtml(
                        formatDate(
                            coupon.updatedAt ||
                            coupon.createdAt
                        )
                    )}
                </td>

                <td>
                    <div class="admin-actions">

                        <button
                            type="button"
                            class="admin-secondary-button"
                            data-action="edit"
                        >
                            Editar
                        </button>

                        <button
                            type="button"
                            class="admin-secondary-button"
                            data-action="toggle"
                        >
                            ${
                                coupon.active
                                    ? "Desativar"
                                    : "Ativar"
                            }
                        </button>

                        <button
                            type="button"
                            class="admin-coupon-delete"
                            data-action="delete"
                        >
                            Excluir
                        </button>

                    </div>
                </td>
            `;

            row
                .querySelector(
                    "[data-action='edit']"
                )
                ?.addEventListener(
                    "click",
                    () =>
                        onEdit(
                            coupon
                        )
                );

            row
                .querySelector(
                    "[data-action='toggle']"
                )
                ?.addEventListener(
                    "click",
                    () =>
                        onToggle(
                            coupon
                        )
                );

            row
                .querySelector(
                    "[data-action='delete']"
                )
                ?.addEventListener(
                    "click",
                    () =>
                        onDelete(
                            coupon
                        )
                );

            tbody.appendChild(
                row
            );
        }
    );

    wrapper.appendChild(
        table
    );

    panel.appendChild(
        wrapper
    );

    container.appendChild(
        panel
    );
}

/* =========================================================
   MODAL
   ========================================================= */

function createModal(
    coupon,
    onSubmit
) {
    const editing =
        Boolean(
            coupon?.id
        );

    const modal =
        document.createElement(
            "div"
        );

    modal.className =
        "admin-modal-overlay";

    modal.id =
        "nefer-coupon-modal";

    modal.innerHTML = `
        <div
            class="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="coupon-modal-title"
        >

            <div class="admin-modal-header">

                <div>
                    <h2 id="coupon-modal-title">
                        ${
                            editing
                                ? "Editar cupom"
                                : "Novo cupom"
                        }
                    </h2>

                    <p>
                        ${
                            editing
                                ? "Atualize os dados do cupom."
                                : "Cadastre uma nova campanha promocional."
                        }
                    </p>
                </div>

                <button
                    type="button"
                    class="admin-modal-close"
                    data-action="close"
                    aria-label="Fechar"
                >
                    ×
                </button>

            </div>

            <form id="nefer-coupon-form">

                <div class="admin-form-grid">

                    <label>
                        Código

                        <input
                            type="text"
                            name="code"
                            maxlength="30"
                            required
                            autocomplete="off"
                            value="${escapeHtml(
                                coupon?.code ||
                                ""
                            )}"
                        >
                    </label>

                    <label>
                        Tipo

                        <select
                            name="type"
                            required
                        >
                            <option
                                value="percentage"
                                ${
                                    coupon?.type !== "fixed"
                                        ? "selected"
                                        : ""
                                }
                            >
                                Percentual
                            </option>

                            <option
                                value="fixed"
                                ${
                                    coupon?.type === "fixed"
                                        ? "selected"
                                        : ""
                                }
                            >
                                Valor fixo
                            </option>
                        </select>
                    </label>

                    <label>
                        Valor

                        <input
                            type="number"
                            name="value"
                            min="0.01"
                            step="0.01"
                            required
                            value="${escapeHtml(
                                String(
                                    coupon?.value ??
                                    ""
                                )
                            )}"
                        >
                    </label>

                    <label>
                        Pedido mínimo

                        <input
                            type="number"
                            name="minimumOrder"
                            min="0"
                            step="0.01"
                            value="${escapeHtml(
                                String(
                                    coupon?.minimumOrder ??
                                    0
                                )
                            )}"
                        >
                    </label>

                    <label>
                        Limite de uso

                        <input
                            type="number"
                            name="usageLimit"
                            min="0"
                            step="1"
                            value="${escapeHtml(
                                String(
                                    coupon?.usageLimit ??
                                    0
                                )
                            )}"
                        >

                        <small>
                            0 = ilimitado
                        </small>
                    </label>

                    <label>
                        Status

                        <select
                            name="active"
                        >
                            <option
                                value="true"
                                ${
                                    coupon?.active !== false
                                        ? "selected"
                                        : ""
                                }
                            >
                                Ativo
                            </option>

                            <option
                                value="false"
                                ${
                                    coupon?.active === false
                                        ? "selected"
                                        : ""
                                }
                            >
                                Inativo
                            </option>
                        </select>
                    </label>

                    <label>
                        Influenciador

                        <input
                            type="text"
                            name="influencerName"
                            maxlength="120"
                            value="${escapeHtml(
                                coupon?.influencerName ||
                                ""
                            )}"
                        >
                    </label>

                    <label>
                        ID do influenciador

                        <input
                            type="text"
                            name="influencerId"
                            maxlength="120"
                            value="${escapeHtml(
                                coupon?.influencerId ||
                                ""
                            )}"
                        >
                    </label>

                </div>

                <label>
                    Descrição

                    <textarea
                        name="description"
                        rows="4"
                        maxlength="300"
                    >${escapeHtml(
                        coupon?.description ||
                        ""
                    )}</textarea>
                </label>

                ${
                    editing
                        ? `
                            <div class="admin-coupon-usage-info">
                                Utilizações atuais:
                                <strong>
                                    ${Number(
                                        coupon?.usageCount ||
                                        0
                                    )}
                                </strong>
                            </div>
                        `
                        : ""
                }

                <div class="admin-modal-footer">

                    <button
                        type="button"
                        class="admin-secondary-button"
                        data-action="cancel"
                    >
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        class="admin-primary-button"
                    >
                        ${
                            editing
                                ? "Salvar alterações"
                                : "Criar cupom"
                        }
                    </button>

                </div>

            </form>

        </div>
    `;

    document.body.appendChild(
        modal
    );

    const close =
        () => modal.remove();

    modal
        .querySelector(
            "[data-action='close']"
        )
        ?.addEventListener(
            "click",
            close
        );

    modal
        .querySelector(
            "[data-action='cancel']"
        )
        ?.addEventListener(
            "click",
            close
        );

    modal.addEventListener(
        "click",
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
            "#nefer-coupon-form"
        );

    form?.addEventListener(
        "submit",
        async event => {
            event.preventDefault();

            const formData =
                new FormData(
                    form
                );

            const data = {
                code:
                    formData.get(
                        "code"
                    ),

                type:
                    formData.get(
                        "type"
                    ),

                value:
                    Number(
                        formData.get(
                            "value"
                        )
                    ),

                minimumOrder:
                    Number(
                        formData.get(
                            "minimumOrder"
                        )
                    ) || 0,

                usageLimit:
                    Number(
                        formData.get(
                            "usageLimit"
                        )
                    ) || 0,

                active:
                    formData.get(
                        "active"
                    ) === "true",

                influencerName:
                    formData.get(
                        "influencerName"
                    ),

                influencerId:
                    formData.get(
                        "influencerId"
                    ),

                description:
                    formData.get(
                        "description"
                    )
            };

            const submitButton =
                form.querySelector(
                    "[type='submit']"
                );

            try {
                const validated =
                    validateCoupon(
                        data
                    );

                if (submitButton) {
                    submitButton.disabled =
                        true;

                    submitButton.textContent =
                        "Salvando...";
                }

                await onSubmit(
                    validated
                );

                close();
            } catch (error) {
                console.error(
                    "[NEFER COUPONS] Erro:",
                    error
                );

                window.alert(
                    error?.message ||
                    "Não foi possível salvar o cupom."
                );

                if (submitButton) {
                    submitButton.disabled =
                        false;

                    submitButton.textContent =
                        editing
                            ? "Salvar alterações"
                            : "Criar cupom";
                }
            }
        }
    );

    const codeInput =
        form?.querySelector(
            "[name='code']"
        );

    codeInput?.focus();

    return modal;
}

/* =========================================================
   MÓDULO
   ========================================================= */

export async function renderCouponsModule(
    container
) {
    if (!container) {
        throw new Error(
            "Container do módulo de cupons não encontrado."
        );
    }

    container.innerHTML = `
        <div class="nefer-coupons-module">

            <div class="admin-module-header">

                <div>
                    <span class="admin-eyebrow">
                        NEFER ADMIN
                    </span>

                    <h2>
                        Cupons
                    </h2>

                    <p>
                        Campanhas e desempenho comercial.
                    </p>
                </div>

                <button
                    type="button"
                    class="admin-secondary-button"
                    data-action="refresh"
                >
                    Atualizar
                </button>

            </div>

            <div
                class="nefer-coupon-message-area"
            ></div>

            <div
                class="nefer-coupon-stats"
            ></div>

            <div
                class="nefer-coupon-list"
            >
                <div class="admin-loading">
                    Carregando cupons...
                </div>
            </div>

        </div>
    `;

    const stats =
        container.querySelector(
            ".nefer-coupon-stats"
        );

    const list =
        container.querySelector(
            ".nefer-coupon-list"
        );

    const messageArea =
        container.querySelector(
            ".nefer-coupon-message-area"
        );

    async function refresh() {
        list.innerHTML = `
            <div class="admin-loading">
                Carregando cupons...
            </div>
        `;

        try {
            const coupons =
                await listCoupons();

            renderStats(
                stats,
                coupons
            );

            list.innerHTML = "";

            renderTable(
                list,
                coupons,
                openEditor,
                toggleStatus,
                removeCoupon
            );
        } catch (error) {
            console.error(
                "[NEFER COUPONS] Erro ao carregar:",
                error
            );

            stats.innerHTML = "";

            list.innerHTML = `
                <div class="admin-error">
                    Não foi possível carregar os cupons.
                    <br>
                    ${escapeHtml(
                        error?.message ||
                        "Erro desconhecido."
                    )}
                </div>
            `;
        }
    }

    async function openEditor(
        coupon
    ) {
        createModal(
            coupon,
            async data => {
                if (coupon?.id) {
                    await updateCoupon(
                        coupon.id,
                        data
                    );

                    showMessage(
                        messageArea,
                        "Cupom atualizado com sucesso.",
                        "success"
                    );
                } else {
                    await createCoupon(
                        data
                    );

                    showMessage(
                        messageArea,
                        "Cupom criado com sucesso.",
                        "success"
                    );
                }

                await refresh();
            }
        );
    }

    async function toggleStatus(
        coupon
    ) {
        const nextStatus =
            !coupon.active;

        const message =
            nextStatus
                ? "Ativar este cupom?"
                : "Desativar este cupom?";

        if (
            !window.confirm(
                message
            )
        ) {
            return;
        }

        try {
            await updateCoupon(
                coupon.id,
                {
                    active:
                        nextStatus
                }
            );

            showMessage(
                messageArea,
                nextStatus
                    ? "Cupom ativado."
                    : "Cupom desativado.",
                "success"
            );

            await refresh();
        } catch (error) {
            console.error(
                "[NEFER COUPONS] Erro ao alterar status:",
                error
            );

            showMessage(
                messageArea,
                error?.message ||
                "Não foi possível alterar o status.",
                "error"
            );
        }
    }

    async function removeCoupon(
        coupon
    ) {
        if (
            !window.confirm(
                `Excluir o cupom ${coupon.code}?`
            )
        ) {
            return;
        }

        try {
            await deleteCoupon(
                coupon.id
            );

            showMessage(
                messageArea,
                "Cupom excluído com sucesso.",
                "success"
            );

            await refresh();
        } catch (error) {
            console.error(
                "[NEFER COUPONS] Erro ao excluir:",
                error
            );

            showMessage(
                messageArea,
                error?.message ||
                "Não foi possível excluir o cupom.",
                "error"
            );
        }
    }

    container
        .querySelector(
            "[data-action='refresh']"
        )
        ?.addEventListener(
            "click",
            refresh
        );

    await refresh();
}

window.NEFCoupons = {
    collectionName:
        COLLECTION_NAME,

    list:
        listCoupons,

    create:
        createCoupon,

    update:
        updateCoupon,

    delete:
        deleteCoupon,

    render:
        renderCouponsModule
};

console.log(
    "[NEFER ADMIN] Módulo de Cupons carregado."
);