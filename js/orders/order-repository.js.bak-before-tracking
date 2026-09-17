'use strict';

import { db } from '../firebase-config.js';
import { 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    collection 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const COLLECTION_NAME = "orders";

export async function saveOrder(order) {
    try {
        await setDoc(doc(db, COLLECTION_NAME, order.id), order);
        return { success: true, id: order.id, data: order };
    } catch (error) {
        console.error("Erro ao salvar pedido no Firestore:", error);
        throw new Error("Não foi possível registrar o pedido no banco de dados.");
    }
}

export async function findOrderById(orderId) {
    if (!orderId) return null;

    try {
        const docRef = doc(db, COLLECTION_NAME, orderId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data();
        }
        return null;
    } catch (error) {
        console.error("Erro ao buscar pedido por ID:", error);
        return null;
    }
}

export async function loadOrders() {
    try {
        const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
        const orders = [];
        querySnapshot.forEach((docSnap) => {
            orders.push(docSnap.data());
        });
        return orders;
    } catch (error) {
        console.error("Erro ao carregar lista de pedidos:", error);
        return [];
    }
}

export async function updateOrder(order) {
    if (!order || !order.id) {
        throw new Error("Pedido inválido para atualização.");
    }

    const existingOrder = await findOrderById(order.id);
    if (!existingOrder) {
        throw new Error("Pedido não encontrado para atualização.");
    }

    return await saveOrder(order);
}