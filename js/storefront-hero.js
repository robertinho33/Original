const apiRoot = window.location.protocol === 'file:'
    ? 'http://localhost:3000'
    : '';

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
            if (campaign.buttonUrl) button.href = campaign.buttonUrl;
        }

        const image = document.getElementById('heroCampaignImage');
        const card = image?.closest('.hero-card');
        if (image && campaign.imageUrl) {
            image.src = campaign.imageUrl;
            image.alt = campaign.imageAlt || campaign.title || 'Banner da campanha NEFER';
            image.hidden = false;
            card?.classList.add('has-campaign-image');
        }
    } catch (error) {
        console.info('[STOREFRONT] Mantendo o banner padrão:', error?.message || error);
    }
}

loadCampaignHero();
