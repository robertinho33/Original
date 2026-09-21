const orderRepository =
    require("../repositories/admin-order-repository");

const historyRepository =
    require("../repositories/commercial-history-repository");

async function details(req, res) {
    try {
        const orderId = String(req.params.id || "").trim();

        if (!orderId) {
            return res.status(400).json({
                success: false,
                error: "ID do pedido não informado."
            });
        }

        const order =
            await orderRepository.getOrderById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                error: "Pedido não encontrado."
            });
        }

        const [
            items,
            payments,
            shipment
        ] = await Promise.all([
            orderRepository.getOrderItems(orderId),
            orderRepository.getOrderPayments(orderId),
            orderRepository.getOrderShipment(orderId)
        ]);

        let history = [];

        try {
            history =
                await historyRepository.getOrderHistory(orderId);
        } catch (historyError) {
            console.warn(
                "[ADMIN ORDERS] Histórico indisponível:",
                historyError.message
            );
        }

        return res.json({
            success: true,
            data: {
                order,
                items,
                payments,
                shipment,
                history
            }
        });

    } catch (error) {
        console.error(
            "[ADMIN ORDERS] Erro ao consultar pedido:",
            error
        );

        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

module.exports = {
    details
};
