import { ORDER_STATUS } from '../orders/order-status.js';
import { db } from '../firebase-config.js';
import { loadProducts as loadCatalogProducts } from '../catalog/catalog-service.js';
import { LOGISTICS_STATUS } from '../orders/logistics-status.js';
import { appendOrderEvent, ORDER_EVENT } from '../orders/order-history.js';
import { fetchAddressByCep } from './address-service.js';
import { createWhatsAppUrl } from '../communication/whatsapp-service.js';
/* =========================================================
   CONFIGURAÇÃO
   ========================================================= */

const CART_STORAGE_KEY = 'aurea-cart';
const CATALOG_PATH = '../data/produtos.csv';
const DELIVERY_COST = 19.90;
const CHECKOUT_DRAFT_STORAGE_KEY = 'nefer-checkout-draft';
const CHECKOUT_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CHECKOUT_DRAFT_FIELD_IDS = [
    'customerName',
    'customerEmail',
    'customerPhone',
    'cep',
    'street',
    'number',
    'complement',
    'neighborhood',
    'city',
    'state',
    'orderNotes',
    'couponCode'
];

const PIX_API_URL =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
        ? '/api/create-pix-payment'
        : 'https://aurea-pix-api.onrender.com/api/create-pix-payment';

let products = [];
let cart = [];
let submitting = false;
let appliedCoupon = null;
/* =========================================================
   ELEMENTOS
   ========================================================= */

const elements = {

    form:
        document.getElementById('checkoutForm'),

    customerName:
        document.getElementById('customerName'),

    customerEmail:
        document.getElementById('customerEmail'),

    customerPhone:
        document.getElementById('customerPhone'),

    deliveryMethod:
        document.querySelectorAll(
            'input[name="deliveryMethod"]'
        ),

    addressFields:
        document.getElementById('addressFields'),

    cep:
        document.getElementById('cep'),

    cepStatus:
        document.getElementById('cepStatus'),

    street:
        document.getElementById('street'),

    number:
        document.getElementById('number'),

    complement:
        document.getElementById('complement'),

    neighborhood:
        document.getElementById('neighborhood'),

    city:
        document.getElementById('city'),

    state:
        document.getElementById('state'),

    paymentMethod:
        document.querySelectorAll(
            'input[name="paymentMethod"]'
        ),

    orderNotes:
        document.getElementById('orderNotes'),

    checkoutItems:
        document.getElementById('checkoutItems'),

    checkoutSubtotal:
        document.getElementById('checkoutSubtotal'),

    checkoutShipping:
        document.getElementById('checkoutShipping'),

    checkoutDiscount:
        document.getElementById('checkoutDiscount'),

    checkoutTotal:
        document.getElementById('checkoutTotal'),

    couponCode:
        document.getElementById('couponCode'),

    applyCoupon:
        document.getElementById('applyCoupon'),

    couponMessage:
        document.getElementById('couponMessage'),

    submitOrder:
        document.getElementById('submitOrder'),

    submitOrderText:
        document.getElementById('submitOrderText'),

    checkoutMessage:
        document.getElementById('checkoutMessage'),

    checkoutSuccess:
        document.getElementById('checkoutSuccess'),

    successMessage:
        document.getElementById('successMessage'),

    successOrderNumber:
        document.getElementById('successOrderNumber'),

    pixPaymentContainer:
        document.getElementById('pixPaymentContainer'),

    pixQrCodeImage:
        document.getElementById('pixQrCodeImage'),

    pixCopiaCola:
        document.getElementById('pixCopiaCola'),

    btnCopyPix:
        document.getElementById('btnCopyPix'),

    pixCopyStatus:
        document.getElementById('pixCopyStatus')
};


