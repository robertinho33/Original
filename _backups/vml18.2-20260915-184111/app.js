'use strict';

import {
    loadProducts,
    loadHomeProducts,
    searchProducts,
    loadSources
} from './catalog/catalog-service.js';
import { formatCurrency } from './utils/formatters.js';


const CATALOG_PAGE_SIZE = 24;

let catalogProducts = [];
let catalogSources = [];

let catalogPage = 1;
let catalogCategory = 'todos';
let catalogSourceId = 'todos';
let catalogSearch = '';
let catalogSort = 'relevance';

const CART_STORAGE_KEY = 'aurea-cart';

let products = [];
let cart = [];

let selectedProductSku = null;
let modalQuantity = 1;
let lastProductTriggerEl = null;

/* =========================================================
   ESTADO DOS FILTROS E PAGINAÇÃO
   ========================================================= */
const ITEMS_PER_PAGE = 8;
let currentPage = 1;
let currentCategory = 'todos';
let currentSearchQuery = '';
let currentSortOption = 'default';

const productsEl = document.querySelector('#products');
const filtersEl = document.querySelector('#filters');

// Elementos de busca, ordenação e paginação (criados via JS se não existirem no HTML)
const searchInputEl = document.querySelector('#searchInput');
const sortSelectEl = document.querySelector('#sortSelect');
const paginationEl = document.querySelector('#pagination');

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
        const stored = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
        if (!Array.isArray(stored)) return [];
        return stored
            .filter(item => item && typeof item.sku === 'string' && Number.isInteger(item.quantity) && item.quantity > 0)
            .map(item => ({ sku: item.sku, quantity: item.quantity }));
    } catch (error) {
        console.error('Erro ao carregar a sacola:', error);
        return [];
    }
}

function saveCart() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

function getProductBySku(sku) {
    return products.find(product => product.sku === sku);
}

function getCartTotalQuantity() {
    return cart.reduce((total, item) => total + item.quantity, 0);
}

function getCartTotal() {
    return cart.reduce((total, item) => {
        const product = getProductBySku(item.sku);
        return product ? total + (product.price * item.quantity) : total;
    }, 0);
}

function addToCart(sku, quantity = 1, openDrawerAfter = true) {
    const product = getProductBySku(sku);
    if (!product) return;

    const existing = cart.find(item => item.sku === sku);
    if (existing) {
        existing.quantity += quantity;
    } else {
        cart.push({ sku, quantity });
    }

    saveCart();
    renderCart();

    if (openDrawerAfter) openCart();
}

function decreaseFromCart(sku) {
    const item = cart.find(cartItem => cartItem.sku === sku);
    if (!item) return;

    item.quantity -= 1;
    if (item.quantity <= 0) {
        cart = cart.filter(cartItem => cartItem.sku !== sku);
    }

    saveCart();
    renderCart();
}

function removeFromCart(sku) {
    cart = cart.filter(item => item.sku !== sku);
    saveCart();
    renderCart();
}

/* =========================================================
   VML-14 — CAMADA DE CATÁLOGO
   ========================================================= */

function normalizeCatalogText(value) {
    return String(value ?? '')
        .trim()
        .toLocaleLowerCase('pt-BR');
}

function getCatalogCategories() {
    return [
        ...new Set(
            catalogProducts
                .map(product => product.category)
                .filter(Boolean)
        )
    ].sort((a, b) =>
        String(a).localeCompare(
            String(b),
            'pt-BR'
        )
    );
}

function getCatalogSources() {
    return catalogSources
        .filter(source => source?.visible !== false)
        .sort((a, b) =>
            String(a.name || a.id || '')
                .localeCompare(
                    String(b.name || b.id || ''),
                    'pt-BR'
                )
        );
}

async function refreshCatalog() {
    const [
        loadedProducts,
        loadedSources
    ] = await Promise.all([
        loadProducts(),
        loadSources()
    ]);

    catalogProducts = Array.isArray(loadedProducts)
        ? loadedProducts
        : [];

    catalogSources = Array.isArray(loadedSources)
        ? loadedSources
        : [];

    products = catalogProducts;

    return catalogProducts;
}

async function getCatalogResults() {
    const filters = {
        category:
            catalogCategory === 'todos'
                ? ''
                : catalogCategory,

        sourceId:
            catalogSourceId === 'todos'
                ? ''
                : catalogSourceId,

        page: catalogPage,
        pageSize: CATALOG_PAGE_SIZE,

        sort: catalogSort,
        query: catalogSearch
    };

    return searchProducts(
        catalogProducts,
        filters
    );
}

