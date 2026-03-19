import { getDbConnection } from "@/lib/db";

/** SQL fragment: compares phone column's last 10 digits with ? placeholder. Use for duplicate check. */
export const PHONE_LAST10_WHERE =
  "RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', ''), '(', ''), ')', ''), '.', ''), ',', ''), 10) = ?";

export function normalizePhone(phone) {
  if (!phone) return "";
  let cleaned = String(phone).replace(/[^\d]/g, "");
  if (cleaned.length > 10) cleaned = cleaned.slice(-10);
  return cleaned;
}

/**
 * Check if phone exists in customers table - compares only LAST 10 digits.
 * Handles formats like 9890666272, 09890666272, 919890666272, 91 9890666272, etc.
 * Returns { duplicate: true, source: 'customers', customerId?: number } or { duplicate: false }
 */
export async function checkPhoneDuplicate(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length !== 10) return { duplicate: false };

  const conn = await getDbConnection();

  // Compare last 10 digits only - handles different stored formats (0, 91, +91, etc.)
  const [custRows] = await conn.execute(
    `SELECT customer_id FROM customers WHERE ${PHONE_LAST10_WHERE} LIMIT 1`,
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
