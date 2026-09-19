const MODULES = [
    "dashboard",
    "orders",
    "products",
    "categories",
    "inventory",
    "customers",
    "finance",
    "coupons",
    "logistics",
    "reports",
    "audit",
    "settings"
];

function getPermissions(role) {
    if (role === "super_admin") {
        return Object.fromEntries(
            MODULES.map(module => [module, {
                read: true,
                write: true
            }])
        );
    }

    return Object.fromEntries(
        MODULES.map(module => [module, {
            read: module !== "settings",
            write: [
                "orders",
                "products",
                "inventory",
                "logistics"
            ].includes(module)
        }])
    );
}

module.exports = {
    MODULES,
    getPermissions
};