function renderFilters() {
    if (!filtersEl) {
        return;
    }

    const categories =
        getCatalogCategories();

    const sources =
        getCatalogSources();

    filtersEl.innerHTML = `
        <div class="catalog-filter-group">
            <button
                type="button"
                class="active"
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
        </div>

        ${
            sources.length
                ? `
                    <div class="catalog-source-filter">
                        <label for="catalogSourceFilter">
                            Fornecedor
                        </label>

                        <select
                            id="catalogSourceFilter"
                            class="catalog-source-select"
                        >
                            <option value="todos">
                                Todos os fornecedores
                            </option>

                            ${sources.map(source => `
                                <option
                                    value="${escapeAttribute(source.id)}"
                                >
                                    ${escapeHTML(
                                        source.name ||
                                        source.id
                                    )}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                `
                : ''
        }
    `;

    const sourceSelect =
        filtersEl.querySelector(
            '#catalogSourceFilter'
        );

    sourceSelect?.addEventListener(
        'change',
        event => {
            catalogSourceId =
                event.target.value || 'todos';

            catalogPage = 1;

            renderCatalog();
        }
    );

    filtersEl
        .querySelectorAll(
            'button[data-category]'
        )
        .forEach(button => {
            button.classList.toggle(
                'active',
                button.dataset.category ===
                    catalogCategory
            );

            button.addEventListener(
                'click',
                () => {
                    catalogCategory =
                        button.dataset.category ||
                        'todos';

                    catalogPage = 1;

                    renderFilters();
                    renderCatalog();
                }
            );
        });
}

function renderPagination(
    totalItems
) {
    if (!paginationEl) {
        return;
    }

    const totalPages = Math.max(
        1,
        Math.ceil(
            totalItems /
            CATALOG_PAGE_SIZE
        )
    );

    if (catalogPage > totalPages) {
        catalogPage = totalPages;
    }

    if (totalPages <= 1) {
        paginationEl.innerHTML = '';
        return;
    }

    const buttons = [];

    buttons.push(`
        <button
            type="button"
            class="pagination-button"
            data-page="${catalogPage - 1}"
            ${catalogPage === 1 ? 'disabled' : ''}
            aria-label="Página anterior"
        >
            Anterior
        </button>
    `);

    const start = Math.max(
        1,
        catalogPage - 2
    );

    const end = Math.min(
        totalPages,
        start + 4
    );

    for (
        let page = start;
        page <= end;
        page += 1
    ) {
        buttons.push(`
            <button
                type="button"
                class="pagination-button ${
                    page === catalogPage
                        ? 'active'
                        : ''
                }"
                data-page="${page}"
                aria-current="${
                    page === catalogPage
                        ? 'page'
                        : 'false'
                }"
            >
                ${page}
            </button>
        `);
    }

    buttons.push(`
        <button
            type="button"
            class="pagination-button"
            data-page="${catalogPage + 1}"
            ${
                catalogPage === totalPages
                    ? 'disabled'
                    : ''
            }
            aria-label="Próxima página"
        >
            Próxima
        </button>
    `);

    paginationEl.innerHTML =
        buttons.join('');

    paginationEl
        .querySelectorAll(
            'button[data-page]'
        )
        .forEach(button => {
            button.addEventListener(
                'click',
                () => {
                    const page =
                        Number(
                            button.dataset.page
                        );

                    if (
                        !Number.isInteger(page) ||
                        page < 1 ||
                        page > totalPages
                    ) {
                        return;
                    }

                    catalogPage = page;

                    renderCatalog();

                    productsEl?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            );
        });
}

async function renderCatalog() {
    if (!productsEl) {
        return;
    }

    productsEl.innerHTML = `
        <div class="catalog-empty">
            <p>Carregando catálogo...</p>
        </div>
    `;

    try {
        const result =
            await getCatalogResults();

        const items =
            Array.isArray(result)
                ? result
                : (
                    Array.isArray(result?.items)
                        ? result.items
                        : []
                );

        const total =
            Number.isFinite(
                result?.total
            )
                ? result.total
                : items.length;

        products =
            items.length
                ? items
                : products;

        if (!items.length) {
            productsEl.innerHTML = `
                <div class="catalog-empty">
                    <p>
                        Nenhum produto encontrado.
                    </p>
                </div>
            `;

            renderPagination(0);
            return;
        }

        productsEl.innerHTML =
            items.map(product => {
                const image =
                    product.image
                        ? `
                            <img
                                class="product-image"
                                src="${escapeAttribute(
                                    product.image
                                )}"
                                alt="${escapeAttribute(
                                    product.name
                                )}"
                                loading="lazy"
                            >
                        `
                        : `
                            <div
                                class="product-image-placeholder"
                            >
                                AURÉA
                            </div>
                        `;

                const weight =
                    product.weight
                        ? `
                            <small
                                class="product-weight"
                            >
                                ${escapeHTML(
                                    product.weight
                                )}
                            </small>
                        `
                        : '';

                const source =
                    product.sourceName
                        ? `
                            <small
                                class="product-source"
                            >
                                ${escapeHTML(
                                    product.sourceName
                                )}
                            </small>
                        `
                        : '';

                return `
                    <article
                        class="product"
                        data-product-sku="${escapeAttribute(
                            product.sku
                        )}"
                        tabindex="0"
                        role="button"
                        aria-label="Ver detalhes de ${escapeAttribute(
                            product.name
                        )}"
                    >
                        <div class="product-visual">
                            ${image}

                            <span class="tag">
                                ${escapeHTML(
                                    product.category ||
                                    'Produto'
                                )}
                            </span>
                        </div>

                        <div class="product-info">
                            <h3>
                                ${escapeHTML(
                                    product.name
                                )}
                            </h3>

                            <p>
                                ${escapeHTML(
                                    product.description ||
                                    ''
                                )}
                            </p>

                            ${source}
                            ${weight}

                            <div class="product-bottom">
                                <span class="price">
                                    ${formatCurrency(
                                        product.price
                                    )}
                                </span>

                                <button
                                    class="add"
                                    type="button"
                                    data-add="${escapeAttribute(
                                        product.sku
                                    )}"
                                    aria-label="Adicionar ${escapeAttribute(
                                        product.name
                                    )} à sacola"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    </article>
                `;
            }).join('');

        renderPagination(total);

    } catch (error) {
        console.error(
            'Erro ao renderizar catálogo:',
            error
        );

        productsEl.innerHTML = `
            <div class="catalog-empty">
                <p>
                    Não foi possível carregar o catálogo.
                </p>
            </div>
        `;

        renderPagination(0);
    }
}

/* =========================================================
   SACOLA — RENDER & MODAIS
   ========================================================= */

function renderCart() {
    if (!cartItemsEl) return;

    const validCart = cart.filter(item => getProductBySku(item.sku));
    if (validCart.length !== cart.length) {
        cart = validCart;
        saveCart();
    }

    const totalQuantity = getCartTotalQuantity();

    if (cartCountEl) cartCountEl.textContent = totalQuantity;
    if (cartSummaryEl) {
        cartSummaryEl.textContent = totalQuantity === 1 ? '1 item' : `${totalQuantity} itens`;
    }

    if (!cart.length) {
        cartItemsEl.innerHTML = `<div class="empty">Sua sacola está esperando por você.</div>`;
        if (cartTotalEl) cartTotalEl.textContent = formatCurrency(0);
        return;
    }

    cartItemsEl.innerHTML = cart.map(item => {
        const product = getProductBySku(item.sku);
        if (!product) return '';

        const image = product.image ? `<img src="${escapeAttribute(product.image)}" alt="${escapeAttribute(product.name)}" loading="lazy">` : '';
        const subtotal = product.price * item.quantity;

        return `
            <div class="cart-row">
                <div class="mini">${image}</div>
                <div class="cart-product-info">
                    <h4>${escapeHTML(product.name)}</h4>
                    <small>${formatCurrency(product.price)} cada</small>
                    <div class="quantity-control">
                        <button type="button" data-decrease="${escapeAttribute(product.sku)}">-</button>
                        <span>${item.quantity}</span>
                        <button type="button" data-increase="${escapeAttribute(product.sku)}">+</button>
                    </div>
                    <strong>${formatCurrency(subtotal)}</strong>
                </div>
                <button class="remove" type="button" data-remove="${escapeAttribute(product.sku)}">remover</button>
            </div>
        `;
    }).join('');

    if (cartTotalEl) cartTotalEl.textContent = formatCurrency(getCartTotal());
}

function openCart() {
    cartDrawerEl?.classList.add('open');
    backdropEl?.classList.add('show');
    cartDrawerEl?.setAttribute('aria-hidden', 'false');
}

function closeCart() {
    cartDrawerEl?.classList.remove('open');
    backdropEl?.classList.remove('show');
    cartDrawerEl?.setAttribute('aria-hidden', 'true');
}

function updateModalQuantity() {
    if (!modalQuantityEl) {
        return;
    }

    modalQuantity = Math.max(
        1,
        Number.parseInt(modalQuantity, 10) || 1
    );

    modalQuantityEl.textContent =
        String(modalQuantity);
}

function getProductStock(product) {
    const stock = Number(product?.stock);

    if (!Number.isFinite(stock)) {
        return null;
    }

    return stock;
}

function updateModalStock(product) {
    if (!productModalStockEl) {
        return;
    }

    const stock =
        getProductStock(product);

    if (stock === null) {
        productModalStockEl.textContent =
            'Disponibilidade sob consulta';

        productModalStockEl.removeAttribute(
            'data-stock-state'
        );

        return;
    }

    if (stock <= 0) {
        productModalStockEl.textContent =
            'Produto indisponível';

        productModalStockEl.dataset.stockState =
            'out';

        return;
    }

    productModalStockEl.textContent =
        stock === 1
            ? '1 unidade disponível'
            : `${stock} unidades disponíveis`;

    productModalStockEl.dataset.stockState =
        'available';
}

function updateModalImage(product) {
    if (!productModalImageEl) {
        return;
    }

    const image =
        String(product?.image || '').trim();

    const name =
        String(product?.name || 'Produto').trim();

    productModalImageEl.onerror = () => {
        productModalImageEl.removeAttribute(
            'src'
        );

        productModalImageEl.hidden = true;
        productModalImageEl.alt = '';
    };

    if (!image) {
        productModalImageEl.removeAttribute(
            'src'
        );

        productModalImageEl.hidden = true;
        productModalImageEl.alt = '';

        return;
    }

    productModalImageEl.hidden = false;
    productModalImageEl.alt = name;
    productModalImageEl.src = image;
}

function renderProductModal(product) {
    if (!product) {
        return;
    }

    const category =
        String(product.category || '').trim()
        || 'Produto';

    const name =
        String(product.name || '').trim()
        || 'Produto';

    const description =
        String(product.description || '').trim()
        || 'Descrição não informada.';

    const weight =
        String(product.weight || '').trim()
        || 'Peso não informado';

    if (productModalCategoryEl) {
        productModalCategoryEl.textContent =
            category;
    }

    if (productModalTitleEl) {
        productModalTitleEl.textContent =
            name;
    }

    if (productModalDescriptionEl) {
        productModalDescriptionEl.textContent =
            description;
    }

    if (productModalWeightEl) {
        productModalWeightEl.textContent =
            weight;
    }

    if (productModalPriceEl) {
        const price =
            Number(product.price);

        productModalPriceEl.textContent =
            Number.isFinite(price)
                ? formatCurrency(price)
                : formatCurrency(0);
    }

    updateModalStock(product);
    updateModalImage(product);
    updateModalQuantity();

    if (modalAddToCartButton) {
        const stock =
            getProductStock(product);

        const unavailable =
            stock !== null &&
            stock <= 0;

        modalAddToCartButton.disabled =
            unavailable;

        modalAddToCartButton.textContent =
            unavailable
                ? 'Indisponível'
                : 'Adicionar à sacola';
    }
}

function openProductModal(
    sku,
    triggerElement = null
) {
    const normalizedSku =
        String(sku || '').trim();

    if (
        !normalizedSku ||
        !productModalEl
    ) {
        return;
    }

    const product =
        getProductBySku(
            normalizedSku
        );

    if (!product) {
        console.error(
            'Produto não encontrado para o SKU:',
            normalizedSku
        );

        return;
    }

    selectedProductSku =
        normalizedSku;

    modalQuantity = 1;

    if (triggerElement) {
        lastProductTriggerEl =
            triggerElement;
    }

    renderProductModal(product);

    productModalEl.classList.add(
        'open'
    );

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

    if (productModalStockEl) {
        productModalStockEl.removeAttribute(
            'data-stock-state'
        );
    }

    if (modalAddToCartButton) {
        modalAddToCartButton.disabled =
            false;

        modalAddToCartButton.textContent =
            'Adicionar à sacola';
    }

    const trigger =
        lastProductTriggerEl;

    lastProductTriggerEl = null;

    requestAnimationFrame(() => {
        if (
            trigger &&
            document.contains(trigger) &&
            typeof trigger.focus === 'function'
        ) {
            trigger.focus();
        }
    });
}

function increaseModalQuantity() {
    if (!selectedProductSku) {
        return;
    }

    modalQuantity =
        Math.max(
            1,
            (
                Number.parseInt(
                    modalQuantity,
                    10
                ) || 1
            ) + 1
        );

    updateModalQuantity();
}

function decreaseModalQuantity() {
    if (!selectedProductSku) {
        return;
    }

    modalQuantity =
        Math.max(
            1,
            (
                Number.parseInt(
                    modalQuantity,
                    10
                ) || 1
            ) - 1
        );

    updateModalQuantity();
}

function addModalProductToCart() {
    if (!selectedProductSku) {
        return;
    }

    const product =
        getProductBySku(
            selectedProductSku
        );

    if (!product) {
        closeProductModal();
        return;
    }

    const stock =
        getProductStock(product);

    if (
        stock !== null &&
        stock <= 0
    ) {
        return;
    }

    const quantity =
        Math.max(
            1,
            Number.parseInt(
                modalQuantity,
                10
            ) || 1
        );

    addToCart(
        selectedProductSku,
        quantity,
        false
    );

    closeProductModal();
    openCart();
}

// Evento de Clique nas Categorias
filtersEl?.addEventListener('click', event => {
    const button = event.target.closest('button[data-category]');
    if (!button) return;

    filtersEl.querySelectorAll('button').forEach(item => item.classList.remove('active'));
    button.classList.add('active');

    currentCategory = button.dataset.category || 'todos';
    currentPage = 1;
    renderProducts();
});

// Evento de Busca por Texto
searchInputEl?.addEventListener('input', event => {
        catalogSearch = searchInputEl.value.trim();
        catalogPage = 1;
    currentSearchQuery = event.target.value;
    currentPage = 1;
    renderProducts();
});

// Evento de Ordenação por Preço/Nome
sortSelectEl?.addEventListener('change', event => {
    currentSortOption = event.target.value;
    currentPage = 1;
    renderProducts();
});

// Evento de Clique na Paginação estilo Google
paginationEl?.addEventListener('click', event => {
    const button = event.target.closest('button[data-page]');
    if (!button || button.disabled) return;

    currentPage = Number(button.dataset.page);
    renderProducts();

    window.scrollTo({
        top: productsEl.offsetTop - 80,
        behavior: 'smooth'
    });
});

productsEl?.addEventListener('click', event => {
    const addButton = event.target.closest('[data-add]');
    if (addButton) {
        event.stopPropagation();
        addToCart(addButton.dataset.add);
        return;
    }

    const productCard = event.target.closest('[data-product-sku]');
    if (productCard) {
        openProductModal(productCard.dataset.productSku, productCard);
    }
});

cartItemsEl?.addEventListener('click', event => {
    const increaseButton = event.target.closest('[data-increase]');
    if (increaseButton) return addToCart(increaseButton.dataset.increase, 1, false);

    const decreaseButton = event.target.closest('[data-decrease]');
    if (decreaseButton) return decreaseFromCart(decreaseButton.dataset.decrease);

    const removeButton = event.target.closest('[data-remove]');
    if (removeButton) removeFromCart(removeButton.dataset.remove);
});

document.querySelector('#openCart')?.addEventListener('click', openCart);
document.querySelector('#closeCart')?.addEventListener('click', closeCart);
backdropEl?.addEventListener('click', closeCart);
closeProductModalButton?.addEventListener('click', closeProductModal);
productModalBackdropEl?.addEventListener('click', closeProductModal);
modalIncreaseButton?.addEventListener('click', () => { modalQuantity += 1; updateModalQuantity(); });
modalDecreaseButton?.addEventListener('click', () => { if (modalQuantity > 1) { modalQuantity -= 1; updateModalQuantity(); } });
modalAddToCartButton?.addEventListener('click', () => {
    if (selectedProductSku) {
        addToCart(selectedProductSku, modalQuantity, false);
        closeProductModal();
        openCart();
    }
});

document.querySelector('#checkout')?.addEventListener('click', () => {
    if (!cart.length) {
        alert('Adicione algum produto primeiro.');
        return;
    }
    window.location.href = 'pages/checkout.html';
});

/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

async function init() {
    try {
        cart = loadCart();

        await refreshCatalog();

        renderCart();

    } catch (error) {
        console.error('Erro ao inicializar aplicação:', error);

        if (productsEl) {
            productsEl.innerHTML = `
                <div class="catalog-error">
                    <h3>Não foi possível carregar o catálogo.</h3>
                    <p>Tente atualizar a página.</p>
                </div>
            `;
        }
    }
}

init();






