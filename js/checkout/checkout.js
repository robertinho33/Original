import { fetchAddressByCep } from './address-service.js';
import { saveOrder as persistOrder } from '../orders/order-service.js';

'use strict';

const CART_STORAGE_KEY = 'aurea-cart';
/* const ORDER_STORAGE_KEY = 'aurea-last-order'; */

const CATALOG_PATH = '../data/produtos.csv';

const DELIVERY_COST = 19.90;

let products = [];
let cart = [];


/* =========================================================
   UTILITÃ¯Â¿Â½fÃ‚ÂRIOS
   ========================================================= */

function formatCurrency(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return 'R$ 0,00';
    }

    return number.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}


function escapeHTML(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}


function parsePrice(value) {
    if (value === null || value === undefined) {
        return 0;
    }

    let text = String(value).trim();

    if (!text) {
        return 0;
    }

    text = text
        .replace(/\s/g, '')
        .replace(/^R\$/i, '');

    if (text.includes(',')) {
        text = text
            .replace(/\./g, '')
            .replace(',', '.');
    }

    const number = Number(text);

    return Number.isFinite(number) ? number : 0;
}


function parseCSVLine(line) {
    const values = [];
    let current = '';
    let insideQuotes = false;

    for (let index = 0; index < line.length; index += 1) {

        const char = line[index];
        const next = line[index + 1];

        if (char === '"' && insideQuotes && next === '"') {
            current += '"';
            index += 1;
            continue;
        }

        if (char === '"') {
            insideQuotes = !insideQuotes;
            continue;
        }

        if (char === ',' && !insideQuotes) {
            values.push(current);
            current = '';
            continue;
        }

        current += char;
    }

    values.push(current);

    return values;
}


function parseCSV(text) {
    const rows = [];
    let current = '';
    let insideQuotes = false;

    for (let index = 0; index < text.length; index += 1) {

        const char = text[index];
        const next = text[index + 1];

        if (char === '"' && insideQuotes && next === '"') {
            current += '""';
            index += 1;
            continue;
        }

        if (char === '"') {
            insideQuotes = !insideQuotes;
            current += char;
            continue;
        }

        if (
            (char === '\n' || char === '\r') &&
            !insideQuotes
        ) {

            if (char === '\r' && next === '\n') {
                index += 1;
            }

            if (current.trim()) {
                rows.push(current);
            }

            current = '';
            continue;
        }

        current += char;
    }

    if (current.trim()) {
        rows.push(current);
    }

    if (!rows.length) {
        return [];
    }

    const headers = parseCSVLine(rows[0]).map(header =>
        header
            .trim()
            .replace(/^\uFEFF/, '')
    );

    return rows.slice(1).map(line => {

        const values = parseCSVLine(line);
        const row = {};

        headers.forEach((header, index) => {
            row[header] = values[index] ?? '';
        });

        return row;
    });
}


function normalizeProduct(row) {
    return {
        sku: String(row.SKU || '').trim(),
        name: String(row.Produto || '').trim(),
        price: parsePrice(row.PreÃ¯Â¿Â½fÃ‚Â§o),
        image: String(row.Imagem || '').trim()
    };
}


/* =========================================================
   DADOS
   ========================================================= */

function loadCart() {

    try {

        const stored = JSON.parse(
            localStorage.getItem(CART_STORAGE_KEY) || '[]'
        );

        if (!Array.isArray(stored)) {
            return [];
        }

        return stored
            .filter(item =>
                item &&
                typeof item.sku === 'string' &&
                Number.isInteger(item.quantity) &&
                item.quantity > 0
            )
            .map(item => ({
                sku: item.sku,
                quantity: item.quantity
            }));

    } catch (error) {

        console.error(
            'Erro ao carregar a sacola:',
            error
        );

        return [];
    }
}


async function loadProducts() {

    const response = await fetch(
        CATALOG_PATH,
        {
            cache: 'no-store'
        }
    );

    if (!response.ok) {
        throw new Error(
            `NÃ¯Â¿Â½fÃ‚Â£o foi possÃ¯Â¿Â½fÃ‚Â­vel carregar o catÃ¯Â¿Â½fÃ‚Â¡logo. HTTP ${response.status}`
        );
    }

    const text = await response.text();

    return parseCSV(text)
        .map(normalizeProduct)
        .filter(product =>
            product.sku &&
            product.name
        );
}


function getProductBySku(sku) {
    return products.find(
        product => product.sku === sku
    );
}


