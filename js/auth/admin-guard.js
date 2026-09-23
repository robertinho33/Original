'use strict';

import { auth } from '../firebase-config.js';

import {
    onAuthStateChanged,
    signOut
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const MASTER_EMAIL = 'robertinho33@gmail.com';

export function isAuthorizedAdmin(user) {
    return Boolean(
        user?.email &&
        user.email.trim().toLowerCase() === MASTER_EMAIL
    );
}

export function waitForAuthorizedAdmin() {
    return new Promise((resolve, reject) => {

        const unsubscribe = onAuthStateChanged(
            auth,
            user => {

                unsubscribe();

                if (!isAuthorizedAdmin(user)) {

                    window.location.replace(
                        './admin-login.html'
                    );

                    reject(
                        new Error(
                            'Usuário não autorizado.'
                        )
                    );

                    return;
                }

                resolve(user);
            },
            error => {
                reject(error);
            }
        );
    });
}

export async function logoutAdmin() {

    await signOut(auth);

    window.location.replace(
        './admin-login.html'
    );
}

export { MASTER_EMAIL };
