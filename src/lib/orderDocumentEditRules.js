export const MAX_FILES_PER_ORDER_FIELD = 5;

const HOURS_24_MS = 24 * 60 * 60 * 1000;

export function countStoredOrderFiles(currentFileValue = "") {
  return String(currentFileValue || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean).length;
}

export function isBeforeDispatch(order) {
  return Number(order?.dispatch_status) !== 1;
}

export function isBeforeDelivered(order) {
  return Number(order?.delivery_status) !== 1;
}

/** Delivery proof: after dispatch until delivered; or within 24h of delivered_on. */
export function canEditDeliveryProof(order) {
  if (!order) return false;
  if (Number(order.dispatch_status) !== 1) return false;

  if (Number(order.delivery_status) !== 1) {
    return true;
  }

  const deliveredOn = order.delivered_on;
  if (!deliveredOn) return true;

  const deliveredAt = new Date(deliveredOn);
  if (Number.isNaN(deliveredAt.getTime())) return true;

  return Date.now() - deliveredAt.getTime() <= HOURS_24_MS;
}

export function canEditOrderDocumentField(order, fieldKey, currentFileValue = "") {
  switch (fieldKey) {
    case "ewaybill_file":
    case "einvoice_file":
    case "report_file":
      // Allow adding more files until max (even after dispatch)
      return (
        countStoredOrderFiles(currentFileValue) <
        getMaxFilesForField(fieldKey)
      );
      
    case "deliverchallan":
      return isBeforeDelivered(order);
    case "delivery_proof":
      return canEditDeliveryProof(order);
    case "payment_proof":
    case "po_file":
      return true;
    default:
      return false;
  }
}

export function getOrderDocumentEditBlockReason(order, fieldKey, currentFileValue = "") {
  if (canEditOrderDocumentField(order, fieldKey, currentFileValue)) return null;

  switch (fieldKey) {
    case "ewaybill_file":
    case "einvoice_file":
    case "report_file": {
      const max = getMaxFilesForField(fieldKey);
      if (countStoredOrderFiles(currentFileValue) >= max) {
        return `Maximum ${max} files allowed for this document.`;
      }
      return "Upload not allowed.";
    }
      
    case "deliverchallan":
      return "Cannot edit after delivery is marked complete.";
    case "delivery_proof":
      if (Number(order?.delivery_status) === 1) {
        return "Delivery proof can only be edited within 24 hours of delivery.";
      }
      return "Delivery proof can be uploaded after dispatch.";
    default:
      return "Editing is not allowed for this document.";
  }
}

export function getMaxFilesForField(fieldKey) {
  if (fieldKey === "report_file") return MAX_FILES_PER_ORDER_FIELD;
  return MAX_FILES_PER_ORDER_FIELD;
}
