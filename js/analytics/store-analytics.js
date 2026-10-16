import {analyticsPage, readConsent, CONSENT_KEY, CONSENT_TTL, createAnalyticsController} from './analytics-policy.js';
import {recordStoreVisit} from './visit-counter.js';

const page = analyticsPage(location.href);
const browserAllows = () => navigator.globalPrivacyControl !== true && navigator.doNotTrack !== '1';
const controller = createAnalyticsController({page, allowed:browserAllows, load:async()=>{
    const [firebase, sdk] = await Promise.all([
        import('../firebase-config.js'),
        import('https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js')
    ]);
    if (!await sdk.isSupported()) return null;
    // Defer initialization too: consent could change during dynamic imports.
    let analytics = null;
    return {
        enable(enabled) {
            if (enabled && !analytics) analytics = sdk.initializeAnalytics(firebase.app, {config:{
                ...page, send_page_view:false, allow_google_signals:false,
                allow_ad_personalization_signals:false, cookie_expires:CONSENT_TTL/1000,
                cookie_flags:'SameSite=Lax;Secure',
                debug_mode:new URL(location.href).searchParams.get('analytics_debug') === '1'
            }});
            if (analytics) sdk.setAnalyticsCollectionEnabled(analytics, enabled);
        },
        pageView(params) { sdk.logEvent(analytics, 'page_view', params); }
    };
}});
function chooseStatistics(value) {
    void controller.choose(value);
    if (value === 'granted' && page && browserAllows()) void recordStoreVisit();
}

function clearAnalyticsCookies() {
    for (const item of document.cookie.split(';')) {
        const name = item.split('=')[0].trim();
        if (name !== '_ga' && !name.startsWith('_ga_')) continue;
        for (const domain of ['',location.hostname,'.'+location.hostname,'.fiosperfeitos.com.br']) {
            document.cookie = name+'=; Max-Age=0; Path=/; SameSite=Lax; Secure'+(domain?'; Domain='+domain:'');
        }
    }
}
let panel = null;
function showPreferences() {
    if (panel) { panel.hidden = false; panel.querySelector('button')?.focus(); return; }
    panel = document.createElement('section');
    panel.className = 'analytics-consent';
    panel.setAttribute('aria-label','Preferências de estatísticas');
    const title = document.createElement('strong'); title.textContent = 'Estatísticas de uso';
    const description = document.createElement('p'); description.textContent = 'Podemos usar o Google Analytics para entender as visitas e melhorar a loja? É opcional e você pode mudar sua escolha depois.';
    const link = document.createElement('a'); link.href = '/pages/privacidade.html'; link.textContent = 'Como usamos seus dados';
    const actions = document.createElement('div'); actions.className = 'analytics-consent-actions';
    for (const [value,label] of [['denied','Recusar'],['granted','Aceitar estatísticas']]) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
        if (value === 'granted' && !browserAllows()) { button.disabled = true; description.textContent = 'Seu navegador pediu para não coletar estatísticas. Essa preferência será respeitada.'; }
        button.addEventListener('click',()=>{
            try { localStorage.setItem(CONSENT_KEY, JSON.stringify({value,savedAt:Date.now()})); } catch { /* Apply the choice for this page even when storage is blocked. */ }
            if (value === 'denied') clearAnalyticsCookies();
            chooseStatistics(value);
            panel.hidden = true;
        });
        actions.append(button);
    }
    panel.append(title,description,link,actions); document.body.append(panel);
}
if (page) {
    const footer = document.querySelector('footer');
    const preferences = document.createElement('button'); preferences.type = 'button'; preferences.className = 'analytics-preferences'; preferences.textContent = 'Preferências de estatísticas';
    preferences.addEventListener('click',showPreferences); (footer || document.body).append(preferences);
    let choice = null; try { choice = readConsent(localStorage.getItem(CONSENT_KEY)); } catch {}
    if (choice) { if (choice === 'denied') clearAnalyticsCookies(); chooseStatistics(choice); }
    else showPreferences();
    window.addEventListener('storage',event=>{
        if (event.key !== CONSENT_KEY && event.key !== null) return;
        const value = readConsent(event.newValue);
        if (value !== 'granted') clearAnalyticsCookies();
        chooseStatistics(value);
    });
}