function saveCheckoutDraft() {
    try {
        const fields = {};
        CHECKOUT_DRAFT_FIELD_IDS.forEach(id => {
            const input = document.getElementById(id);
            if (input) fields[id] = input.value;
        });

        const draft = {
            expiresAt: Date.now() + CHECKOUT_DRAFT_TTL_MS,
            fields,
            deliveryMethod: getCheckedOption('deliveryMethod', 'delivery'),
            paymentMethod: getCheckedOption('paymentMethod', 'pix')
        };
        localStorage.setItem(CHECKOUT_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch (error) {
        console.warn('[CHECKOUT] Não foi possível salvar o rascunho local:', error);
    }
}

function getCheckedOption(name, fallback) {
    return document.querySelector(`input[name="${name}"]:checked`)?.value || fallback;
}

function restoreCheckoutDraft() {
    try {
        const raw = localStorage.getItem(CHECKOUT_DRAFT_STORAGE_KEY);
        if (!raw) return false;

        const draft = JSON.parse(raw);
        if (!draft || !Number.isFinite(draft.expiresAt) || draft.expiresAt <= Date.now()) {
            localStorage.removeItem(CHECKOUT_DRAFT_STORAGE_KEY);
            return false;
        }

        CHECKOUT_DRAFT_FIELD_IDS.forEach(id => {
            const input = document.getElementById(id);
            const value = draft.fields?.[id];
            if (input && typeof value === 'string') input.value = value;
        });

        ['deliveryMethod', 'paymentMethod'].forEach(name => {
            const value = draft[name];
            if (typeof value !== 'string') return;
            const option = document.querySelector(`input[name="${name}"][value="${CSS.escape(value)}"]`);
            if (option) option.checked = true;
        });

        return true;
    } catch (error) {
        console.warn('[CHECKOUT] Não foi possível recuperar o rascunho local:', error);
        try { localStorage.removeItem(CHECKOUT_DRAFT_STORAGE_KEY); } catch {}
        return false;
    }
}


/* =========================================================
   UTILITÁRIOS
   ========================================================= */

function formatCurrency(value) {

    const number = Number(value) || 0;

    return number.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}


function parsePrice(value) {

    if (typeof value === 'number') {
        return value;
    }

    if (value === null || value === undefined) {
        return 0;
    }

    let text = String(value)
        .trim()
        .replace(/\s/g, '')
        .replace(/^R\$/i, '');

    if (!text) {
        return 0;
    }

    if (text.includes(',')) {

        text = text
            .replace(/\./g, '')
            .replace(',', '.');

        return Number.parseFloat(text) || 0;
    }

    return Number.parseFloat(text) || 0;
}


function normalizeText(value) {

    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}


function escapeHtml(value) {

    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


function onlyDigits(value) {

    return String(value ?? '')
        .replace(/\D/g, '');
}


function normalizePhoneDigits(value) {

    let digits = onlyDigits(value);

    if (
        digits.length === 13 &&
        digits.startsWith('55')
    ) {
        digits = digits.slice(2);
    }

    return digits.slice(0, 11);
}


function formatPhone(value) {

    const digits =
        normalizePhoneDigits(value);

    if (digits.length <= 2) {
        return digits;
    }

    if (digits.length <= 7) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }

    if (digits.length <= 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }

    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}


/* =========================================================
   CSV
   ========================================================= */

function parseCsvLine(line) {

    const result = [];

    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i += 1) {

        const char = line[i];
        const next = line[i + 1];

        if (
            char === '"' &&
            insideQuotes &&
            next === '"'
        ) {
            current += '"';
            i += 1;
            continue;
        }

        if (char === '"') {
            insideQuotes = !insideQuotes;
            continue;
        }

        if (
            (char === ';' || char === ',') &&
            !insideQuotes
        ) {
            result.push(current);
            current = '';
            continue;
        }

        current += char;
    }

    result.push(current);

    return result;
}


function parseCsv(text) {

    const lines = text
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .filter(line => line.trim());

    if (!lines.length) {
        return [];
    }

    const headers =
        parseCsvLine(lines[0])
            .map(header => header.trim());

    return lines
        .slice(1)
        .map(line => {

            const values =
                parseCsvLine(line);

            const item = {};

            headers.forEach(
                (header, index) => {
                    item[header] =
                        values[index] ?? '';
                }
            );

            return item;
        });
}


/* =========================================================
   PRODUTOS
   ========================================================= */

function normalizeProduct(product) {

    return {

        sku:
            product.SKU ??
            product.sku ??
            product.Codigo ??
            product.codigo ??
            '',

        name:
            product.Produto ??
            product.produto ??
            product.Nome ??
            product.nome ??
            'Produto',

        price:
            parsePrice(
                product['Preço'] ??
                product.Preco ??
                product['preço'] ??
                product.preco ??
                product.Price ??
                product.price ??
                0
            ),

        image:
            product.Imagem ??
            product.imagem ??
            product.Image ??
            product.image ??
            '',

        category:
            product.Categoria ??
            product.categoria ??
            '',

        description:
            product['Descrição'] ??
            product.Descricao ??
            product['descrição'] ??
            product.descricao ??
            ''
    };
}


async function loadProducts() {

    const catalogProducts =
        await loadCatalogProducts();

    return catalogProducts
        .filter(
            product =>
                product?.active !== false
        )
        .map(product => ({

            ...product,

            sku: String(
                product.sku ?? ''
            ).trim(),

            name: String(
                product.name ?? ''
            ).trim(),

            price: Number(
                product.price ?? 0
            ),

            stock: Math.max(
                0,
                Number(
                    product.stock ?? 0
                )
            )
        }));
}


async function handleCep() {

    if (!elements.cep) {
        return;
    }

    const cep =
        onlyDigits(
            elements.cep.value
        );

    elements.cep.value =
        formatCep(cep);

    if (cep.length !== 8) {

        if (elements.cepStatus) {
            elements.cepStatus.textContent =
                '';
        }

        return;
    }

    if (elements.cepStatus) {

        elements.cepStatus.textContent =
            'Consultando endereço...';

        elements.cepStatus.style.color =
            '';
    }

    try {

        const address =
            await fetchAddressByCep(cep);

        if (!address) {
            throw new Error(
                'CEP não encontrado.'
            );
        }

        elements.street.value =
            address.street ??
            address.logradouro ??
            '';

        elements.neighborhood.value =
            address.neighborhood ??
            address.bairro ??
            '';

        elements.city.value =
            address.city ??
            address.localidade ??
            '';

        elements.state.value =
            address.state ??
            address.uf ??
            '';

        if (elements.cepStatus) {

            elements.cepStatus.textContent =
                'Endereço preenchido automaticamente.';

            elements.cepStatus.style.color =
                'var(--success)';
        }

        elements.number?.focus();

    } catch (error) {

        console.error(
            '[CHECKOUT] Erro ao consultar CEP:',
            error
        );

        if (elements.cepStatus) {

            elements.cepStatus.textContent =
                'Não foi possível localizar este CEP.';

            elements.cepStatus.style.color =
                'var(--danger)';
        }
    }
}

/* =========================================================
   SACOLA / CARRINHO
   ========================================================= */

function loadCart() {
    try {
        const stored =
            JSON.parse(
                localStorage.getItem(
                    CART_STORAGE_KEY
                ) || '[]'
            );

        if (!Array.isArray(stored)) {
            return [];
        }

        return stored
            .filter(item => {
                return (
                    item &&
                    typeof item.sku === 'string' &&
                    item.sku.trim() !== '' &&
                    Number.isInteger(item.quantity) &&
                    item.quantity > 0
                );
            })
            .map(item => ({
                sku: item.sku.trim(),
                quantity: item.quantity
            }));

    } catch (error) {

        console.error(
            '[CHECKOUT] Erro ao carregar a sacola:',
            error
        );

        return [];
    }
}


function saveCart() {
    localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify(cart)
    );
}


