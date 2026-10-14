const apiRoot = window.location.protocol === 'file:'
    ? 'http://localhost:3000'
    : '';

function safeCampaignUrl(value) {
    try { const url = new URL(value, location.origin); return url.protocol === 'https:' || (url.origin === location.origin && url.protocol === location.protocol) ? url.href : ''; } catch { return ''; }
}
async function loadCampaignHero() {
    try {
        const response = await fetch(`${apiRoot}/api/storefront/hero`, { headers: { Accept: 'application/json' } });
        if (!response.ok) return;
        const result = await response.json();
        const campaign = result?.data;
        if (!result?.success || !campaign) return;

        const setText = (id, value) => {
            if (value) {
                const element = document.getElementById(id);
                if (element) element.textContent = value;
            }
        };
        setText('heroCampaignEyebrow', campaign.eyebrow);
        setText('heroCampaignTitle', campaign.title);
        setText('heroCampaignEmphasis', campaign.emphasis);
        setText('heroCampaignEnding', campaign.ending);
        setText('heroCampaignDescription', campaign.description);

        const button = document.getElementById('heroCampaignButton');
        if (button) {
            if (campaign.buttonLabel) button.firstChild.textContent = campaign.buttonLabel;
            const buttonUrl = safeCampaignUrl(campaign.buttonUrl);
            if (campaign.buttonUrl && buttonUrl) button.href = buttonUrl;
        }

        const image = document.getElementById('heroCampaignImage');
        const card = image?.closest('.hero-card');
        const imageUrl = safeCampaignUrl(campaign.imageUrl);
        if (image && campaign.imageUrl && imageUrl) {
            image.src = imageUrl;
            image.alt = campaign.imageAlt || campaign.title || 'Banner da campanha Fios Perfeitos';
            image.hidden = false;
            card?.classList.add('has-campaign-image');
        }
    } catch (error) {
        console.info('[STOREFRONT] Mantendo o banner padrão:', error?.message || error);
    }
}

loadCampaignHero();
