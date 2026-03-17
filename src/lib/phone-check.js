import { getDbConnection } from "@/lib/db";

export function normalizePhone(phone) {
  if (!phone) return "";
  let cleaned = String(phone).replace(/[^\d]/g, "");
  if (cleaned.length > 10) cleaned = cleaned.slice(-10);
  return cleaned;
}

/**
 * Check if phone exists in customers table (contacts are now in customers).
 * Returns { duplicate: true, source: 'customers', customerId?: number } or { duplicate: false }
 */
export async function checkPhoneDuplicate(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length !== 10) return { duplicate: false };

  const conn = await getDbConnection();

  const [custRows] = await conn.execute(
    `SELECT customer_id FROM customers WHERE phone = ? LIMIT 1`,
    [normalized]
  );
  if (custRows.length > 0) {
    return {
      duplicate: true,
      source: "customers",
      customerId: custRows[0].customer_id,
    };
  }

  return { duplicate: false };
}
