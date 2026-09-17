'use strict';

import { loadProducts } from './catalog/catalog-service.js';
import { formatCurrency } from './utils/formatters.js';

const CART_STORAGE_KEY = 'aurea-cart';

let products = [];
let cart = [];

let selectedProductSku = null;
let modalQuantity = 1;

const productsEl = document.querySelector('#products');
const filtersEl = document.querySelector('#filters');

const cartItemsEl = document.querySelector('#cartItems');
const cartCountEl = document.querySelector('#cartCount');
const cartTotalEl = document.querySelector('#cartTotal');
const cartSummaryEl = document.querySelector('#cartSummary');

const cartDrawerEl = document.querySelector('#cartDrawer');
const backdropEl = document.querySelector('#backdrop');

const productModalEl = document.querySelector('#productModal');
const productModalBackdropEl = document.querySelector('#productModalBackdrop');
const closeProductModalButton = document.querySelector('#closeProductModal');

const productModalImageEl = document.querySelector('#productModalImage');
const productModalCategoryEl = document.querySelector('#productModalCategory');
const productModalTitleEl = document.querySelector('#productModalTitle');
const productModalDescriptionEl = document.querySelector('#productModalDescription');
const productModalWeightEl = document.querySelector('#productModalWeight');
const productModalStockEl = document.querySelector('#productModalStock');
const productModalPriceEl = document.querySelector('#productModalPrice');

const modalQuantityEl = document.querySelector('#modalQuantity');
const modalDecreaseButton = document.querySelector('#modalDecrease');
const modalIncreaseButton = document.querySelector('#modalIncrease');
const modalAddToCartButton = document.querySelector('#modalAddToCart');

