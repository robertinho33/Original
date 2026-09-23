'use strict';

export const CUSTOMER_DEFAULTS = Object.freeze({

    orderCount: 0,

    totalSpent: 0,

    lastOrderAt: null,

    active: true

});


export function normalizeCustomerText(value) {

    return String(value ?? '').trim();

}


export function normalizeCustomerEmail(value) {

    return normalizeCustomerText(value).toLowerCase();

}


export function normalizeCustomerPhone(value) {

    return normalizeCustomerText(value)
        .replace(/\D/g, '');

}


export function createCustomerId() {

    return `CUS-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .slice(2, 8)
        .toUpperCase()}`;

}


export function normalizeCustomer(customer = {}) {

    const now = new Date().toISOString();

    const name = normalizeCustomerText(customer.name);

    const email = normalizeCustomerEmail(customer.email);

    const phone = normalizeCustomerPhone(customer.phone);

    const createdAt =
        customer.createdAt ||
        now;

    return {

        id:
            customer.id ||
            createCustomerId(),

        name,

        email,

        phone,

        normalizedEmail:
            normalizeCustomerEmail(
                customer.normalizedEmail || email
            ),

        normalizedPhone:
            normalizeCustomerPhone(
                customer.normalizedPhone || phone
            ),

        orderCount:
            Number.isFinite(Number(customer.orderCount))
                ? Number(customer.orderCount)
                : CUSTOMER_DEFAULTS.orderCount,

        totalSpent:
            Number.isFinite(Number(customer.totalSpent))
                ? Number(customer.totalSpent)
                : CUSTOMER_DEFAULTS.totalSpent,

        lastOrderAt:
            customer.lastOrderAt ||
            CUSTOMER_DEFAULTS.lastOrderAt,

        active:
            customer.active !== false,

        createdAt,

        updatedAt:
            customer.updatedAt ||
            now

    };

}


export function validateCustomer(customer) {

    if (!customer) {
        throw new Error('Cliente inválido.');
    }

    if (!customer.id) {
        throw new Error('Cliente sem ID.');
    }

    if (!customer.name) {
        throw new Error('Cliente sem nome.');
    }

    if (!customer.email) {
        throw new Error('Cliente sem e-mail.');
    }

    if (!customer.phone) {
        throw new Error('Cliente sem telefone.');
    }

    if (!customer.normalizedEmail) {
        throw new Error('Cliente sem e-mail normalizado.');
    }

    return true;

}