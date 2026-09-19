const repository = require("../repositories/admin-write-repository");

module.exports = {
    updateProduct: (id, data) =>
        repository.updateProduct(id, data),

    updateOrderStatus: (id, status) =>
        repository.updateOrderStatus(id, status),

    createInventoryMovement: (data) =>
        repository.createInventoryMovement(data),

    updateShipment: (id, data) =>
        repository.updateShipment(id, data),

    updateSettings: (data) =>
        repository.updateSettings(data)
};