function normalizeCartItem(item) {

    return {
        sku:
            String(
                item?.sku ?? ''
            ).trim(),

        quantity:
            Math.max(
                1,
                Number.parseInt(
                    item?.quantity,
                    10
                ) || 1
            )
    };
}


function findProductBySku(sku) {

    const normalizedSku =
        String(
            sku ?? ''
        ).trim();

    return products.find(
        product =>
            String(
                product?.sku ?? ''
            ).trim() === normalizedSku
    ) || null;
}


function getCartItems() {

    return cart
        .map(item => {

            const product =
                findProductBySku(
                    item.sku
                );

            if (!product) {
                return null;
            }

            const quantity =
                Math.max(
                    1,
                    Number.parseInt(
                        item.quantity,
                        10
                    ) || 1
                );

            return {
                sku:
                    item.sku,

                quantity,

                product,

                total:
                    Number(product.price || 0) *
                    quantity
            };
        })
        .filter(Boolean);
}


function getSubtotal() {

    return getCartItems()
        .reduce(
            (total, item) =>
                total + item.total,
            0
        );
}


function getDeliveryMethod() {

    return (
        document.querySelector(
            'input[name="deliveryMethod"]:checked'
        )?.value || 'delivery'
    );
}


function getShipping() {

    return getDeliveryMethod() === 'pickup'
        ? 0
        : DELIVERY_COST;
}


function getDiscount(subtotal) {

    if (!appliedCoupon) {
        return 0;
    }

    const base = Number(subtotal) || 0;
    const value = Number(
        appliedCoupon.value ??
        appliedCoupon.discount ??
        0
    ) || 0;

    let discount = 0;

    if (
        appliedCoupon.type ===
        'percentage'
    ) {
        discount =
            base *
            value /
            100;
    } else {
        discount = Math.min(
            base,
            value
        );
    }

    return Number(
        Math.max(
            0,
            discount
        ).toFixed(2)
    );
}


function getTotal() {

    const subtotal =
        getSubtotal();

    const shipping =
        getShipping();

    const discount =
        getDiscount(subtotal);

    return Math.max(
        0,
        subtotal +
        shipping -
        discount
    );
}


function formatCep(value) {

    const digits =
        onlyDigits(value)
            .slice(0, 8);

    if (digits.length <= 5) {
        return digits;
    }

    return (
        digits.slice(0, 5) +
        '-' +
        digits.slice(5)
    );
}


/* =========================================================
   RENDER DO CHECKOUT
   ========================================================= */

