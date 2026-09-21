import { auth } from "../firebase-config.js";
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Função para realizar o login
async function loginAdmin(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        if (userCredential.user.email !== "robertinho33@gmail.com") {
            alert("Acesso restrito ao administrador Master.");
            return;
        }

        console.log("Autenticado com sucesso como Master:", userCredential.user.email);
        window.location.reload(); // Recarrega para aplicar o token nas chamadas da API
    } catch (error) {
        console.error("Erro ao realizar login:", error.message);
    }
}

// Observador para verificar se o usuário já está logado ao carregar a página
onAuthStateChanged(auth, (user) => {
    if (user && user.email === "robertinho33@gmail.com") {
        console.log("[AUTH] Usuário Master ativo:", user.email);
    } else {
        console.warn("[AUTH] Nenhum usuário autorizado ativo. Realize o login no painel.");
    }
});