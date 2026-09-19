const permissions = {
    super_admin: {
        dashboard: ["read"],
        orders: ["read", "write"],
        products: ["read", "write"],
        categories: ["read", "write"],
        inventory: ["read", "write"],
        customers: ["read", "write"],
        finance: ["read"],
        coupons: ["read", "write"],
        logistics: ["read", "write"],
        reports: ["read"],
        audit: ["read"],
        settings: ["read", "write"]
    },

    operator: {
        dashboard: ["read"],
        orders: ["read", "write"],
        products: ["read", "write"],
        categories: ["read"],
        inventory: ["read", "write"],
        customers: ["read", "write"],
        finance: ["read"],
        coupons: ["read"],
        logistics: ["read", "write"],
        reports: ["read"],
        audit: [],
        settings: []
    }
};

function can(role, module, action) {
    return Boolean(
        permissions[role]?.[module]?.includes(action)
    );
}

module.exports = {
    permissions,
    can
};