function renderCart() {

    if (!elements.checkoutItems) {
        return;
    }

    const items =
        getCartItems();

    if (!items.length) {

        elements.checkoutItems.innerHTML = `
            <div class="checkout-empty">
                Sua sacola está vazia.
            </div>
        `;

    } else {

        elements.checkoutItems.innerHTML =
            items.map(item => {

                const product =
                    item.product;

                const image =
                    product.image
                        ? `
                            <img
                                src="${escapeHtml(
                                    product.image
                                )}"
                                alt="${escapeHtml(
                                    product.name
                                )}"
                                loading="lazy"
                            >
                        `
                        : '';

                return `
                    <div class="checkout-item">

                        <div class="checkout-item-image">
                            ${image}
                        </div>

                        <div class="checkout-item-info">

                            <strong>
                                ${escapeHtml(
                                    product.name
                                )}
                            </strong>

                            <small>
                                SKU:
                                ${escapeHtml(
                                    product.sku
                                )}
                            </small>

                            <small>
                                Quantidade:
                                ${item.quantity}
                            </small>

                        </div>

                        <div class="checkout-item-price">
                            ${formatCurrency(
                                item.total
                            )}
                        </div>

                    </div>
                `;

            }).join('');
    }

    const subtotal =
        getSubtotal();

    const shipping =
        getShipping();

    const discount =
        getDiscount(subtotal);

    const total =
        getTotal();

    if (elements.checkoutSubtotal) {
        elements.checkoutSubtotal.textContent =
            formatCurrency(subtotal);
    }

    if (elements.checkoutShipping) {
        elements.checkoutShipping.textContent =
            shipping > 0
                ? formatCurrency(shipping)
                : 'Grátis';
    }

    if (elements.checkoutDiscount) {
        elements.checkoutDiscount.textContent =
            discount > 0
                ? `- ${formatCurrency(discount)}`
                : formatCurrency(0);
    }

    if (elements.checkoutTotal) {
        elements.checkoutTotal.textContent =
            formatCurrency(total);
    }
}


/* =========================================================
   ENTREGA
   ========================================================= */

function updateDeliveryFields() {

    const deliveryMethod =
        getDeliveryMethod();

    const isDelivery =
        deliveryMethod === 'delivery';

    if (elements.addressFields) {

        elements.addressFields.hidden =
            !isDelivery;
    }

    if (!isDelivery) {

        [
            elements.cep,
            elements.street,
            elements.number,
            elements.complement,
            elements.neighborhood,
            elements.city,
            elements.state
        ].forEach(input => {

            input
                ?.closest(
                    '.field, .checkout-field'
                )
                ?.classList.remove(
                    'invalid'
                );
        });
    }

    renderCart();
}


/* =========================================================
   CUPOM
   ========================================================= */

async function applyCouponCode() {

    const code =
        String(
            elements.couponCode?.value ?? ''
        )
        .trim()
        .toUpperCase();

    if (!code) {

        appliedCoupon = null;

        if (elements.couponMessage) {
            elements.couponMessage.textContent =
                'Digite um cupom.';
        }

        renderCart();

        return;
    }

    if (elements.couponMessage) {
        elements.couponMessage.textContent =
            'Validando cupom...';
    }

    try {

        const response = await fetch(
            `/api/coupons/validate?code=${encodeURIComponent(code)}`,
            {
                method: 'GET',
                headers: {
                    Accept: 'application/json'
                }
            }
        );

        const result = await response.json();

        if (
            !response.ok ||
            !result.valid ||
            !result.coupon
        ) {

            appliedCoupon = null;

            if (elements.couponMessage) {
                elements.couponMessage.textContent =
                    result.message ||
                    'Cupom inválido ou expirado.';
            }

            renderCart();

            return;
        }

        const coupon = result.coupon;

        appliedCoupon = {
            code: coupon.code,
            type: coupon.discountType,
            value: Number(coupon.discount || 0),
            id: coupon.id,
            influencerId: coupon.influencerId || '',
            affiliateName:
                coupon.affiliateName || '',
            commission:
                Number(coupon.commission || 0)
        };

        if (elements.couponMessage) {
            elements.couponMessage.textContent =
                coupon.discountType === 'percentage'
                    ? `Cupom ${coupon.code} aplicado: ${coupon.discount}% de desconto.`
                    : `Cupom ${coupon.code} aplicado.`;
        }

        renderCart();

    } catch (error) {

        console.error(
            '[NEFER CHECKOUT] erro ao validar cupom:',
            error
        );

        appliedCoupon = null;

        if (elements.couponMessage) {
            elements.couponMessage.textContent =
                'Não foi possível validar o cupom.';
        }

        renderCart();
    }
}  

/* =========================================================
   VALIDAÇÃO
   ========================================================= */

function clearValidation() {

    elements.form
        ?.querySelectorAll(
            '.field.invalid, .checkout-field.invalid'
        )
        .forEach(field => {

            field.classList.remove(
                'invalid'
            );
        });
}


function markInvalid(input) {

    if (!input) {
        return;
    }

    input
        .closest(
            '.field, .checkout-field'
        )
        ?.classList.add('invalid');
}


function validateRequired(input) {

    if (
        !input ||
        !String(input.value ?? '').trim()
    ) {

        markInvalid(input);

        return false;
    }

    return true;
}


function validateEmail(email) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(
            String(email ?? '').trim()
        );
}


function validatePhone(phone) {

    return (
        normalizePhoneDigits(phone).length >= 10
    );
}


