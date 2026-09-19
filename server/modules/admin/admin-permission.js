const { can } =
    require("./services/admin-operation-permissions");

function requirePermission(module, action) {
    return (req, res, next) => {
        const role =
            req.admin?.role || "super_admin";

        if (!can(role, module, action)) {
            return res.status(403).json({
                success: false,
                error: "Permissão insuficiente."
            });
        }

        next();
    };
}

module.exports = {
    requirePermission
};
