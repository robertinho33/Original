import {
    collection,
    getDocs,
    query,
    where,
    doc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { db } from "../firebase-config.js";
import { waitForAuthorizedAdmin } from "../auth/admin-guard.js";

const OFFICIAL_CATEGORIES = [
    {
        name: "Ecobelle",
        slug: "ecobelle",
        description: "Produtos Ecobelle",
        sortOrder: 1
    },
    {
        name: "Bela Pro",
        slug: "bela-pro",
        description: "Produtos Bela Pro",
        sortOrder: 2
    },
    {
        name: "Shine Express",
        slug: "shine-express",
        description: "Produtos Shine Express",
        sortOrder: 3
    },
    {
        name: "Industria pra favela",
        slug: "industria-pra-favela",
        description: "Produtos Industria pra favela",
        sortOrder: 4
    },
    {
        name: "EcoBelle Skin",
        slug: "ecobelle-skin",
        description: "Produtos EcoBelle Skin",
        sortOrder: 5
    },
    {
        name: "Sem categoria",
        slug: "sem-categoria",
        description: "Produtos sem categoria definida",
        sortOrder: 6
    }
];

const result = document.getElementById("seedResult");
const button = document.getElementById("createCategories");

function status(message) {
    if (result) {
        result.textContent = message;
    }

    console.log("[AUREA]", message);
}

async function countCategories() {
    const snapshot = await getDocs(
        collection(db, "categories")
    );

    return snapshot.size;
}

async function seedCategories() {
    button.disabled = true;

    try {
        status("Autenticando administrador...");

        await waitForAuthorizedAdmin();

        status("Administrador autorizado. Verificando categorias...");

        const existingSnapshot = await getDocs(
            collection(db, "categories")
        );

        const existingSlugs = new Set(
            existingSnapshot.docs.map(doc => doc.data().slug)
        );

        const missing = OFFICIAL_CATEGORIES.filter(
            category => !existingSlugs.has(category.slug)
        );

        if (!missing.length) {
            const total = await countCategories();

            status(
                `Nenhuma nova categoria necessária. Total no Firestore: ${total}.`
            );

            return;
        }

        status(`Criando ${missing.length} categoria(s)...`);

        const batch = writeBatch(db);

        for (const category of missing) {
            const ref = doc(collection(db, "categories"));

            batch.set(ref, {
                ...category,
                active: true,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        await batch.commit();

        const total = await countCategories();

        status(
            `SUCESSO — ${missing.length} categoria(s) criada(s). Total no Firestore: ${total}.`
        );

        console.log(
            "[AUREA] Categorias oficiais:",
            OFFICIAL_CATEGORIES
        );

    } catch (error) {
        console.error("[AUREA] Erro no seed:", error);

        status(
            `ERRO AO CRIAR CATEGORIAS: ${error.message}`
        );

    } finally {
        button.disabled = false;
    }
}

if (button) {
    button.addEventListener("click", seedCategories);
}

status("Pronto para criar as categorias.");