function getCartItems() {

    return cart
        .map(item => {

            const product =
                getProductBySku(item.sku);

            if (!product) {
                return null;
            }

            return {
                ...item,
                product,
                subtotal:
                    product.price * item.quantity
            };
        })
        .filter(Boolean);
}


function getSubtotal() {

    return getCartItems().reduce(
        (total, item) =>
            total + item.subtotal,
        0
    );
}


function getDeliveryMethod() {

    return document.querySelector(
        'input[name="deliveryMethod"]:checked'
    )?.value || 'delivery';
}


function getShippingCost() {

    return getDeliveryMethod() === 'pickup'
        ? 0
        : DELIVERY_COST;
}


function getTotal() {
    return getSubtotal() + getShippingCost();
}


/* =========================================================
   RESUMO
   ========================================================= */

function renderCheckoutItems() {

    const container =
        document.querySelector('#checkoutItems');

    if (!container) {
        return;
    }

    const items = getCartItems();

    container.innerHTML = items.map(item => {

        const image = item.product.image
            ? `
                <img
                    src="${escapeHTML(item.product.image)}"
                    alt="${escapeHTML(item.product.name)}"
                >
            `
            : '';

        return `
            <article class="checkout-item">

                <div class="checkout-item-image">
                    ${image}
                </div>

                <div class="checkout-item-info">

                    <strong>
                        ${escapeHTML(item.product.name)}
                    </strong>

                    <small>
                        ${item.quantity} Ã¯Â¿Â½fÃ¯Â¿Â½?"
                        ${formatCurrency(item.product.price)}
                    </small>

                </div>

                <strong class="checkout-item-price">
                    ${formatCurrency(item.subtotal)}
                </strong>

            </article>
        `;

    }).join('');
}


function renderTotals() {

    const subtotal =
        document.querySelector('#checkoutSubtotal');

    const shipping =
        document.querySelector('#checkoutShipping');

    const total =
        document.querySelector('#checkoutTotal');

    if (subtotal) {
        subtotal.textContent =
            formatCurrency(getSubtotal());
    }

    if (shipping) {
        shipping.textContent =
            getShippingCost() === 0
                ? 'GrÃ¯Â¿Â½fÃ‚Â¡tis'
                : formatCurrency(getShippingCost());
    }

    if (total) {
        total.textContent =
            formatCurrency(getTotal());
    }
}


function renderSummary() {
    renderCheckoutItems();
    renderTotals();
}


/* =========================================================
   ENTREGA
   ========================================================= */

function updateDeliveryFields() {

    const method =
        getDeliveryMethod();

    const addressFields =
        document.querySelector('#addressFields');

    if (!addressFields) {
        return;
    }

    const inputs =
        addressFields.querySelectorAll(
            'input, select'
        );

    const isDelivery =
        method === 'delivery';

    addressFields.hidden = !isDelivery;

    inputs.forEach(input => {
        input.disabled = !isDelivery;
    });

    renderTotals();
}


/* =========================================================
   FORMATAÃ¯Â¿Â½fÃ¯Â¿Â½?Ã¯Â¿Â½Ã¯Â¿Â½fÃ¯Â¿Â½'O
   ========================================================= */

function formatCEP(value) {

    const digits =
        String(value)
            .replace(/\D/g, '')
            .slice(0, 8);

    if (digits.length <= 5) {
        return digits;
    }

    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}