function validateForm() {

    clearValidation();

    const delivery =
        getDeliveryMethod();

    let valid = true;

    if (
        !validateRequired(
            elements.customerName
        )
    ) {
        valid = false;
    }
if (
    !elements.customerEmail?.value.trim() ||
    !validateEmail(
        elements.customerEmail.value
    )
) {

    markInvalid(
        elements.customerEmail
    );

    valid = false;
}

if (
    !validatePhone(
        elements.customerPhone?.value
    )
) {

    markInvalid(
        elements.customerPhone
    );

    valid = false;
}

if (delivery === 'delivery') {

    const requiredAddress = [

        elements.cep,
        elements.street,
        elements.number,
        elements.neighborhood,
        elements.city,
        elements.state
    ];

    requiredAddress.forEach(input => {

        if (
            !validateRequired(input)
        ) {
            valid = false;
        }
    });

    if (
        onlyDigits(
            elements.cep?.value
        ).length !== 8
    ) {

        markInvalid(
            elements.cep
        );

        valid = false;
    }
}

const paymentMethod =
    document.querySelector(
        'input[name="paymentMethod"]:checked'
    );

if (!paymentMethod) {

    const paymentError =
        document.querySelector(
            '[data-payment-error]'
        );

    if (paymentError) {

        paymentError.textContent =
            'Selecione uma forma de pagamento.';
    }

    valid = false;
}

const items =
    getCartItems();

if (!items.length) {

    showMessage(
        'Seu carrinho está vazio. Adicione produtos antes de finalizar o pedido.'
    );

    valid = false;
}

return valid;
}


/* =========================================================
   MENSAGENS
   ========================================================= */

function showMessage(message) {

    if (!elements.checkoutMessage) {
        return;
    }

    elements.checkoutMessage.textContent =
        message;

    elements.checkoutMessage.hidden =
        false;
}


function hideMessage() {

    if (!elements.checkoutMessage) {
        return;
    }

    elements.checkoutMessage.hidden =
        true;

    elements.checkoutMessage.textContent =
        '';
}


/* =========================================================
   DADOS DO CLIENTE
   ========================================================= */

function getCustomerData() {

    return {

        name:
            elements.customerName.value.trim(),

        email:
            elements.customerEmail.value.trim(),

        phone:
            normalizePhoneDigits(
                elements.customerPhone.value
            )
    };
}


function getAddressData() {

    if (
        getDeliveryMethod() !==
        'delivery'
    ) {
        return null;
    }

    return {

        cep:
            formatCep(
                elements.cep.value
            ),

        street:
            elements.street.value.trim(),

        number:
            elements.number.value.trim(),

        complement:
            elements.complement.value.trim(),

        neighborhood:
            elements.neighborhood.value.trim(),

        city:
            elements.city.value.trim(),

        state:
            elements.state.value
                .trim()
                .toUpperCase()
    };
}


function getPaymentMethod() {

    return document.querySelector(
        'input[name="paymentMethod"]:checked'
    )?.value ?? null;
}


/* =========================================================
   PEDIDO
   ========================================================= */

function createOrder() {

    const items =
        getCartItems();

    const subtotal =
        getSubtotal();

    const shipping =
        getShipping();

    const discount =
        getDiscount(subtotal);

    const total =
        getTotal();

    const deliveryMethod =
        getDeliveryMethod();

    const paymentMethod =
        getPaymentMethod();

    if (!paymentMethod) {
        throw new Error(
            'Selecione uma forma de pagamento.'
        );
    }

    const now =
        new Date();

    const orderId =
        `AUR-${now.getTime().toString(36).toUpperCase()}`;

    const order = {

        id:
            orderId,

        orderId,

        status:
            ORDER_STATUS.NEW,

        createdAt:
            now.toISOString(),

        customer:
            getCustomerData(),

        delivery: {

            method:
                deliveryMethod,

            address:
                getAddressData()
        },

        payment: {

            method:
                paymentMethod,

            status:
                'pending'
        },

        logistics: {

            status:
                LOGISTICS_STATUS.NEW
        },

        history: [],

        items:
        items.map(item => ({
            productId:
                item.product.id ??
                item.product.productId ??
                '',

            sku:
                item.product.sku,

            name:
                item.product.name,

            quantity:
                item.quantity,

            unitPrice:
                item.product.price,

            total:
                item.total,

            image:
                item.product.image
        })),

        subtotal,

        discount,

        shipping,

        total,

        coupon:
            appliedCoupon
                ? {
                    id:
                        appliedCoupon.id,

                    code:
                        appliedCoupon.code,

                    influencerId:
                        appliedCoupon.influencerId,

                    affiliateName:
                        appliedCoupon.affiliateName,

                    commission:
                        appliedCoupon.commission,

                    type:
                        appliedCoupon.type,

                    value:
                        appliedCoupon.value
                }
                : null,

        notes:
            elements.orderNotes?.value.trim() ?? '',

        source:
            'website',

        currency:
            'BRL'
    };

    appendOrderEvent(
        order,
        ORDER_EVENT.ORDER_CREATED
    );

    return order;
}


/* =========================================================
   PIX
   =========================================================
   IMPORTANTE:
   A lógica de geração PIX abaixo permanece preservada.
   A validação/UX do PIX pertence à ETAPA 05/12.
   ========================================================= */

