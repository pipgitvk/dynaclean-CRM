export function normalizeProductKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function shipmentLookupKeys(shipment) {
  const keys = [];
  const code = normalizeProductKey(shipment?.product_code);
  const name = normalizeProductKey(shipment?.item_name);
  if (code) keys.push(code);
  if (name) keys.push(name);
  return keys;
}

export function productRowLookupKeys(row) {
  const keys = [];
  const code = normalizeProductKey(row?.product_code);
  const name = normalizeProductKey(row?.item_name);
  if (code) keys.push(code);
  if (name) keys.push(name);
  return keys;
}

/** Latest shipment per product (shipments sorted newest first). */
export function buildLatestShipmentMap(shipments) {
  const map = {};
  for (const shipment of shipments || []) {
    for (const key of shipmentLookupKeys(shipment)) {
      if (!map[key]) {
        map[key] = {
          expected_arrival_date: shipment.expected_arrival_date,
          qty: shipment.qty,
          status: shipment.status,
        };
      }
    }
  }
  return map;
}

export function findShipmentFromMap(row, map) {
  for (const key of productRowLookupKeys(row)) {
    if (map[key]) return map[key];
  }
  return null;
}

export function findRelatedIncomingShipment(shipments, product) {
  const code = normalizeProductKey(product?.product_code);
  const name = normalizeProductKey(product?.item_name);
  return (shipments || []).find((ship) => {
    const shipCode = normalizeProductKey(ship.product_code);
    const shipName = normalizeProductKey(ship.item_name);
    return (
      (code && shipCode && shipCode === code) ||
      (name && shipName && shipName === name)
    );
  });
}
