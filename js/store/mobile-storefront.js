const narrowScreen = matchMedia('(max-width: 650px)');
const catalog = document.getElementById('colecao');
const influencerDirectory = document.querySelector('.influencer-directory');
const desktopNextSection = catalog.nextElementSibling;

function placeCatalog() {
    const nextSection = narrowScreen.matches ? influencerDirectory : desktopNextSection;
    if (catalog.nextElementSibling === nextSection) return;

    const focused = catalog.contains(document.activeElement) ? document.activeElement : null;
    nextSection.before(catalog);
    focused?.focus({ preventScroll: true });
}

placeCatalog();
narrowScreen.addEventListener('change', placeCatalog);
