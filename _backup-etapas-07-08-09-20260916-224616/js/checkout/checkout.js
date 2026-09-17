import { ORDER_STATUS } from '../orders/order-status.js';
import { LOGISTICS_STATUS } from '../orders/logistics-status.js';
import { appendOrderEvent, ORDER_EVENT } from '../orders/order-history.js';
import { fetchAddressByCep } from './address-service.js';
import { saveOrder as persistOrder } from '../orders/order-service.js';


/* =========================================================
   CONFIGURA�?�fO
   ========================================================= */

const CART_STORAGE_KEY = 'aurea-cart';
const CATALOG_PATH = '../data/produtos.csv';
const DELIVERY_COST = 19.90;

const PIX_API_URL =
    'https://aurea-pix-api.onrender.com/api/create-pix-payment';

let products = [];
let cart = [];
let submitting = false;
let appliedCoupon = null;


const COUPONS = Object.freeze({
    AUREA10: Object.freeze({
        code: 'AUREA10',
        type: 'percentage',
        value: 10
    })
});


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

    const response =
        await fetch(CATALOG_PATH, {
            cache: 'no-store'
        });

    if (!response.ok) {

        throw new Error(
            `Não foi possível carregar o catálogo. HTTP ${response.status}`
        );
    }

    const text =
        await response.text();

    products =
        parseCsv(text)
            .map(normalizeProduct)
            .filter(product => product.sku);

    return products;
}


/* =========================================================
   CARRINHO
   ========================================================= */

function loadCart() {

    try {

        const stored =
            localStorage.getItem(
                CART_STORAGE_KEY
            );

        if (!stored) {
            return [];
        }

        const parsed =
            JSON.parse(stored);

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed;

    } catch (error) {

        console.error(
            '[CHECKOUT] Erro ao carregar carrinho:',
            error
        );

        return [];
    }
}


function normalizeCartItem(item) {

    return {

        sku:
            String(
                item.sku ??
                item.SKU ??
                item.codigo ??
                item.code ??
                ''
            ).trim(),

        quantity:
            Math.max(
                1,
                Number(
                    item.quantity ??
                    item.quantidade ??
                    item.qty ??
                    1
                ) || 1
            )
    };
}


function findProductBySku(sku) {

    const normalizedSku =
        normalizeText(sku);

    return products.find(
        product =>
            normalizeText(product.sku) ===
            normalizedSku
    );
}


function getCartItems() {

    return cart
        .map(item => {

            const normalized =
                normalizeCartItem(item);

            const product =
                findProductBySku(
                    normalized.sku
                );

            if (!product) {
                return null;
            }

            return {

                ...normalized,

                product,

                total:
                    product.price *
                    normalized.quantity
            };
        })
        .filter(Boolean);
}


/* =========================================================
   TOTAIS
   ========================================================= */

function getSubtotal() {

    return getCartItems()
        .reduce(
            (total, item) =>
                total + item.total,
            0
        );
}


function getDeliveryMethod() {

    return document.querySelector(
        'input[name="deliveryMethod"]:checked'
    )?.value ?? 'delivery';
}


function getShipping() {

    return getDeliveryMethod() === 'delivery'
        ? DELIVERY_COST
        : 0;
}


function getDiscount(
    subtotal = getSubtotal()
) {

    if (!appliedCoupon) {
        return 0;
    }

    if (
        appliedCoupon.type ===
        'percentage'
    ) {
        return Number(
            (
                subtotal *
                (appliedCoupon.value / 100)
            ).toFixed(2)
        );
    }

    return 0;
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
        Number(
            (
                subtotal -
                discount +
                shipping
            ).toFixed(2)
        )
    );
}


/* =========================================================
   CUPOM
   ========================================================= */

