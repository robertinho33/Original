import { ORDER_STATUS } from '../orders/order-status.js';
import { LOGISTICS_STATUS } from '../orders/logistics-status.js';
import { appendOrderEvent, ORDER_EVENT } from '../orders/order-history.js';
import { fetchAddressByCep } from './address-service.js';
import { saveOrder as persistOrder } from '../orders/order-service.js';


/* =========================================================
   CONFIGURAÇÃO
   ========================================================= */

const CART_STORAGE_KEY = 'aurea-cart';
const CATALOG_PATH = '../data/produtos.csv';
const DELIVERY_COST = 19.90;

let products = [];
let cart = [];
let submitting = false;


/* =========================================================
   ELEMENTOS
   ========================================================= */

const elements = {
    form: document.getElementById('checkoutForm'),

    customerName: document.getElementById('customerName'),
    customerEmail: document.getElementById('customerEmail'),
    customerPhone: document.getElementById('customerPhone'),

    deliveryMethod: document.querySelectorAll(
        'input[name="deliveryMethod"]'
    ),

    addressFields: document.getElementById('addressFields'),

    cep: document.getElementById('cep'),
    cepStatus: document.getElementById('cepStatus'),

    street: document.getElementById('street'),
    number: document.getElementById('number'),
    complement: document.getElementById('complement'),
    neighborhood: document.getElementById('neighborhood'),
    city: document.getElementById('city'),
    state: document.getElementById('state'),

    paymentMethod: document.querySelectorAll(
        'input[name="paymentMethod"]'
    ),

    orderNotes: document.getElementById('orderNotes'),

    checkoutItems: document.getElementById('checkoutItems'),
    checkoutSubtotal: document.getElementById('checkoutSubtotal'),
    checkoutShipping: document.getElementById('checkoutShipping'),
    checkoutTotal: document.getElementById('checkoutTotal'),

    submitOrder: document.getElementById('submitOrder'),
    submitOrderText: document.getElementById('submitOrderText'),

    checkoutMessage: document.getElementById('checkoutMessage'),

    checkoutSuccess: document.getElementById('checkoutSuccess'),
    successMessage: document.getElementById('successMessage'),
    successOrderNumber: document.getElementById('successOrderNumber'),

    pixPaymentContainer: document.getElementById(
        'pixPaymentContainer'
    ),

    pixQrCodeImage: document.getElementById(
        'pixQrCodeImage'
    ),

    pixCopiaCola: document.getElementById(
        'pixCopiaCola'
    ),

    btnCopyPix: document.getElementById(
        'btnCopyPix'
    ),

    pixCopyStatus: document.getElementById(
        'pixCopyStatus'
    )
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

    /*
     * Formato brasileiro:
     * 1.234,56 -> 1234.56
     */
    if (text.includes(',')) {

        text = text
            .replace(/\./g, '')
            .replace(',', '.');

        return Number.parseFloat(text) || 0;
    }

    /*
     * Formato simples:
     * 1234.56
     */
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

    return String(value ?? '').replace(/\D/g, '');
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

        if (char === '"' && insideQuotes && next === '"') {

            current += '"';
            i += 1;

            continue;
        }

        if (char === '"') {

            insideQuotes = !insideQuotes;

            continue;
        }

        if (char === ';' && !insideQuotes) {

            result.push(current);
            current = '';

            continue;
        }

        if (char === ',' && !insideQuotes) {

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

    const headers = parseCsvLine(lines[0])
        .map(header => header.trim());

    return lines.slice(1).map(line => {

        const values = parseCsvLine(line);

        const item = {};

        headers.forEach((header, index) => {

            item[header] = values[index] ?? '';

        });

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

        price: parsePrice(
            product.Preço ??
            product.Preco ??
            product.preço ??
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
            product.Descrição ??
            product.Descricao ??
            product.descrição ??
            product.descricao ??
            ''
    };
}


async function loadProducts() {

    const response = await fetch(CATALOG_PATH, {
        cache: 'no-store'
    });

    if (!response.ok) {
        throw new Error(
            `Não foi possível carregar o catálogo. HTTP ${response.status}`
        );
    }

    const text = await response.text();

    products = parseCsv(text)
        .map(normalizeProduct)
        .filter(product => product.sku);

    return products;
}


/* =========================================================
   CARRINHO
   ========================================================= */

function loadCart() {

    try {

        const stored = localStorage.getItem(
            CART_STORAGE_KEY
        );

        if (!stored) {
            return [];
        }

        const parsed = JSON.parse(stored);

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
        sku: String(
            item.sku ??
            item.SKU ??
            item.codigo ??
            item.code ??
            ''
        ).trim(),

        quantity: Math.max(
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

    const normalizedSku = normalizeText(sku);

    return products.find(product =>
        normalizeText(product.sku) === normalizedSku
    );
}


function getCartItems() {

    return cart
        .map(item => {

            const normalized = normalizeCartItem(item);

            const product = findProductBySku(
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
            (total, item) => total + item.total,
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


function getTotal() {

    return getSubtotal() + getShipping();
}


/* =========================================================
   RENDER CARRINHO
   ========================================================= */

function renderCart() {

    const items = getCartItems();

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
        items.map(item => {

            const image = item.product.image
                ? item.product.image
                : '';

            const imageHtml = image
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
                            ${item.quantity} ×
                            ${formatCurrency(item.product.price)}
                        </p>

                    </div>

                    <strong class="checkout-item-price">
                        ${formatCurrency(item.total)}
                    </strong>

                </article>
            `;

        }).join('');

    updateTotals();
}


function updateTotals() {

    const subtotal = getSubtotal();
    const shipping = getShipping();
    const total = subtotal + shipping;

    elements.checkoutSubtotal.textContent =
        formatCurrency(subtotal);

    elements.checkoutShipping.textContent =
        shipping > 0
            ? formatCurrency(shipping)
            : 'Grátis';

    elements.checkoutTotal.textContent =
        formatCurrency(total);
}


/* =========================================================
   ENTREGA
   ========================================================= */

function updateDeliveryFields() {

    const delivery = getDeliveryMethod();

    const isDelivery = delivery === 'delivery';

    elements.addressFields.classList.toggle(
        'is-disabled',
        !isDelivery
    );

    const addressInputs = elements.addressFields
        .querySelectorAll('input');

    addressInputs.forEach(input => {

        input.disabled = !isDelivery;

        input.required = isDelivery;

    });

    updateTotals();
}


/* =========================================================
   CEP
   ========================================================= */

function formatCep(value) {

    const digits = onlyDigits(value).slice(0, 8);

    if (digits.length <= 5) {
        return digits;
    }

    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}


async function handleCep() {

    const cep = onlyDigits(elements.cep.value);

    elements.cep.value = formatCep(cep);

    if (cep.length !== 8) {

        elements.cepStatus.textContent = '';

        return;
    }

    elements.cepStatus.textContent =
        'Consultando endereço...';

    try {

        const address = await fetchAddressByCep(cep);

        if (!address) {
            throw new Error(
                'CEP não encontrado.'
            );
        }

        /*
         * Aceita os nomes mais comuns retornados
         * pelo address-service.
         */

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

        elements.cepStatus.textContent =
            'Endereço preenchido automaticamente.';

        elements.cepStatus.style.color =
            'var(--success)';

        elements.number.focus();

    } catch (error) {

        console.error(
            '[CHECKOUT] Erro ao consultar CEP:',
            error
        );

        elements.cepStatus.textContent =
            'Não foi possível localizar este CEP.';

        elements.cepStatus.style.color =
            'var(--danger)';
    }
}


/* =========================================================
   VALIDAÇÃO
   ========================================================= */

function clearValidation() {

    elements.form
        .querySelectorAll('.field.invalid')
        .forEach(field => {

            field.classList.remove('invalid');

        });
}


function markInvalid(input) {

    input
        .closest('.field')
        ?.classList.add('invalid');
}


function validateRequired(input) {

    if (!input.value.trim()) {

        markInvalid(input);

        return false;
    }

    return true;
}


function validateEmail(email) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(email.trim());
}


function validateForm() {

    clearValidation();

    const delivery = getDeliveryMethod();

    let valid = true;

    if (!validateRequired(elements.customerName)) {
        valid = false;
    }

    if (
        !elements.customerEmail.value.trim() ||
        !validateEmail(elements.customerEmail.value)
    ) {

        markInvalid(elements.customerEmail);

        valid = false;
    }

    if (!validateRequired(elements.customerPhone)) {
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

            if (!input.value.trim()) {

                markInvalid(input);

                valid = false;
            }

        });

        if (
            onlyDigits(elements.cep.value).length !== 8
        ) {

            markInvalid(elements.cep);

            valid = false;
        }
    }

    const items = getCartItems();

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

    elements.checkoutMessage.textContent = message;

    elements.checkoutMessage.hidden = false;
}


function hideMessage() {

    elements.checkoutMessage.hidden = true;

    elements.checkoutMessage.textContent = '';
}


/* =========================================================
   DADOS DO FORMULÁRIO
   ========================================================= */

function getCustomerData() {

    return {
        name: elements.customerName.value.trim(),
        email: elements.customerEmail.value.trim(),
        phone: elements.customerPhone.value.trim()
    };
}


function getAddressData() {

    if (getDeliveryMethod() !== 'delivery') {
        return null;
    }

    return {
        cep: formatCep(elements.cep.value),
        street: elements.street.value.trim(),
        number: elements.number.value.trim(),
        complement: elements.complement.value.trim(),
        neighborhood: elements.neighborhood.value.trim(),
        city: elements.city.value.trim(),
        state: elements.state.value.trim().toUpperCase()
    };
}


function getPaymentMethod() {

    return document.querySelector(
        'input[name="paymentMethod"]:checked'
    )?.value ?? 'pix';
}


/* =========================================================
   PEDIDO
   ========================================================= */

function createOrder() {

    const items = getCartItems();

    const subtotal = getSubtotal();
    const shipping = getShipping();
    const total = subtotal + shipping;

    const deliveryMethod = getDeliveryMethod();
    const paymentMethod = getPaymentMethod();

    const now = new Date();

    const orderId =
        `AUR-${now.getTime().toString(36).toUpperCase()}`;


    const order = {

        id: orderId,

        orderId,

        status: ORDER_STATUS.NEW,

        createdAt: now.toISOString(),

        customer: getCustomerData(),

        delivery: {
            method: deliveryMethod,
            address: getAddressData()
        },

        payment: {
            method: paymentMethod,
            status: 'pending'
        },

        logistics: {
            status: LOGISTICS_STATUS.NEW
        },

        history: [],

        items: items.map(item => ({
            sku: item.product.sku,
            name: item.product.name,
            quantity: item.quantity,
            unitPrice: item.product.price,
            total: item.total,
            image: item.product.image
        })),

        subtotal,

        shipping,

        total,

        notes: elements.orderNotes.value.trim(),

        source: 'website',

        currency: 'BRL'
    };


    appendOrderEvent(
        order,
        ORDER_EVENT.ORDER_CREATED
    );


    return order;
}
/* =========================================================
   PIX
   ========================================================= */

async function createPixPayment(order) {

    console.log(
        '[PIX] Criando pagamento:',
        order.total
    );

    const response = await fetch(
        '/api/create-pix-payment',
        {
            method: 'POST',

            headers: {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify(order)
        }
    );

    if (!response.ok) {

        throw new Error(
            `O servidor PIX respondeu com HTTP ${response.status}.`
        );
    }

    const result = await response.json();

    if (!result || result.success !== true) {

        throw new Error(
            result?.message ||
            'O servidor não conseguiu criar o pagamento PIX.'
        );
    }

    return result;
}


function getPixQrSource(result) {

    if (result.qr_code_base64) {

        return result.qr_code_base64.startsWith('data:')
            ? result.qr_code_base64
            : `data:image/png;base64,${result.qr_code_base64}`;
    }

    if (result.qr_code) {
        return result.qr_code;
    }

    if (result.qrCodeBase64) {

        return result.qrCodeBase64.startsWith('data:')
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

    const qrSource = getPixQrSource(result);
    const copyCode = getPixCopyCode(result);

    if (!qrSource && !copyCode) {

        throw new Error(
            'O servidor criou o PIX, mas não retornou os dados do pagamento.'
        );
    }

    if (qrSource) {

        elements.pixQrCodeImage.src =
            qrSource;

        elements.pixQrCodeImage.hidden = false;

    } else {

        elements.pixQrCodeImage.hidden = true;
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


    elements.form.hidden = true;

    elements.checkoutSuccess.hidden = false;

    elements.successOrderNumber.textContent =
        order.orderId;

    const paymentMethod =
        order.payment.method;

    if (paymentMethod === 'pix') {

        elements.successMessage.textContent =
            'Seu pedido foi registrado. Gere o pagamento PIX abaixo para concluir a compra.';

    } else {

        elements.successMessage.textContent =
            'Seu pedido foi registrado com sucesso. Em breve entraremos em contato para confirmar os próximos passos.';

    }

    elements.checkoutSuccess.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}


/* =========================================================
   COPIAR PIX
   ========================================================= */

async function copyPixCode() {

    const code =
        elements.pixCopiaCola.value.trim();

    if (!code) {
        return;
    }

    try {

        await navigator.clipboard.writeText(code);

        elements.pixCopyStatus.textContent =
            'Código PIX copiado.';

    } catch (error) {

        console.warn(
            '[PIX] Clipboard indisponível:',
            error
        );

        elements.pixCopiaCola.select();

        document.execCommand('copy');

        elements.pixCopyStatus.textContent =
            'Código PIX copiado.';
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

        if (!elements.checkoutMessage.hidden) {
            return;
        }

        showMessage(
            'Confira os campos destacados antes de continuar.'
        );

        return;
    }

    submitting = true;

    elements.submitOrder.disabled = true;

    elements.submitOrderText.textContent =
        'Registrando pedido...';

    try {

        const order = createOrder();

        console.log(
            '[CHECKOUT] Pedido criado:',
            order
        );

        /*
         * Primeiro registra o pedido.
         */
        await persistOrder(order);

        /*
         * O carrinho é removido somente depois
         * que o pedido foi salvo.
         */
        localStorage.removeItem(
            CART_STORAGE_KEY
        );

        /*
         * Mostra a tela de sucesso.
         */
        showSuccess(order);

        /*
         * PIX é criado depois do pedido.
         */
        if (order.payment.method === 'pix') {

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
                    await createPixPayment(order);

                /*
                 * Reconstrói o conteúdo original
                 * do container para renderizar o PIX.
                 */
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

                /*
                 * Atualiza as referências dos elementos
                 * recriados acima.
                 */
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

                elements.btnCopyPix.addEventListener(
                    'click',
                    copyPixCode
                );

                renderPixPayment(pixResult);
                /*
                 * Registra a geração do PIX no pedido.
                 *
                 * A geração do PIX não confirma o pagamento.
                 * O status permanece "pending".
                 */
                order.payment.pixCode =
                    pixResult.pix_code;

                order.payment.pixGeneratedAt =
                    new Date().toISOString();

                appendOrderEvent(
                    order,
                    ORDER_EVENT.PIX_GENERATED,
                    {
                        amount: pixResult.amount,
                        pixKey: pixResult.pix_key
                    }
                );

                /*
                 * Atualiza o mesmo pedido já salvo.
                 * O order.id impede duplicação.
                 */
                await persistOrder(order);

                console.log(
                    '[PIX] Pagamento criado com sucesso.'
                );

            } catch (pixError) {

                console.error(
                    '[PIX] Erro ao gerar pagamento:',
                    pixError
                );

                elements.pixPaymentContainer.innerHTML = `
                    <div class="pix-heading">

                        <p class="eyebrow">
                            PAGAMENTO PIX
                        </p>

                        <h3>
                            Pedido registrado
                        </h3>

                        <p>
                            Seu pedido foi salvo, mas não foi possível
                            gerar o PIX automaticamente.
                            Entre em contato conosco para concluir o pagamento.
                        </p>

                    </div>
                `;
            }
        }

    } catch (error) {

        console.error(
            '[CHECKOUT] Erro ao finalizar pedido:',
            error
        );

        showMessage(
            error?.message ||
            'Não foi possível finalizar o pedido. Tente novamente.'
        );

        elements.submitOrder.disabled = false;

        elements.submitOrderText.textContent =
            'Confirmar pedido';

        submitting = false;

        return;
    }

    elements.submitOrder.disabled = true;

    elements.submitOrderText.textContent =
        'Pedido registrado';
}


/* =========================================================
   EVENTOS
   ========================================================= */

function setupEvents() {

    elements.form.addEventListener(
        'submit',
        handleSubmit
    );


    elements.deliveryMethod.forEach(input => {

        input.addEventListener(
            'change',
            updateDeliveryFields
        );

    });


    elements.cep.addEventListener(
        'input',
        () => {

            elements.cep.value =
                formatCep(elements.cep.value);

        }
    );


    elements.cep.addEventListener(
        'blur',
        handleCep
    );


    /*
     * Limpa o estado de erro quando o usuário
     * começa a corrigir um campo.
     */
    elements.form
        .querySelectorAll('input, textarea')
        .forEach(input => {

            input.addEventListener(
                'input',
                () => {

                    input
                        .closest('.field')
                        ?.classList.remove('invalid');

                    hideMessage();

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

        cart = loadCart();

        await loadProducts();

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

        elements.submitOrder.disabled = true;
    }
}


init();
