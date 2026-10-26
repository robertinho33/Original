"use strict";

const {
    getFirestore
} = require("../../../infrastructure/firebase/firebase-admin");

const COLLECTION = "influencers";
const {introducedDuplicate}=require("../../../../js/influencer-identity");

function db() {
    return getFirestore();
}

function normalizeText(value) {
    return String(value ?? "").trim();
}

function normalizeCommission(value) {
    const number = Number(value ?? 0);

    if (!Number.isFinite(number) || number < 0) {
        return 0;
    }

    if (number > 100) {
        return 100;
    }

    return number;
}

function normalizeInfluencer(data = {}) {
    const name = normalizeText(data.name);

    if (!name) {
        throw new Error(
            "Nome do influenciador é obrigatório."
        );
    }

    return {
        name,
        email: normalizeText(data.email),
        phone: normalizeText(data.phone),
        pixKey: normalizeText(data.pixKey).slice(0, 160),

        active:
            data.active !== undefined
                ? Boolean(data.active)
                : true,

        commissionDefault:
            normalizeCommission(
                data.commissionDefault ??
                data.commission ??
                0
            )
    };
}

async function listInfluencers() {
    const snapshot =
        await db()
            .collection(COLLECTION)
            .get();

    return snapshot.docs
        .map(doc => ({
            ...doc.data(),
            id: doc.id
        }))
        .sort((a, b) =>
            String(a.name || "")
                .localeCompare(
                    String(b.name || ""),
                    "pt-BR"
                )
        );
}

async function getInfluencer(id) {
    if (!id) {
        throw new Error(
            "ID do influenciador é obrigatório."
        );
    }

    const reference =
        db()
            .collection(COLLECTION)
            .doc(id);

    const snapshot =
        await reference.get();

    if (!snapshot.exists) {
        throw new Error(
            "Influenciador não encontrado."
        );
    }

    return {
        id: snapshot.id,
        ...snapshot.data()
    };
}

async function saveInfluencer(database, id, data = {}) {
    const collection=database.collection(COLLECTION);
    const reference=id?collection.doc(id):collection.doc();
    // Every create/update locks the same document before checking legacy and new rows.
    const lock=database.collection('settings').doc('influencer-write-lock');
    return database.runTransaction(async tx=>{
        await tx.get(lock);
        const snapshot=await tx.get(collection);
        const rows=snapshot.docs.map(doc=>({...doc.data(),id:doc.id}));
        const current=id?rows.find(row=>row.id===id):null;
        if(id&&!current)throw Error('Influenciador não encontrado.');
        const influencer=normalizeInfluencer({...current,...data,commissionDefault:data.commissionDefault??data.commission??current?.commissionDefault??current?.commission??0});
        const duplicate=introducedDuplicate(rows,influencer,current);
        if(duplicate)throw Error('Já existe um influenciador com esse e-mail ou com o mesmo nome e telefone: '+duplicate.name+'. Edite o cadastro existente.');
        const now=new Date().toISOString();
        const document={...influencer,updatedAt:now,...(!id?{createdAt:now}:{})};
        tx.set(lock,{updatedAt:now,version:require('node:crypto').randomBytes(16).toString('hex')});
        if(id)tx.update(reference,document);else tx.set(reference,document);
        return {...current,...document,id:reference.id};
    });
}
async function createInfluencer(data = {}) {return saveInfluencer(db(),null,data);}
async function updateInfluencer(id, data = {}) {
    if(!id)throw Error('ID do influenciador é obrigatório.');
    return saveInfluencer(db(),id,data);
}

async function deleteInfluencer(id) {
    if (!id) {
        throw new Error(
            "ID do influenciador é obrigatório."
        );
    }

    const reference =
        db()
            .collection(COLLECTION)
            .doc(id);

    const snapshot =
        await reference.get();

    if (!snapshot.exists) {
        throw new Error(
            "Influenciador não encontrado."
        );
    }

    await reference.delete();

    return {
        id,
        deleted: true
    };
}

module.exports = {
    saveInfluencer,
    listInfluencers,
    getInfluencer,
    createInfluencer,
    updateInfluencer,
    deleteInfluencer
};
