const transitions = {
    pending: [
        "awaiting_payment",
        "cancelled"
    ],

    awaiting_payment: [
        "paid",
        "cancelled"
    ],

    paid: [
        "processing",
        "cancelled"
    ],

    processing: [
        "ready",
        "cancelled"
    ],

    ready: [
        "shipped"
    ],

    shipped: [
        "delivered"
    ],

    delivered: [],

    cancelled: []
};

function canTransition(from, to) {
    if (from === to) return true;

    return Boolean(
        transitions[from]?.includes(to)
    );
}

module.exports = {
    transitions,
    canTransition
};
