const repository = require("../repositories/admin-order-repository");

async function getOrderDetails(id) {
    return repository.getOrderDetails(id);
}

async function updateOrderStatus(id, status) {
    const allowed = [
        "pending",
        "paid",
        "processing",
        "shipped",
        "delivered",
        "cancelled"
    ];

    if (!allowed.includes(status)) {
        throw new Error("Status de pedido inválido.");
    }

    return repository.updateOrderStatus(id, status);
}

module.exports = {
    getOrderDetails,
    updateOrderStatus
};
