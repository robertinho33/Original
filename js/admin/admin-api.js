import { db } from "../firebase-config.js";
import { 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    addDoc, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * Mapeamento das rotas da API REST para as Coleções do Firebase Firestore
 */
const ROUTE_TO_COLLECTION = {
    "/products": "products",
    "/categories": "categories",
    "/inventory": "products", // O estoque usa a coleção de produtos
    "/orders": "orders",
    "/customers": "customers",
    "/finance": "finance",
    "/coupons": "coupons",
    "/logistics": "logistics",
    "/reports": "reports",
    "/audit": "audit_logs",
    "/settings": "settings"
};

/**
 * Utilitário para extrair o nome da coleção e o ID a partir da rota REST (ex: "/products/123")
 */
function parseEndpoint(endpoint) {
    const cleanPath = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const parts = cleanPath.split("/").filter(Boolean);
    const route = `/${parts[0] || ""}`;
    
    const collectionName = ROUTE_TO_COLLECTION[route] || parts[0];
    const docId = parts[1] || null;

    return { collectionName, docId };
}

// Objeto Global AdminAPI compatível com todos os módulos do painel
window.AdminAPI = {
    /**
     * GET: Busca todos os documentos ou um documento específico
     */
    async get(endpoint) {
        try {
            const { collectionName, docId } = parseEndpoint(endpoint);

            if (!collectionName) throw new Error("Coleção não especificada.");

            // Se um ID foi fornecido (ex: /products/sku123)
            if (docId) {
                const docRef = doc(db, collectionName, docId);
                const snapshot = await getDoc(docRef);
                if (!snapshot.exists()) return null;
                return { id: snapshot.id, ...snapshot.data() };
            }

            // Busca todos os documentos da coleção
            const querySnapshot = await getDocs(collection(db, collectionName));
            const data = [];
            querySnapshot.forEach((docSnapshot) => {
                data.push({ id: docSnapshot.id, ...docSnapshot.data() });
            });

            return data;
        } catch (error) {
            console.error(`[AdminAPI] Erro ao buscar dados [GET ${endpoint}]:`, error);
            throw error;
        }
    },

    /**
     * POST: Adiciona um novo documento na coleção
     */
    async post(endpoint, body = {}) {
        try {
            const { collectionName } = parseEndpoint(endpoint);
            if (!collectionName) throw new Error("Coleção não especificada.");

            // Se for enviado com SKU ou ID próprio, usa como chave do documento
            const customId = body.id || body.sku;
            if (customId) {
                const docRef = doc(db, collectionName, String(customId));
                await setDoc(docRef, body, { merge: true });
                return { id: String(customId), ...body };
            }

            // Cria um novo ID automático do Firestore
            const docRef = await addDoc(collection(db, collectionName), body);
            return { id: docRef.id, ...body };
        } catch (error) {
            console.error(`[AdminAPI] Erro ao salvar dados [POST ${endpoint}]:`, error);
            throw error;
        }
    },

    /**
     * PUT: Atualiza um documento existente
     */
    async put(endpoint, body = {}) {
        try {
            const { collectionName, docId } = parseEndpoint(endpoint);
            const targetId = docId || body.id || body.sku;

            if (!collectionName || !targetId) {
                throw new Error("Coleção ou ID do documento não informado.");
            }

            const docRef = doc(db, collectionName, String(targetId));
            await updateDoc(docRef, body);
            return { id: String(targetId), ...body };
        } catch (error) {
            console.error(`[AdminAPI] Erro ao atualizar dados [PUT ${endpoint}]:`, error);
            throw error;
        }
    },

    /**
     * DELETE: Remove um documento da coleção
     */
    async delete(endpoint) {
        try {
            const { collectionName, docId } = parseEndpoint(endpoint);

            if (!collectionName || !docId) {
                throw new Error("Coleção ou ID do documento não informado.");
            }

            const docRef = doc(db, collectionName, String(docId));
            await deleteDoc(docRef);
            return { success: true, id: docId };
        } catch (error) {
            console.error(`[AdminAPI] Erro ao excluir dados [DELETE ${endpoint}]:`, error);
            throw error;
        }
    }
};

console.log("[ADMIN] AdminAPI conectada com sucesso ao Firebase Firestore!");