async function createPixPayment(order) {

    console.log(
        '[PIX] Criando pagamento:',
        order.total
    );

    const response =
        await fetch(
            PIX_API_URL,
            {
                method: 'POST',

                headers: {
                    'Content-Type':
                        'application/json'
                },

                body:
                    JSON.stringify(order)
            }
        );

    const result = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(
            result?.message ||
            result?.error?.message ||
            `O servidor PIX respondeu com HTTP ${response.status}.`
        );
    }

    if (
        !result ||
        result.success !== true
    ) {

        throw new Error(
            result?.message ||
            'O servidor não conseguiu criar o pagamento PIX.'
        );
    }

    return result;
}


function getPixQrSource(result) {

    if (result.qr_code_base64) {

        return result.qr_code_base64
            .startsWith('data:')
                ? result.qr_code_base64
                : `data:image/png;base64,${result.qr_code_base64}`;
    }

    if (result.qr_code) {
        return result.qr_code;
    }

    if (result.qrCodeBase64) {

        return result.qrCodeBase64
            .startsWith('data:')
                ? result.qrCodeBase64
                : `data:image/png;base64,${result.qrCodeBase64}`;
    }

    return '';
}


function getPixCopyCode(result) {

    return (
        result.pix_code ??
        result.qr_code ??
        result.copy_paste ??
        result.copia_e_cola ??
        result.pixCode ??
        ''
    );
}


function renderPixPayment(result) {

    const qrSource =
        getPixQrSource(result);

    const copyCode =
        getPixCopyCode(result);

    if (!qrSource && !copyCode) {

        throw new Error(
            'O servidor criou o PIX, mas não retornou os dados do pagamento.'
        );
    }

    if (qrSource) {

        elements.pixQrCodeImage.src =
            qrSource;

        elements.pixQrCodeImage.hidden =
            false;

    } else {

        elements.pixQrCodeImage.hidden =
            true;
    }

    elements.pixCopiaCola.value =
        copyCode;

    elements.pixPaymentContainer.hidden =
        false;
}


/* =========================================================
   SUCESSO
   ========================================================= */

function showSuccess(order) {

    if (elements.form) {
        elements.form.hidden =
            true;
    }

    if (elements.checkoutSuccess) {

        elements.checkoutSuccess.hidden =
            false;
    }

    if (elements.successOrderNumber) {

        elements.successOrderNumber.textContent =
            order.orderId;
    }

    const trackingPage = new URL('../pages/rastrear-pedido.html', window.location.href);
    trackingPage.searchParams.set('pedido', String(order.orderNumber || order.orderId || ''));
    const trackingUrl = trackingPage.toString();
    const itemSummary = (Array.isArray(order.items) ? order.items : [])
        .map(item => `${Number(item.quantity) || 1} × ${item.name || item.sku || 'Produto'}`)
        .join('\n');
    const customerName = String(order.customer?.name || '').trim();
    const whatsappMessage = [
        'Olá, NEFER COSMETICS! Acabei de fazer um pedido.',
        `Pedido: ${order.orderId}`,
        customerName ? `Cliente: ${customerName}` : '',
        itemSummary ? `Itens:\n${itemSummary}` : '',
        `Total: ${formatCurrency(order.total)}`,
        order.coupon?.code ? `Cupom: ${order.coupon.code}` : '',
        trackingUrl ? `Acompanhamento: ${trackingUrl}` : ''
    ].filter(Boolean).join('\n');
    const whatsappButton = document.getElementById('orderWhatsAppButton');
    if (whatsappButton) {
        try {
            whatsappButton.href = createWhatsAppUrl({
                phone: '11986215473',
                message: whatsappMessage
            });
            whatsappButton.hidden = false;
        } catch (error) {
            console.warn('[WHATSAPP] Não foi possível preparar o resumo do pedido:', error);
            whatsappButton.hidden = true;
        }
    }

    const paymentMethod =
        order.payment.method;

    if (paymentMethod === 'pix') {

        if (elements.successMessage) {

            elements.successMessage.textContent =
                'Seu pedido foi registrado. Gere o pagamento PIX abaixo para concluir a compra.';
        }

    } else {

        if (elements.successMessage) {

            elements.successMessage.textContent =
                'Seu pedido foi registrado com sucesso. Em breve entraremos em contato para confirmar os próximos passos.';
        }
    }

    elements.checkoutSuccess?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

async function registerNonPixOrder(order) {
    const response = await fetch('/api/orders/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            items: (Array.isArray(order.items) ? order.items : []).map(item => ({
                sku: item.sku,
                quantity: item.quantity
            })),
            customer: order.customer,
            address: order.delivery?.address || null,
            deliveryMethod: order.delivery?.method || 'delivery',
            discount: Number(order.discount || 0),
            paymentMethod: order.payment?.method || 'cash',
            coupon: order.coupon || null
        })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.success || !result?.data) {
        throw new Error(result?.message || result?.error || 'Não foi possível registrar o pedido.');
    }

    const saved = result.data;
    order.id = saved.id || saved.orderNumber;
    order.orderId = saved.orderNumber || saved.id;
    order.orderNumber = saved.orderNumber || saved.id;
    order.trackingToken = saved.publicTrackingToken || '';
    order.status = saved.status || 'pending';
    order.payment = { ...order.payment, ...(saved.payment || {}) };
    order.total = Number(saved.totals?.total ?? order.total);
    order.subtotal = Number(saved.totals?.subtotal ?? order.subtotal);
    order.shipping = Number(saved.totals?.shipping ?? order.shipping);
    order.discount = Number(saved.totals?.discount ?? order.discount);
    return order;
}


