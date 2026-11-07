const directory = document.getElementById('influencerDirectory');
const status = document.getElementById('influencerDirectoryStatus');
const demoDialog = document.getElementById('influencerDemo');
const demoTitle = document.getElementById('influencerDemoTitle');
const demoProfiles = [
    'Aurora Lunar', 'Brisa de Âmbar', 'Céu de Lavanda', 'Dália Solar', 'Estrela de Chá',
    'Flor de Nuvem', 'Girassol Azul', 'Horizonte Rosa', 'Íris de Mel', 'Jasmim da Lua',
    'Lótus Coral', 'Maré Lilás', 'Névoa de Seda', 'Orquídea do Vento', 'Pétala Dourada',
    'Quartzo Verde', 'Rosa de Algodão', 'Sol de Baunilha', 'Tulipa do Mar', 'Violeta de Papel'
];

function photoFrame(name, imageUrl) {
    const frame = document.createElement('span');
    frame.className = 'influencer-photo';
    frame.setAttribute('aria-hidden', 'true');
    frame.textContent = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('');
    if (imageUrl) {
        const image = document.createElement('img');
        image.src = imageUrl;
        image.alt = '';
        image.width = image.height = 72;
        image.loading = 'lazy';
        image.decoding = 'async';
        image.addEventListener('error', () => image.remove(), { once: true });
        frame.append(image);
    }
    return frame;
}

function realCard(person) {
    const url = new URL(person.url, location.origin);
    if (url.origin !== location.origin || url.pathname !== '/pages/vitrine-influenciador.html' || !url.searchParams.get('loja')) return null;
    let photo = '';
    try {
        const image = new URL(person.image, location.origin);
        if (image.protocol === 'https:' && !image.username && !image.password) {
            photo = ['www.fiosperfeitos.com.br', 'fiosperfeitos.com.br'].includes(image.host)
                ? image.pathname + image.search
                : image.href;
        }
    } catch {}
    const card = document.createElement('a');
    card.className = 'influencer-profile';
    card.href = url.pathname + url.search;
    card.append(photoFrame(person.name, photo), person.name);
    return card;
}

const demos = demoProfiles.map(name => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'influencer-profile influencer-profile-demo';
    const label = document.createElement('small');
    label.textContent = 'Perfil fictício';
    card.append(photoFrame(name), name, label);
    card.addEventListener('click', () => {
        demoTitle.textContent = name;
        demoDialog.showModal();
    });
    return card;
});
directory.append(...demos);

async function loadProfiles() {
    status.textContent = 'Carregando vitrines reais…';
    try {
        const response = await fetch('/api/discovery/influencers', { signal: AbortSignal.timeout(20000) });
        const result = await response.json();
        if (!response.ok || !result.success || !Array.isArray(result.data)) throw new Error();
        const cards = result.data.filter(person => typeof person?.name === 'string' && person.name.trim())
            .map(realCard).filter(Boolean);
        directory.prepend(...cards);
        status.textContent = cards.length
            ? 'Toque na foto para conhecer a seleção de cada influenciador.'
            : 'Nenhuma vitrine real disponível no momento.';
    } catch {
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = 'Tentar novamente';
        retry.addEventListener('click', loadProfiles, { once: true });
        status.replaceChildren('Não foi possível carregar as vitrines reais. ', retry);
    }
}

void loadProfiles();