function escapeHTML(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function escapeAttribute(value) {
    return escapeHTML(value);
}


/* =========================================================
   SACOLA
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
        console.error('Erro ao carregar a sacola:', error);
        return [];
    }
}

function saveCart() {
    localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify(cart)
    );
}

function getProductBySku(sku) {
    return products.find(product => product.sku === sku);
}

function getCartTotalQuantity() {
    return cart.reduce(
        (total, item) => total + item.quantity,
        0
    );
}

function getCartTotal() {
    return cart.reduce((total, item) => {

        const product = getProductBySku(item.sku);

        if (!product) {
            return total;
        }

        return total + (
            product.price * item.quantity
        );

    }, 0);
}

function addToCart(
    sku,
    quantity = 1,
    openDrawerAfter = true
) {
    const product = getProductBySku(sku);

    if (!product) {
        console.error(
            'Produto não encontrado:',
            sku
        );

        return;
    }

    const existing = cart.find(
        item => item.sku === sku
    );

    if (existing) {
        existing.quantity += quantity;
    } else {
        cart.push({
            sku,
            quantity
        });
    }

    saveCart();
    renderCart();

    if (openDrawerAfter) {
        openCart();
    }
}

function decreaseFromCart(sku) {
    const item = cart.find(
        cartItem => cartItem.sku === sku
    );

    if (!item) {
        return;
    }

    item.quantity -= 1;

    if (item.quantity <= 0) {
        cart = cart.filter(
            cartItem => cartItem.sku !== sku
        );
    }

    saveCart();
    renderCart();
}

function removeFromCart(sku) {
    cart = cart.filter(
        item => item.sku !== sku
    );

    saveCart();
    renderCart();
}


/* =========================================================
   FILTROS
   ========================================================= */

function renderFilters() {
    if (!filtersEl) {
        return;
    }

    const categories = [
        ...new Set(
            products
                .map(product => product.category)
                .filter(Boolean)
        )
    ].sort((a, b) =>
        a.localeCompare(b, 'pt-BR')
    );

    filtersEl.innerHTML = `
        <button
            class="active"
            type="button"
            data-category="todos"
        >
            Todos
        </button>

        ${categories.map(category => `
            <button
                type="button"
                data-category="${escapeAttribute(category)}"
            >
                ${escapeHTML(category)}
            </button>
        `).join('')}
    `;
}


/* =========================================================
   PRODUTOS
   ========================================================= */

function renderProducts(category = 'todos') {
    if (!productsEl) {
        return;
    }

    const normalizedCategory = String(category)
        .trim()
        .toLocaleLowerCase('pt-BR');

    const list = normalizedCategory === 'todos'
        ? products
        : products.filter(product =>
            String(product.category)
                .trim()
                .toLocaleLowerCase('pt-BR') ===
            normalizedCategory
        );

    if (!list.length) {
        productsEl.innerHTML = `
            <div class="catalog-empty">
                <p>
                    Nenhum produto encontrado nesta categoria.
                </p>
            </div>
        `;

        return;
    }

    productsEl.innerHTML = list.map(product => {

        const image = product.image
            ? `
                <img
                    class="product-image"
                    src="${escapeAttribute(product.image)}"
                    alt="${escapeAttribute(product.name)}"
                    loading="lazy"
                >
            `
            : `
                <div class="product-image-placeholder">
                    AURÉA
                </div>
            `;

        const weight = product.weight
            ? escapeHTML(product.weight)
            : '';

        return `
            <article
                class="product"
                data-product-sku="${escapeAttribute(product.sku)}"
                tabindex="0"
                role="button"
                aria-label="Ver detalhes de ${escapeAttribute(product.name)}"
            >

                <div class="product-visual">

                    ${image}

                    <span class="tag">
                        ${escapeHTML(product.category)}
                    </span>

                </div>

                <div class="product-info">

                    <h3>
                        ${escapeHTML(product.name)}
                    </h3>

                    <p>
                        ${escapeHTML(product.description)}
                    </p>

                    ${weight ? `
                        <small class="product-weight">
                            ${weight}
                        </small>
                    ` : ''}

                    <div class="product-bottom">

                        <span class="price">
                            ${formatCurrency(product.price)}
                        </span>

                        <button
                            class="add"
                            type="button"
                            data-add="${escapeAttribute(product.sku)}"
                            aria-label="Adicionar ${escapeAttribute(product.name)} à sacola"
                        >
                            +
                        </button>

                    </div>

                </div>

            </article>
        `;

    }).join('');
}


/* =========================================================
   SACOLA — RENDER
   ========================================================= */

function renderCart() {
    if (!cartItemsEl) {
        return;
    }

    const validCart = cart.filter(item =>
        getProductBySku(item.sku)
    );

    if (validCart.length !== cart.length) {
        cart = validCart;
        saveCart();
    }

    const totalQuantity =
        getCartTotalQuantity();

    if (cartCountEl) {
        cartCountEl.textContent =
            totalQuantity;
    }

    if (cartSummaryEl) {
        cartSummaryEl.textContent =
            totalQuantity === 1
                ? '1 item'
                : `${totalQuantity} itens`;
    }

    if (!cart.length) {

        cartItemsEl.innerHTML = `
            <div class="empty">
                Sua sacola está esperando por você.
            </div>
        `;

        if (cartTotalEl) {
            cartTotalEl.textContent =
                formatCurrency(0);
        }

        return;
    }

    cartItemsEl.innerHTML = cart.map(item => {

        const product =
            getProductBySku(item.sku);

        if (!product) {
            return '';
        }

        const image = product.image
            ? `
                <img
                    src="${escapeAttribute(product.image)}"
                    alt="${escapeAttribute(product.name)}"
                    loading="lazy"
                >
            `
            : '';

        const subtotal =
            product.price * item.quantity;

        return `
            <div class="cart-row">

                <div class="mini">
                    ${image}
                </div>

                <div class="cart-product-info">

                    <h4>
                        ${escapeHTML(product.name)}
                    </h4>

                    <small>
                        ${formatCurrency(product.price)}
                        cada
                    </small>

                    <div class="quantity-control">

                        <button
                            type="button"
                            data-decrease="${escapeAttribute(product.sku)}"
                            aria-label="Diminuir quantidade"
                        >
                            -
                        </button>

                        <span>
                            ${item.quantity}
                        </span>

                        <button
                            type="button"
                            data-increase="${escapeAttribute(product.sku)}"
                            aria-label="Aumentar quantidade"
                        >
                            +
                        </button>

                    </div>

                    <strong>
                        ${formatCurrency(subtotal)}
                    </strong>

                </div>

                <button
                    class="remove"
                    type="button"
                    data-remove="${escapeAttribute(product.sku)}"
                >
                    remover
                </button>

            </div>
        `;

    }).join('');

    if (cartTotalEl) {
        cartTotalEl.textContent =
            formatCurrency(getCartTotal());
    }
}


/* =========================================================
   DRAWER DA SACOLA
   ========================================================= */

function openCart() {
    cartDrawerEl?.classList.add('open');
    backdropEl?.classList.add('show');

    cartDrawerEl?.setAttribute(
        'aria-hidden',
        'false'
    );
}

function closeCart() {
    cartDrawerEl?.classList.remove('open');
    backdropEl?.classList.remove('show');

    cartDrawerEl?.setAttribute(
        'aria-hidden',
        'true'
    );
}


/* =========================================================
   MODAL DE PRODUTO
   ========================================================= */

function updateModalQuantity() {
    if (modalQuantityEl) {
        modalQuantityEl.textContent =
            modalQuantity;
    }
}

function openProductModal(sku) {
    const product =
        getProductBySku(sku);

    if (!product || !productModalEl) {
        return;
    }

    selectedProductSku = sku;
    modalQuantity = 1;

    if (productModalCategoryEl) {
        productModalCategoryEl.textContent =
            product.category || 'Produto';
    }

    if (productModalTitleEl) {
        productModalTitleEl.textContent =
            product.name;
    }

    if (productModalDescriptionEl) {
        productModalDescriptionEl.textContent =
            product.description || '';
    }

    if (productModalWeightEl) {
        productModalWeightEl.textContent =
            product.weight || 'Não informado';
    }

    if (productModalStockEl) {
        productModalStockEl.textContent =
            product.stock || 'Não informado';
    }

    if (productModalPriceEl) {
        productModalPriceEl.textContent =
            formatCurrency(product.price);
    }

    if (productModalImageEl) {

        if (product.image) {
            productModalImageEl.src =
                product.image;

            productModalImageEl.alt =
                product.name;

            productModalImageEl.hidden =
                false;

        } else {

            productModalImageEl.removeAttribute(
                'src'
            );

            productModalImageEl.alt = '';

            productModalImageEl.hidden =
                true;
        }
    }

    updateModalQuantity();

    productModalEl.classList.add('open');

    productModalEl.setAttribute(
        'aria-hidden',
        'false'
    );

    document.body.classList.add(
        'modal-open'
    );

    requestAnimationFrame(() => {
        closeProductModalButton?.focus();
    });
}

function closeProductModal() {
    if (!productModalEl) {
        return;
    }

    productModalEl.classList.remove(
        'open'
    );

    productModalEl.setAttribute(
        'aria-hidden',
        'true'
    );

    document.body.classList.remove(
        'modal-open'
    );

    selectedProductSku = null;
    modalQuantity = 1;
}

function increaseModalQuantity() {
    modalQuantity += 1;

    updateModalQuantity();
}

function decreaseModalQuantity() {
    if (modalQuantity <= 1) {
        return;
    }

    modalQuantity -= 1;

    updateModalQuantity();
}

function addModalProductToCart() {
    if (!selectedProductSku) {
        return;
    }

    addToCart(
        selectedProductSku,
        modalQuantity,
        false
    );

    closeProductModal();
    openCart();
}


/* =========================================================
   EVENTOS
   ========================================================= */

filtersEl?.addEventListener(
    'click',
    event => {

        const button =
            event.target.closest(
                'button[data-category]'
            );

        if (!button) {
            return;
        }

        filtersEl
            .querySelectorAll('button')
            .forEach(item => {
                item.classList.remove(
                    'active'
                );
            });

        button.classList.add('active');

        renderProducts(
            button.dataset.category ||
            'todos'
        );
    }
);


productsEl?.addEventListener(
    'click',
    event => {

        const addButton =
            event.target.closest(
                '[data-add]'
            );

        if (addButton) {

            event.stopPropagation();

            addToCart(
                addButton.dataset.add
            );

            return;
        }

        const productCard =
            event.target.closest(
                '[data-product-sku]'
            );

        if (!productCard) {
            return;
        }

        openProductModal(
            productCard.dataset.productSku
        );
    }
);


productsEl?.addEventListener(
    'keydown',
    event => {

        if (
            event.key !== 'Enter' &&
            event.key !== ' '
        ) {
            return;
        }

        const productCard =
            event.target.closest(
                '[data-product-sku]'
            );

        if (!productCard) {
            return;
        }

        event.preventDefault();

        openProductModal(
            productCard.dataset.productSku
        );
    }
);


cartItemsEl?.addEventListener(
    'click',
    event => {

        const increaseButton =
            event.target.closest(
                '[data-increase]'
            );

        if (increaseButton) {

            addToCart(
                increaseButton.dataset.increase,
                1,
                false
            );

            return;
        }

        const decreaseButton =
            event.target.closest(
                '[data-decrease]'
            );

        if (decreaseButton) {

            decreaseFromCart(
                decreaseButton.dataset.decrease
            );

            return;
        }

        const removeButton =
            event.target.closest(
                '[data-remove]'
            );

        if (removeButton) {

            removeFromCart(
                removeButton.dataset.remove
            );
        }
    }
);


document.querySelector(
    '#openCart'
)?.addEventListener(
    'click',
    openCart
);


document.querySelector(
    '#closeCart'
)?.addEventListener(
    'click',
    closeCart
);


backdropEl?.addEventListener(
    'click',
    closeCart
);


closeProductModalButton?.addEventListener(
    'click',
    closeProductModal
);


productModalBackdropEl?.addEventListener(
    'click',
    closeProductModal
);


modalIncreaseButton?.addEventListener(
    'click',
    increaseModalQuantity
);


modalDecreaseButton?.addEventListener(
    'click',
    decreaseModalQuantity
);


modalAddToCartButton?.addEventListener(
    'click',
    addModalProductToCart
);


document.addEventListener(
    'keydown',
    event => {

        if (
            event.key === 'Escape' &&
            productModalEl?.classList.contains(
                'open'
            )
        ) {
            closeProductModal();

            return;
        }

        if (
            event.key === 'Escape' &&
            cartDrawerEl?.classList.contains(
                'open'
            )
        ) {
            closeCart();
        }
    }
);


document.querySelector(
    '#checkout'
)?.addEventListener(
    'click',
    () => {

        if (!cart.length) {
            alert(
                'Adicione algum produto primeiro.'
            );

            return;
        }

        window.location.href = 'pages/checkout.html';
    }
);


/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

async function init() {

    try {

        cart = loadCart();

        products =
            await loadProducts();

        console.log(
            `Auréa: ${products.length} produtos carregados do CSV.`
        );

        renderFilters();
        renderProducts();
        renderCart();

    } catch (error) {

        console.error(
            'Erro ao carregar catálogo:',
            error
        );

        if (productsEl) {

            productsEl.innerHTML = `
                <div class="catalog-error">

                    <h3>
                        Não foi possível carregar o catálogo.
                    </h3>

                    <p>
                        Verifique se o arquivo
                        <strong>
                            data/produtos.csv
                        </strong>
                        está disponível.
                    </p>

                </div>
            `;
        }
    }
}

init();
