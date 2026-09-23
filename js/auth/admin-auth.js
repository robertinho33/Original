'use strict';

import { auth } from '../firebase-config.js';

import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const MASTER_EMAIL =
    'robertinho33@gmail.com';

export function isMasterUser(user) {
    if (!user?.email) return false;

    return (
        user.email.toLowerCase() ===
        MASTER_EMAIL
    );
}

export async function loginAdmin(email, password) {

    const normalizedEmail =
        String(email || '')
            .trim()
            .toLowerCase();

    if (!normalizedEmail || !password) {
        throw new Error(
            'Informe e-mail e senha.'
        );
    }

    const credential =
        await signInWithEmailAndPassword(
            auth,
            normalizedEmail,
            password
        );

    if (!isMasterUser(credential.user)) {

        await signOut(auth);

        throw new Error(
            'Usuário sem autorização administrativa.'
        );
    }

    return credential.user;
}

export async function logoutAdmin() {
    await signOut(auth);
}

export function observeAdminAuth(callback) {

    return onAuthStateChanged(
        auth,
        user => {

            if (!user) {
                callback(null);
                return;
            }

            if (!isMasterUser(user)) {

                signOut(auth);

                callback(null);
                return;
            }

            callback(user);
        }
    );
}

export function getCurrentAdmin() {

    const user =
        auth.currentUser;

    if (
        !user ||
        !isMasterUser(user)
    ) {
        return null;
    }

    return user;
}

export function waitForAdminAuth() {

    const currentUser =
        auth.currentUser;

    if (
        currentUser &&
        isMasterUser(currentUser)
    ) {
        return Promise.resolve(
            currentUser
        );
    }

    return new Promise(
        (resolve, reject) => {

            let finished = false;

            const unsubscribe =
                onAuthStateChanged(
                    auth,
                    user => {

                        if (finished) {
                            return;
                        }

                        finished = true;
                        unsubscribe();

                        if (
                            user &&
                            isMasterUser(user)
                        ) {
                            resolve(user);
                            return;
                        }

                        reject(
                            new Error(
                                'Sessão administrativa não encontrada.'
                            )
                        );
                    }
                );
        }
    );
}

export async function getAdminIdToken(
    forceRefresh = false
) {

    const user =
        await waitForAdminAuth();

    return user.getIdToken(
        forceRefresh
    );
}