/* =========================================================
   COPIAR PIX
   ========================================================= */

async function copyPixCode() {

    const code =
        elements.pixCopiaCola?.value.trim();

    if (!code) {
        return;
    }

    try {

        await navigator.clipboard.writeText(
            code
        );

        if (elements.pixCopyStatus) {

            elements.pixCopyStatus.textContent =
                'Código PIX copiado.';
        }

    } catch (error) {

        console.warn(
            '[PIX] Clipboard indisponível:',
            error
        );

        elements.pixCopiaCola.select();

        document.execCommand(
            'copy'
        );

        if (elements.pixCopyStatus) {

            elements.pixCopyStatus.textContent =
                'Código PIX copiado.';
        }
    }
}


/* =========================================================
   SUBMIT
   ========================================================= */

async function handleSubmit(event) {

    event.preventDefault();

    if (submitting) {
        return;
    }

    hideMessage();

    if (!validateForm()) {

        if (
            elements.checkoutMessage &&
            !elements.checkoutMessage.hidden
        ) {
            return;
        }

        showMessage(
            'Confira os campos destacados antes de continuar.'
        );

        return;
    }

    submitting = true;

    elements.submitOrder.disabled =
        true;

    elements.submitOrderText.textContent =
        'Processando pedido...';

    try {

        const order =
            createOrder();

        console.log(
            '[CHECKOUT] Pedido criado:',
            order
        );


        /*
         * O PIX precisa ser gerado antes da primeira
         * gravação do pedido.
         *
         * Assim o pedido é salvo somente uma vez.
         */

        if (
            order.payment.method ===
            'pix'
        ) {

            elements.pixPaymentContainer.hidden =
                false;

            elements.pixPaymentContainer.innerHTML = `
                <div class="pix-heading">

                    <p class="eyebrow">
                        PAGAMENTO PIX
                    </p>

                    <h3>
                        Gerando seu pagamento...
                    </h3>

                    <p>
                        Aguarde enquanto preparamos o PIX.
                    </p>

                </div>
            `;

            try {

                const pixResult =
                    await createPixPayment(
                        order
                    );

                if (pixResult.order?.orderNumber) {
                    order.id = pixResult.order.orderNumber;
                    order.orderId = pixResult.order.orderNumber;
                }
                order.trackingToken =
                    pixResult.order?.publicTrackingToken || '';

                order.payment.status =
                    pixResult.status || 'pending';

                order.payment.provider =
                    pixResult.provider || 'aurea-pix-core';

                order.payment.orderId =
                    pixResult.order_id || order.id;

                order.payment.txid =
                    pixResult.txid || '';

                order.payment.pixKey =
                    pixResult.pix_key || '';

                order.payment.pixCity =
                    pixResult.pix_city || '';

                order.payment.merchantName =
                    pixResult.pix_merchant_name || '';

                order.payment.pixCode =
                    pixResult.pix_code || '';

                order.payment.pixGeneratedAt =
                    new Date().toISOString();

                appendOrderEvent(
                    order,
                    ORDER_EVENT.PIX_GENERATED,
                    {
                        amount:
                            pixResult.amount,

                        provider:
                            pixResult.provider,

                        status:
                            pixResult.status,

                        orderId:
                            pixResult.order_id,

                        txid:
                            pixResult.txid,

                        pixKey:
                            pixResult.pix_key
                    }
                );

                elements.pixPaymentContainer.innerHTML = `
                    <div class="pix-heading">

                        <p class="eyebrow">
                            PAGAMENTO PIX
                        </p>

                        <h3>
                            Finalize seu pagamento
                        </h3>

                        <p>
                            Escaneie o QR Code ou copie o código PIX.
                        </p>

                    </div>

                    <div class="pix-qr">

                        <img
                            id="pixQrCodeImage"
                            src=""
                            alt="QR Code para pagamento PIX"
                        >

                    </div>

                    <div class="pix-copy">

                        <label for="pixCopiaCola">
                            PIX Copia e Cola
                        </label>

                        <div class="pix-copy-row">

                            <input
                                type="text"
                                id="pixCopiaCola"
                                readonly
                            >

                            <button
                                type="button"
                                id="btnCopyPix"
                                class="copy-pix-button"
                            >
                                Copiar
                            </button>

                        </div>

                        <small id="pixCopyStatus"></small>

                    </div>
                `;

                elements.pixQrCodeImage =
                    document.getElementById(
                        'pixQrCodeImage'
                    );

                elements.pixCopiaCola =
                    document.getElementById(
                        'pixCopiaCola'
                    );

                elements.btnCopyPix =
                    document.getElementById(
                        'btnCopyPix'
                    );

                elements.pixCopyStatus =
                    document.getElementById(
                        'pixCopyStatus'
                    );

                elements.btnCopyPix?.addEventListener(
                    'click',
                    copyPixCode
                );

                renderPixPayment(
                    pixResult
                );

                console.log(
                    '[PIX] Pagamento criado com sucesso.'
                );

            } catch (pixError) {

                console.error(
                    '[PIX] Erro ao gerar pagamento:',
                    pixError
                );

                throw new Error(
                    'Não foi possível gerar o PIX: ' +
                    pixError.message
                );
            }
        } else {
            await registerNonPixOrder(order);
        }


        /*
         * ÚNICA gravação do pedido.
         *
         * No caso do PIX, o objeto já contém:
         *
         * - pixCode
         * - pixGeneratedAt
         * - PIX_GENERATED
         */


        localStorage.removeItem(
            CART_STORAGE_KEY
        );
        localStorage.removeItem(CHECKOUT_DRAFT_STORAGE_KEY);


        showSuccess(
            order
        );


        /*
         * O pedido foi concluído.
         * Não deixamos o botão continuar bloqueado
         * como se ainda estivesse processando.
         */

        elements.submitOrderText.textContent =
            'Pedido finalizado.';

    } catch (error) {

        console.error(
            '[CHECKOUT] Erro ao finalizar pedido:',
            error
        );

        showMessage(
            error?.message ||
            'Não foi possível finalizar o pedido. Tente novamente.'
        );

        elements.submitOrder.disabled =
            false;

        elements.submitOrderText.textContent =
            'Finalizar pedido';

        submitting =
            false;
    }
}


