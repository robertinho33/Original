"use strict";

const {
    initializeApp,
    getApps,
    cert
} = require("firebase-admin/app");

const {
    getFirestore
} = require("firebase-admin/firestore");

const {
    getAuth
} = require("firebase-admin/auth");

let firebaseApp = null;

function ensureFirebaseAdminApp() {
    if (firebaseApp) {
        return firebaseApp;
    }

    const apps = getApps();

    if (apps.length > 0) {
        firebaseApp = apps[0];
        return firebaseApp;
    }

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

    firebaseApp = initializeApp({
        credential: cert(serviceAccount)
    });

    return firebaseApp;
}

function getAdminFirestore() {
    const app = ensureFirebaseAdminApp();

    return getFirestore(app);
}

function getAdminAuth() {
    const app = ensureFirebaseAdminApp();

    return getAuth(app);
}

module.exports = {
    getFirestore: getAdminFirestore,
    getAuth: getAdminAuth,
    ensureFirebaseAdminApp
};
