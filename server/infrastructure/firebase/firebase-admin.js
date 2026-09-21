"use strict";

const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

let firestore = null;

function getAdminFirestore() {
    if (firestore) {
        return firestore;
    }

    const apps = getApps();

    if (apps.length === 0) {
        const serviceAccountJson =
            process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

        if (!serviceAccountJson) {
            throw new Error(
                "FIREBASE_SERVICE_ACCOUNT_JSON não configurada."
            );
        }

        let serviceAccount;

        try {
            serviceAccount = JSON.parse(serviceAccountJson);
        } catch {
            throw new Error(
                "FIREBASE_SERVICE_ACCOUNT_JSON inválida."
            );
        }

        initializeApp({
            credential: cert(serviceAccount)
        });
    }

    firestore = getFirestore();

    return firestore;
}

module.exports = {
    getFirestore: getAdminFirestore
};
