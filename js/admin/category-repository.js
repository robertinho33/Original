import {
    collection,
    getDocs,
    orderBy,
    query
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { db } from "./admin-firestore.js";

const COLLECTION_NAME = "categories";

export async function listCategories() {
    const ref = collection(db, COLLECTION_NAME);

    const snapshot = await getDocs(
        query(ref, orderBy("sortOrder", "asc"))
    );

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

export async function createCategory(category) {
    throw new Error(
        "Use o fluxo de criação da página administrativa."
    );
}