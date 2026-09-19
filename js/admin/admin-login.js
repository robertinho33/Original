const TOKEN_KEY = "aurea-admin-token";

const form = document.querySelector("#adminLoginForm");
const input = document.querySelector("#adminToken");
const button = document.querySelector("#adminLoginButton");
const message = document.querySelector("#adminLoginError");

function showMessage(text, type = "error") {
    if (!message) {
        return;
    }

    message.textContent = text;
    message.dataset.type = type;
    message.hidden = false;
}

function clearMessage() {
    if (!message) {
        return;
    }

    message.textContent = "";
    message.hidden = true;
}

function setLoading(loading) {
    if (!button) {
        return;
    }

    button.disabled = loading;
    button.textContent = loading
        ? "Autenticando..."
        : "Entrar";
}

async function authenticate(token) {

    const response = await fetch(
        "https://aurea-pix-api.onrender.com/api/admin/dashboard",
        {
            method: "GET",

            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json"
            },

            cache: "no-store"
        }
    );

    const contentType =
        response.headers.get("content-type") || "";

    const text = await response.text();

    let data;

    if (contentType.includes("application/json")) {

        try {
            data = JSON.parse(text);
        } catch {
            throw new Error(
                "O servidor retornou JSON inválido."
            );
        }

    } else {

        console.error(
            "[AUREA ADMIN] Resposta não JSON:",
            text.slice(0, 500)
        );

        throw new Error(
            "O servidor administrativo não retornou JSON."
        );
    }

    if (!response.ok || data.success === false) {

        throw new Error(
            data.error ||
            data.message ||
            "Token administrativo inválido."
        );
    }

    return data;
}

form?.addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        clearMessage();

        const token =
            input?.value?.trim() || "";

        if (!token) {

            showMessage(
                "Informe o token administrativo."
            );

            return;
        }

        setLoading(true);

        try {

            await authenticate(token);

            localStorage.setItem(
                TOKEN_KEY,
                token
            );

            window.location.replace(
                "./admin.html"
            );

        } catch (error) {

            console.error(
                "[AUREA ADMIN] Falha na autenticação:",
                error
            );

            showMessage(
                error?.message ||
                "Não foi possível autenticar."
            );

            setLoading(false);
        }
    }
);
