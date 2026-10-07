const PRODUCT_IMAGE_SELECTOR = '.product-image, .mini img, .checkout-item-image img, #productModalImage';

export function installProductImageFallbacks() {
    if (window.__productImageFallbacksInstalled) return;
    window.__productImageFallbacksInstalled = true;

    document.addEventListener('error', event => {
        const image = event.target;
        if (!(image instanceof HTMLImageElement) || !image.matches(PRODUCT_IMAGE_SELECTOR)) return;

        const label = image.alt ? 'Foto indisponível: ' + image.alt : 'Foto do produto indisponível';
        const placeholder = document.createElement('div');
        placeholder.className = 'product-image-placeholder product-image-fallback';
        placeholder.setAttribute('role', 'img');
        placeholder.setAttribute('aria-label', label);
        placeholder.textContent = 'Imagem indisponível';

        if (image.id === 'productModalImage') {
            const container = image.closest('.product-modal-image');
            if (!container) return;
            image.hidden = true;
            let modalPlaceholder = container.querySelector('.product-modal-image-fallback');
            if (!modalPlaceholder) {
                modalPlaceholder = placeholder;
                modalPlaceholder.classList.add('product-modal-image-fallback');
                container.append(modalPlaceholder);
            }
            return;
        }

        image.replaceWith(placeholder);
    }, true);
}