function formatPhone(value) {

    const digits =
        String(value)
            .replace(/\D/g, '')
            .slice(0, 11);

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


function setupFormatting() {

    const cep =
        document.querySelector('#addressZip');

    const phone =
        document.querySelector('#customerPhone');

    cep?.addEventListener(
        'input',
        event => {
            event.target.value =
                formatCEP(event.target.value);
        }
    );

    phone?.addEventListener(
        'input',
        event => {
            event.target.value =
                formatPhone(event.target.value);
        }
    );
}


/* =========================================================
   VALIDAÃ¯Â¿Â½fÃ¯Â¿Â½?Ã¯Â¿Â½Ã¯Â¿Â½fÃ¯Â¿Â½'O
   ========================================================= */

function clearErrors() {

    document
        .querySelectorAll('.checkout-field.invalid')
        .forEach(field =>
            field.classList.remove('invalid')
        );

    document
        .querySelectorAll('[data-error-for]')
        .forEach(error =>
            error.textContent = ''
        );
}


function setFieldError(
    fieldId,
    message
) {

    const field =
        document.querySelector(`#${fieldId}`);

    const messageEl =
        document.querySelector(
            `[data-error-for="${fieldId}"]`
        );

    field?.closest('.checkout-field')
        ?.classList.add('invalid');

    if (messageEl) {
        messageEl.textContent = message;
    }
}


function validateForm() {

    clearErrors();

    let valid = true;

    const name =
        document.querySelector('#customerName');

    const phone =
        document.querySelector('#customerPhone');

    const email =
        document.querySelector('#customerEmail');

    if (!name?.value.trim()) {
        setFieldError(
            'customerName',
            'Informe seu nome.'
        );

        valid = false;
    }

    const phoneDigits =
        phone?.value.replace(/\D/g, '') || '';

    if (phoneDigits.length < 10) {
        setFieldError(
            'customerPhone',
            'Informe um telefone vÃ¯Â¿Â½fÃ‚Â¡lido.'
        );

        valid = false;
    }

    if (
        email?.value.trim() &&
        !email.checkValidity()
    ) {

        setFieldError(
            'customerEmail',
            'Informe um e-mail vÃ¯Â¿Â½fÃ‚Â¡lido.'
        );

        valid = false;
    }

    if (getDeliveryMethod() === 'delivery') {

        const requiredFields = [
            [
                'addressZip',
                'Informe o CEP.'
            ],
            [
                'addressStreet',
                'Informe a rua ou avenida.'
            ],
            [
                'addressNumber',
                'Informe o nÃ¯Â¿Â½fÃ‚Âºmero.'
            ],
            [
                'addressNeighborhood',
                'Informe o bairro.'
            ],
            [
                'addressCity',
                'Informe a cidade.'
            ],
            [
                'addressState',
                'Selecione o estado.'
            ]
        ];

        requiredFields.forEach(
            ([id, message]) => {

                const field =
                    document.querySelector(`#${id}`);

                if (!field?.value.trim()) {

                    setFieldError(
                        id,
                        message
                    );

                    valid = false;
                }
            }
        );

        const cepDigits =
            document.querySelector(
                '#addressZip'
            )?.value.replace(/\D/g, '') || '';

        if (
            cepDigits &&
            cepDigits.length !== 8
        ) {

            setFieldError(
                'addressZip',
                'Informe um CEP vÃ¯Â¿Â½fÃ‚Â¡lido.'
            );

            valid = false;
        }
    }

    return valid;
}


/* =========================================================
   PEDIDO
   ========================================================= */

function createOrder() {

    const deliveryMethod =
        getDeliveryMethod();

    const paymentMethod =
        document.querySelector(
            'input[name="paymentMethod"]:checked'
        )?.value || '';

    const customer = {
        name:
            document.querySelector(
                '#customerName'
            )?.value.trim() || '',

        phone:
            document.querySelector(
                '#customerPhone'
            )?.value.trim() || '',

        email:
            document.querySelector(
                '#customerEmail'
            )?.value.trim() || ''
    };

    const address =
        deliveryMethod === 'delivery'
            ? {
                zip:
                    document.querySelector(
                        '#addressZip'
                    )?.value.trim() || '',

                street:
                    document.querySelector(
                        '#addressStreet'
                    )?.value.trim() || '',

                number:
                    document.querySelector(
                        '#addressNumber'
                    )?.value.trim() || '',

                complement:
                    document.querySelector(
                        '#addressComplement'
                    )?.value.trim() || '',

                neighborhood:
                    document.querySelector(
                        '#addressNeighborhood'
                    )?.value.trim() || '',

                city:
                    document.querySelector(
                        '#addressCity'
                    )?.value.trim() || '',

                state:
                    document.querySelector(
                        '#addressState'
                    )?.value || ''
            }
            : null;

    const items = getCartItems().map(item => ({
        sku: item.product.sku,
        name: item.product.name,
        quantity: item.quantity,
        unitPrice: item.product.price,
        subtotal: item.subtotal
    }));

    const now = new Date();

    const order = {

        id: createOrderId(),

        status: 'pending',

        createdAt:
            now.toISOString(),

        customer,

        delivery: {
            method: deliveryMethod,
            shipping:
                getShippingCost(),
            address
        },

        payment: {
            method: paymentMethod
        },

        items,

        financial: {
            subtotal: getSubtotal(),
            shipping: getShippingCost(),
            total: getTotal()
        },

        notes:
            document.querySelector(
                '#orderNotes'
            )?.value.trim() || ''
    };

    return order;
}


function createOrderId() {

    const timestamp =
        Date.now()
            .toString(36)
            .toUpperCase();

    const random =
        Math.random()
            .toString(36)
            .slice(2, 7)
            .toUpperCase();

    return `AUR-${timestamp}-${random}`;
}


function saveOrder(order) {
    return persistOrder(order);
}


/* =========================================================
   CONFIRMAÃ¯Â¿Â½fÃ¯Â¿Â½?Ã¯Â¿Â½Ã¯Â¿Â½fÃ¯Â¿Â½'O
   ========================================================= */

function showSuccess(order) {

    const modal =
        document.querySelector(
            '#checkoutSuccess'
        );

    const orderNumber =
        document.querySelector(
            '#successOrderNumber'
        );

    const message =
        document.querySelector(
            '#successMessage'
        );

    if (orderNumber) {
        orderNumber.textContent =
            order.id;
    }

    if (message) {
        message.textContent =
            `Obrigado, ${order.customer.name}. ` +
            `Recebemos seu pedido no valor de ` +
            `${formatCurrency(order.financial.total)}.`;
    }

    if (modal) {
        modal.hidden = false;
    }
}


/* =========================================================
   ENVIO
   ========================================================= */


async function handleCepLookup() {
    const cepInput = document.querySelector('#addressZip');

    if (!cepInput) {
        return;
    }

    const cep = cepInput.value.replace(/\D/g, '');

    if (cep.length !== 8) {
        return;
    }

    try {
        const address = await fetchAddressByCep(cep);

        const street = document.querySelector('#addressStreet');
        const neighborhood = document.querySelector('#addressNeighborhood');
        const city = document.querySelector('#addressCity');
        const state = document.querySelector('#addressState');

        if (street) {
            street.value = address.street;
        }

        if (neighborhood) {
            neighborhood.value = address.neighborhood;
        }

        if (city) {
            city.value = address.city;
        }

        if (state) {
            state.value = address.state;
        }

    } catch (error) {
        console.warn('Consulta de CEP:', error.message);
    }
}
function handleSubmit(event) {

    event.preventDefault();

    const message =
        document.querySelector(
            '#checkoutMessage'
        );

    if (!cart.length) {

        if (message) {
            message.hidden = false;
            message.textContent =
                'Sua sacola estÃ¯Â¿Â½fÃ‚Â¡ vazia. Volte Ã¯Â¿Â½fÃ‚Â  loja e adicione produtos.';
        }

        return;
    }

    if (!validateForm()) {

        if (message) {
            message.hidden = false;
            message.textContent =
                'Confira os campos destacados antes de continuar.';
        }

        document
            .querySelector('.checkout-field.invalid input, .checkout-field.invalid select')
            ?.focus();

        return;
    }

    if (message) {
        message.hidden = true;
    }

    const order = createOrder();

    saveOrder(order);

    /*
     * O carrinho sÃ¯Â¿Â½fÃ‚Â³ Ã¯Â¿Â½fÃ‚Â© limpo depois que o pedido
     * foi criado e salvo com sucesso.
     */
    localStorage.removeItem(
        CART_STORAGE_KEY
    );

    showSuccess(order);
}


/* =========================================================
   EVENTOS
   ========================================================= */

function setupEvents() {

    document
        .querySelector('#checkoutForm')
        ?.addEventListener(
            'submit',
            handleSubmit
        );

    document
        .querySelectorAll(
            'input[name="deliveryMethod"]'
        )
        .forEach(input => {

            input.addEventListener(
                'change',
                updateDeliveryFields
            );
        });
}


/* =========================================================
   INICIALIZAÃ¯Â¿Â½fÃ¯Â¿Â½?Ã¯Â¿Â½Ã¯Â¿Â½fÃ¯Â¿Â½'O
   ========================================================= */

async function init() {

    try {

        cart = loadCart();

        if (!cart.length) {

            window.location.href =
                'index.html#colecao';

            return;
        }

        products =
            await loadProducts();

        const validCart =
            cart.filter(item =>
                getProductBySku(item.sku)
            );

        cart = validCart;

        if (!cart.length) {

            window.location.href =
                'index.html#colecao';

            return;
        }

        setupFormatting();
        setupEvents();
        document
            .querySelector('#addressZip')
            ?.addEventListener(
                'blur',
                handleCepLookup
            );
        updateDeliveryFields();
        renderSummary();

    } catch (error) {

        console.error(
            'Erro ao iniciar checkout:',
            error
        );

        const message =
            document.querySelector(
                '#checkoutMessage'
            );

        if (message) {

            message.hidden = false;

            message.textContent =
                'NÃ¯Â¿Â½fÃ‚Â£o foi possÃ¯Â¿Â½fÃ‚Â­vel carregar o checkout. ' +
                'Atualize a pÃ¯Â¿Â½fÃ‚Â¡gina e tente novamente.';
        }
    }
}


init();
