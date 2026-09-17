'use strict';

const auditReader =
  require('../../infrastructure/audit-reader');

function buildOrderTimeline(orderNumber) {
  const events =
    auditReader.getEventsByOrder(
      orderNumber
    );

  return events
    .filter(event =>
      event.type ===
      'ORDER_STATUS_CHANGED'
    )
    .map(event => ({
      from:
        event.data?.from || null,

      to:
        event.data?.to || null,

      actor:
        event.data?.actor || null,

      requestId:
        event.requestId || null,

      createdAt:
        event.createdAt || null
    }));
}

module.exports = {
  buildOrderTimeline
};
