let previousTrigger = null;
export function closeOrderModal() {
    const modal = document.getElementById('adminOrderModal');
    if (!modal) return;
    if (modal.contains(document.activeElement)) document.activeElement?.blur();
    modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true'); modal.setAttribute('inert', '');
    previousTrigger?.focus();
}
document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (target?.closest('[data-order-details]')) previousTrigger = target.closest('[data-order-details]');
    if (target?.closest('[data-close-order-modal]')) { event.preventDefault(); closeOrderModal(); }
});
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.getElementById('adminOrderModal')?.classList.contains('is-open')) { event.preventDefault(); closeOrderModal(); }
});
