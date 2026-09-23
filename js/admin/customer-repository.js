'use strict';

import { db } from '../firebase-config.js';

import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    limit,
    addDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
    normalizeCustomer,
    normalizeCustomerEmail,
    normalizeCustomerPhone,
    validateCustomer
} from './customer-model.js';


const CUSTOMERS_COLLECTION = 'customers';


function customerCollection() {

    return collection(
        db,
        CUSTOMERS_COLLECTION
    );

}


export async function getCustomer(customerId) {

    if (!customerId) {
        return null;
    }

    const snapshot = await getDoc(
        doc(
            db,
            CUSTOMERS_COLLECTION,
            customerId
        )
    );

    if (!snapshot.exists()) {
        return null;
    }

    return normalizeCustomer({
        ...snapshot.data(),
        id: snapshot.id
    });

}


export async function findCustomerByEmail(email) {

    const normalizedEmail =
        normalizeCustomerEmail(email);

    if (!normalizedEmail) {
        return null;
    }

    const customerQuery = query(
        customerCollection(),
        where(
            'normalizedEmail',
            '==',
            normalizedEmail
        ),
        limit(1)
    );

    const snapshot =
        await getDocs(customerQuery);

    if (snapshot.empty) {
        return null;
    }

    const customerDocument =
        snapshot.docs[0];

    return normalizeCustomer({
        ...customerDocument.data(),
        id: customerDocument.id
    });

}


export async function findCustomerByPhone(phone) {

    const normalizedPhone =
        normalizeCustomerPhone(phone);

    if (!normalizedPhone) {
        return null;
    }

    const customerQuery = query(
        customerCollection(),
        where(
            'normalizedPhone',
            '==',
            normalizedPhone
        ),
        limit(1)
    );

    const snapshot =
        await getDocs(customerQuery);

    if (snapshot.empty) {
        return null;
    }

    const customerDocument =
        snapshot.docs[0];

    return normalizeCustomer({
        ...customerDocument.data(),
        id: customerDocument.id
    });

}


export async function createCustomer(customerData) {

    const customer =
        normalizeCustomer(customerData);

    validateCustomer(customer);

    const existing =
        await findCustomerByEmail(
            customer.email
        );

    if (existing) {
        return {
            created: false,
            existing: true,
            id: existing.id,
            data: existing
        };
    }

    const documentReference =
        await addDoc(
            customerCollection(),
            {
                ...customer,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            }
        );

    const savedCustomer = {
        ...customer,
        id: documentReference.id
    };

    return {
        created: true,
        existing: false,
        id: documentReference.id,
        data: savedCustomer
    };

}


export async function updateCustomer(
    customerId,
    changes
) {

    if (!customerId) {
        throw new Error(
            'ID do cliente não informado.'
        );
    }

    const existing =
        await getCustomer(customerId);

    if (!existing) {
        throw new Error(
            'Cliente não encontrado.'
        );
    }

    const next =
        normalizeCustomer({
            ...existing,
            ...changes,
            id: customerId,
            updatedAt:
                new Date().toISOString()
        });

    validateCustomer(next);

    await updateDoc(
        doc(
            db,
            CUSTOMERS_COLLECTION,
            customerId
        ),
        {
            ...next,
            updatedAt: serverTimestamp()
        }
    );

    return {
        success: true,
        id: customerId,
        data: next
    };

}


export async function listCustomers(
    maxResults = 100
) {

    const snapshot =
        await getDocs(
            query(
                customerCollection(),
                limit(maxResults)
            )
        );

    return snapshot.docs.map(
        customerDocument =>
            normalizeCustomer({
                ...customerDocument.data(),
                id: customerDocument.id
            })
    );

}


export async function countCustomers() {

    const snapshot =
        await getDocs(
            customerCollection()
        );

    return snapshot.size;

}