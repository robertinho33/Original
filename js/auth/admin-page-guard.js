import { waitForAdminAuth, observeAdminAuth, logoutAdmin } from './admin-auth.js';

try {
    await waitForAdminAuth();
    document.documentElement.removeAttribute('data-admin-pending');
    observeAdminAuth(user => {
        if (!user) window.location.replace('/index.html');
    });
} catch {
    window.location.replace('/index.html');
}
document.addEventListener('click', async event => {
    if (!event.target.closest('#adminLogout')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
        await logoutAdmin();
        window.location.replace('/pages/admin-login.html');
    } catch {
        alert('Não foi possível sair. Tente novamente.');
    }
}, true);
