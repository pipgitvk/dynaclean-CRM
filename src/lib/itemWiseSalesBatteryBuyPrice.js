/**
 * Item Wise Sales buy price.
 * Battery accessory package_status "added" → add that spare's buy price.
 * package_status "available" → leave the machine buy price unchanged.
 */

export function isBatteryName(value) {
  return String(value || "").toLowerCase().includes("battery");
}

export function isBatteryAccessory(accessory) {
  return isBatteryName(accessory?.accessory_name) || isBatteryName(accessory?.spare_name);
}

export function spareKey(accessory) {
  const id = accessory?.spare_id;
  if (id != null && String(id).trim() !== "") return `id:${String(id).trim()}`;
  const name = String(accessory?.spare_name || accessory?.accessory_name || "")
    .trim()
    .toLowerCase();
  return name ? `name:${name}` : "";
}

function toMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Final unit buy price for one machine line.
 * Only battery accessories with package_status "added" are included.
 */
export function finalMachineBuyPrice(machineBuyPrice, accessories, priceBySpareKey) {
  const base = toMoney(machineBuyPrice);
  const seen = new Set();
  let extra = 0;

  for (const accessory of accessories || []) {
    if (String(accessory?.package_status || "") !== "added") continue;
    if (!isBatteryAccessory(accessory)) continue;

    const key = spareKey(accessory);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const nameKey = `name:${String(accessory?.spare_name || "").trim().toLowerCase()}`;
    const price = toMoney(
      priceBySpareKey?.has(key)
        ? priceBySpareKey.get(key)
        : priceBySpareKey?.get(nameKey),
    );
    if (price <= 0) continue;
    const qty = Number(accessory?.qty) > 0 ? Number(accessory.qty) : 1;
    extra += price * qty;
  }

  return base + extra;
}

export function rowMatchesBatterySpare(row, accessory) {
  const code = String(row?.item_code || "").trim().toLowerCase();
  const name = String(row?.item_name || row?.model || "").trim().toLowerCase();
  const spareNumber = String(accessory?.spare_number ?? "").trim().toLowerCase();
  const spareId = String(accessory?.spare_id ?? "").trim().toLowerCase();
  const spareName = String(accessory?.spare_name || "").trim().toLowerCase();
  const accessoryName = String(accessory?.accessory_name || "").trim().toLowerCase();

  if (spareNumber && code === spareNumber) return true;
  if (spareId && code === spareId) return true;
  if (spareName && (name === spareName || code === spareName)) return true;
  if (accessoryName && (name === accessoryName || code === accessoryName)) return true;
  return false;
}