/* =========================================================
   EVENTOS
   ========================================================= */

function setupEvents() {

    elements.form?.addEventListener(
        'submit',
        handleSubmit
    );


    elements.deliveryMethod.forEach(
        input => {

            input.addEventListener(
                'change',
                updateDeliveryFields
            );
        }
    );


    elements.cep?.addEventListener(
        'input',
        () => {

            elements.cep.value =
                formatCep(
                    elements.cep.value
                );

            if (
                elements.cepStatus &&
                onlyDigits(
                    elements.cep.value
                ).length < 8
            ) {
                elements.cepStatus.textContent =
                    '';
            }
        }
    );


    elements.cep?.addEventListener(
        'blur',
        handleCep
    );


    elements.customerPhone?.addEventListener(
        'input',
        () => {

            elements.customerPhone.value =
                formatPhone(
                    elements.customerPhone.value
                );
        }
    );


    elements.applyCoupon?.addEventListener(
        'click',
        applyCouponCode
    );


    elements.couponCode?.addEventListener(
        'keydown',
        event => {

            if (event.key === 'Enter') {

                event.preventDefault();

                applyCouponCode();
            }
        }
    );


    elements.paymentMethod.forEach(
        input => {

            input.addEventListener(
                'change',
                () => {

                    const paymentError =
                        document.querySelector(
                            '[data-payment-error]'
                        );

                    if (paymentError) {
                        paymentError.textContent =
                            '';
                    }

                    hideMessage();
                }
            );
        }
    );


    elements.form
        ?.querySelectorAll(
            'input, textarea, select'
        )
        .forEach(input => {

            input.addEventListener(
                'input',
                () => {

                    input
                        .closest(
                            '.field, .checkout-field'
                        )
                        ?.classList.remove(
                            'invalid'
                        );

                    hideMessage();
                    saveCheckoutDraft();
                }
            );

            input.addEventListener(
                'change',
                () => {

                    input
                        .closest(
                            '.field, .checkout-field'
                        )
                        ?.classList.remove(
                            'invalid'
                        );
                    saveCheckoutDraft();
                }
            );
        });
}


/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

async function init() {

    console.log(
        '[CHECKOUT] Inicializando...'
    );

    try {

        cart =
            loadCart();

        if (!cart.length) {

            showMessage(
                'Sua sacola está vazia. Volte à loja e adicione produtos.'
            );

            if (elements.submitOrder) {
                elements.submitOrder.disabled =
                    true;
            }

            return;
        }


        products = await loadProducts();

        cart =
            cart
                .map(normalizeCartItem)
                .filter(
                    item =>
                        findProductBySku(
                            item.sku
                        )
                );


        if (!cart.length) {

            localStorage.removeItem(
                CART_STORAGE_KEY
            );

            showMessage(
                'Os produtos da sua sacola não estão mais disponíveis.'
            );

            if (elements.submitOrder) {
                elements.submitOrder.disabled =
                    true;
            }

            return;
        }


        renderCart();

        restoreCheckoutDraft();
        updateDeliveryFields();
        setupEvents();

        if (elements.couponCode?.value.trim()) {
            await applyCouponCode();
        }


        console.log(
            '[CHECKOUT] Inicializado com sucesso.'
        );

    } catch (error) {

        console.error(
            '[CHECKOUT] Falha na inicialização:',
            error
        );

        showMessage(
            'Não foi possível carregar o checkout. Atualize a página e tente novamente.'
        );

        if (elements.submitOrder) {
            elements.submitOrder.disabled =
                true;
        }
    }
}


init();
