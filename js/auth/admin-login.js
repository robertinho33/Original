'use strict';

import {
    loginAdmin,
    observeAdminAuth
} from './admin-auth.js';

const elements = {
    form: document.getElementById('adminLoginForm'),
    email: document.getElementById('adminEmail'),
    password: document.getElementById('adminPassword'),
    button: document.getElementById('adminLoginButton'),
    error: document.getElementById('adminLoginError')
};

function showError(message) {
    elements.error.textContent = message;
    elements.error.hidden = false;
}

function clearError() {
    elements.error.textContent = '';
    elements.error.hidden = true;
}

function setLoading(loading) {
    elements.button.disabled = loading;

    elements.button.innerHTML = loading
        ? 'Entrando...'
        : 'Entrar <span>➔</span>';
}

function getFirebaseErrorMessage(error) {
    switch (error?.code) {
        case 'auth/invalid-credential':
            return 'E-mail ou senha incorretos.';

        case 'auth/user-disabled':
            return 'Este usuário está desativado.';

        case 'auth/too-many-requests':
            return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';

        case 'auth/network-request-failed':
            return 'Não foi possível conectar ao Firebase. Verifique sua internet.';

        default:
            return error?.message ||
                'Não foi possível realizar o login.';
    }
}

elements.form.addEventListener('submit', async event => {
    event.preventDefault();

    clearError();

    const email = elements.email.value.trim();
    const password = elements.password.value;

    if (!email || !password) {
        showError('Informe seu e-mail e sua senha.');
        return;
    }

    setLoading(true);

    try {
        await loginAdmin(email, password);

        window.location.replace('./admin.html');

    } catch (error) {
        console.error(
            '[ADMIN AUTH] Erro ao entrar:',
            error
        );

        showError(
            getFirebaseErrorMessage(error)
        );

        setLoading(false);
    }
});

observeAdminAuth(user => {
    if (user) {
        window.location.replace('./admin.html');
    }
});
