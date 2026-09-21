import { auth } from "../firebase-config.js";
import { 
    signInWithEmailAndPassword, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const form = document.getElementById("adminLoginForm");
const tokenInput = document.getElementById("adminToken");
const errorDiv = document.getElementById("adminLoginError");

const MASTER_EMAIL = "robertinho33@gmail.com";

if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        if (errorDiv) {
            errorDiv.hidden = true;
            errorDiv.textContent = "";
        }

        const password = tokenInput ? tokenInput.value : "";

        try {
            const userCredential = await signInWithEmailAndPassword(auth, MASTER_EMAIL, password);

            if (userCredential.user.email !== MASTER_EMAIL) {
                if (errorDiv) {
                    errorDiv.textContent = "Acesso restrito ao administrador Master.";
                    errorDiv.hidden = false;
                }
                return;
            }

            console.log("[LOGIN] Autenticado com sucesso no Firebase Auth!");
            window.location.href = "admin.html";
        } catch (error) {
            console.error("[LOGIN] Erro ao autenticar:", error);
            if (errorDiv) {
                errorDiv.textContent = "Token/Senha inválido ou não autorizado.";
                errorDiv.hidden = false;
            }
        }
    });
}

onAuthStateChanged(auth, (user) => {
    if (user && user.email === MASTER_EMAIL) {
        console.log("[AUTH] Usuário Master ativo:", user.email);
    } else {
        console.warn("[AUTH] Nenhum usuário autorizado ativo. Realize o login no painel.");
    }
});