/** Requested, cumulative received, and pending qty for warehouse-in lines. */
export function warehouseInQtyFields(item) {
  const requested = Number(item?.quantity) || 0;
  const received = Number(item?.received_quantity) || 0;
  const remaining = Math.max(0, requested - received);
  return { requested, received, remaining };
}

export function defaultReceiveQtyString(item) {
  const { remaining } = warehouseInQtyFields(item);
  return remaining > 0 ? String(remaining) : "";
}