function applyCouponCode() {

    const code =
        String(
            elements.couponCode?.value || ''
        )
        .trim()
        .toUpperCase();

    if (!code) {

        appliedCoupon = null;

        if (elements.couponMessage) {
            elements.couponMessage.textContent =
                'Digite um cupom.';
        }

        updateTotals();
        return;
    }

    const coupon =
        COUPONS[code];

    if (!coupon) {

        appliedCoupon = null;

        if (elements.couponMessage) {
            elements.couponMessage.textContent =
                'Cupom inválido.';
        }

        updateTotals();
        return;
    }

    appliedCoupon =
        coupon;

    if (elements.couponMessage) {
        elements.couponMessage.textContent =
            'Cupom aplicado: 10% de desconto.';
    }

    updateTotals();
}


/* =========================================================
   RENDERIZA�?�fO DO CARRINHO
   ========================================================= */

function renderCart() {

    const items =
        getCartItems();

    if (!items.length) {

        elements.checkoutItems.innerHTML = `
            <div class="empty-cart">
                Seu carrinho está vazio.
            </div>
        `;

        updateTotals();

        return;
    }

    elements.checkoutItems.innerHTML =
        items
            .map(item => {

                const image =
                    item.product.image
                        ? item.product.image
                        : '';

                const imageHtml =
                    image
                        ? `
                            <img
                                class="checkout-item-image"
                                src="${escapeHtml(image)}"
                                alt="${escapeHtml(item.product.name)}"
                            >
                        `
                        : `
                            <div class="checkout-item-image"></div>
                        `;

                return `
                    <article class="checkout-item">

                        ${imageHtml}

                        <div class="checkout-item-info">

                            <p class="checkout-item-name">
                                ${escapeHtml(item.product.name)}
                            </p>

                            <p class="checkout-item-meta">
                                ${item.quantity} �-
                                ${formatCurrency(item.product.price)}
                            </p>

                        </div>

                        <strong class="checkout-item-price">
                            ${formatCurrency(item.total)}
                        </strong>

                    </article>
                `;
            })
            .join('');

    updateTotals();
}


function updateTotals() {

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

    const delivery =
        getDeliveryMethod();

    const isDelivery =
        delivery === 'delivery';

    if (!elements.addressFields) {
        return;
    }

    elements.addressFields.classList.toggle(
        'is-disabled',
        !isDelivery
    );

    const addressInputs =
        elements.addressFields.querySelectorAll(
            'input, select, textarea'
        );

    const requiredAddressFields = [
        elements.cep,
        elements.street,
        elements.number,
        elements.neighborhood,
        elements.city,
        elements.state
    ];

    addressInputs.forEach(input => {

        input.disabled =
            !isDelivery;

        input.required =
            isDelivery &&
            requiredAddressFields.includes(input);
    });

    updateTotals();
}


/* =========================================================
   CEP
   ========================================================= */

function formatCep(value) {

    const digits =
        onlyDigits(value)
            .slice(0, 8);

    if (digits.length <= 5) {
        return digits;
    }

    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
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
   VALIDA�?�fO
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
                    code:
                        appliedCoupon.code,

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

    if (!response.ok) {

        throw new Error(
            `O servidor PIX respondeu com HTTP ${response.status}.`
        );
    }

    const result =
        await response.json();

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

    const trackOrderButton =
        document.getElementById(
            'trackOrderButton'
        );

    if (trackOrderButton) {

        trackOrderButton.href =
            `../pages/rastrear-pedido.html?pedido=${encodeURIComponent(
                order.orderId
            )}`;
    }

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

                order.payment.pixCode =
                    pixResult.pix_code;

                order.payment.pixGeneratedAt =
                    new Date().toISOString();

                appendOrderEvent(
                    order,
                    ORDER_EVENT.PIX_GENERATED,
                    {
                        amount:
                            pixResult.amount,

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
                    'Não foi possível gerar o PIX. ' +
                    'O pedido não foi registrado. Tente novamente.'
                );
            }
        }


        /*
         * �sNICA gravação do pedido.
         *
         * No caso do PIX, o objeto já contém:
         *
         * - pixCode
         * - pixGeneratedAt
         * - PIX_GENERATED
         */

        await persistOrder(
            order
        );


        localStorage.removeItem(
            CART_STORAGE_KEY
        );


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
                }
            );
        });
}


/* =========================================================
   INICIALIZA�?�fO
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


        await loadProducts();


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

        updateDeliveryFields();

        setupEvents();


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