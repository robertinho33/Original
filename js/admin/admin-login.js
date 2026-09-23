import {
    loginAdmin,
    observeAdminAuth
} from '../auth/admin-auth.js';

const form =
    document.getElementById('adminLoginForm');

const emailInput =
    document.getElementById('adminEmail');

const passwordInput =
    document.getElementById('adminPassword');

const errorDiv =
    document.getElementById('adminLoginError');

const button =
    document.getElementById('adminLoginButton');

function showError(message) {

    if (!errorDiv) {
        return;
    }

    errorDiv.textContent = message;
    errorDiv.hidden = false;
}

function clearError() {

    if (!errorDiv) {
        return;
    }

    errorDiv.textContent = '';
    errorDiv.hidden = true;
}

if (form) {

    form.addEventListener(
        'submit',
        async event => {

            event.preventDefault();

            clearError();

            const email =
                emailInput?.value.trim() || '';

            const password =
                passwordInput?.value || '';

            if (!email || !password) {

                showError(
                    'Informe e-mail e senha.'
                );

                return;
            }

            if (button) {
                button.disabled = true;
                button.textContent = 'Entrando...';
            }

            try {

                await loginAdmin(
                    email,
                    password
                );

                window.location.replace(
                    './admin.html'
                );

            } catch (error) {

                console.error(
                    '[AUREA AUTH]',
                    error
                );

                showError(
                    error?.message ||
                    'Não foi possível realizar o login.'
                );

                if (button) {
                    button.disabled = false;
                    button.textContent = 'Entrar';
                }
            }
        }
    );
}

observeAdminAuth(user => {

    if (user) {

        console.log(
            '[AUREA AUTH] Administrador autenticado:',
            user.email
        );

        return;
    }

    console.log(
        '[AUREA AUTH] Nenhuma sessão administrativa ativa.'
    );
});
