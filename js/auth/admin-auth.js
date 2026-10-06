'use strict';

import { auth } from '../firebase-config.js';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const MASTER_EMAIL = 'robertinho33@gmail.com';

export function isMasterUser(user) {
    return Boolean(user?.email && user.email.toLowerCase() === MASTER_EMAIL);
}

export async function hasAdminAccess(user) {
    if (isMasterUser(user)) return true;
    if (!user?.email || typeof user.getIdTokenResult !== 'function') return false;
    const token = await user.getIdTokenResult();
    return token.claims?.admin === true || ['admin', 'collaborator'].includes(String(token.claims?.role || '').toLowerCase());
}

export async function loginAdmin(email, password) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail || !password) throw new Error('Informe e-mail e senha.');
    const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
    if (!(await hasAdminAccess(credential.user))) {
        await signOut(auth);
        throw new Error('Usuário sem autorização administrativa.');
    }
    return credential.user;
}

export async function logoutAdmin() {
    await signOut(auth);
}

export function observeAdminAuth(callback) {
    return onAuthStateChanged(auth, async user => {
        if (!user) {
            callback(null);
            return;
        }
        if (!(await hasAdminAccess(user))) {
            await signOut(auth);
            callback(null);
            return;
        }
        callback(user);
    });
}

export function getCurrentAdmin() {
    const user = auth.currentUser;
    return user && isMasterUser(user) ? user : null;
}

export async function waitForAdminAuth() {
    const currentUser = auth.currentUser;
    if (currentUser && await hasAdminAccess(currentUser)) return currentUser;

    return new Promise((resolve, reject) => {
        let unsubscribe = null;
        unsubscribe = onAuthStateChanged(auth, async user => {
            if (unsubscribe) unsubscribe();
            if (user && await hasAdminAccess(user)) {
                resolve(user);
                return;
            }
            reject(new Error('Sessão administrativa não encontrada.'));
        });
    });
}

export async function getAdminIdToken(forceRefresh = false) {
    const user = await waitForAdminAuth();
    return user.getIdToken(forceRefresh);
}
