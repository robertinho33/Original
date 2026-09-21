import { auth } from "../firebase-config.js";
import { 
    signInWithEmailAndPassword, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const form = document.getElementById("adminLoginForm");
const emailInput = document.getElementById("adminEmail");
const passwordInput = document.getElementById("adminPassword");
const errorDiv = document.getElementById("adminLoginError");

const MASTER_EMAIL = "robertinho33@gmail.com";

if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        if (errorDiv) {
            errorDiv.hidden = true;
            errorDiv.textContent = "";
        }

        const email = emailInput ? emailInput.value.trim() : "";
        const password = passwordInput ? passwordInput.value : "";

        // Validação preventiva antes de enviar ao Firebase
        if (!password) {
            if (errorDiv) {
                errorDiv.textContent = "Por favor, digite a senha.";
                errorDiv.hidden = false;
            }
            return;
        }

        if (email !== MASTER_EMAIL) {
            if (errorDiv) {
                errorDiv.textContent = "Acesso permitido apenas para o usuário master.";
                errorDiv.hidden = false;
            }
            return;
        }

        try {
            await signInWithEmailAndPassword(auth, email, password);
            console.log("[LOGIN] Autenticado com sucesso como Master!");
            window.location.href = "admin.html";
        } catch (error) {
            console.error("[LOGIN] Erro ao autenticar:", error);
            if (errorDiv) {
                if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password") {
                    errorDiv.textContent = "Senha incorreta.";
                } else if (error.code === "auth/user-not-found") {
                    errorDiv.textContent = "Usuário não encontrado no Firebase Auth.";
                } else {
                    errorDiv.textContent = "Erro ao fazer login: " + error.message;
                }
                errorDiv.hidden = false;
            }
        }
    });
}

// Observador de estado de autenticação
onAuthStateChanged(auth, (user) => {
    if (user && user.email === MASTER_EMAIL) {
        console.log("[AUTH] Sessão Master ativa para:", user.email);
    } else {
        console.warn("[AUTH] Nenhum usuário autorizado ativo. Realize o login no painel.");
    }
});