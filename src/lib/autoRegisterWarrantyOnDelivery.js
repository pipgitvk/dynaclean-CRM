import { sqlTrimUtf8EqColumns } from "@/lib/sqlUtf8Compare";
import { dispatchSerialEligibleForInstallation } from "@/lib/upcomingInstallationOrderEligibility";
import {
  DELIVERY_STATUS_FULL,
  DELIVERY_STATUS_PARTIAL,
} from "@/lib/orderDeliveryStatus";
import { STANDARD_WARRANTY_PERIOD_MONTHS } from "@/lib/warrantyDefaults";
import { normalizeAutoWarrantyProductRow } from "@/lib/autoWarrantyFieldNormalize";

export const AUTO_WARRANTY_REGISTERED_BY = "Automatic";

/**
 * Insert warranty_products for product dispatch lines on this order that are
 * delivery-eligible and not yet registered (runs on each delivery save).
 *
 * @param {import("mysql2/promise").Connection | import("mysql2/promise").Pool} conn
 * @param {string} orderId
 */
export async function autoRegisterWarrantyProductsOnDelivery(conn, orderId) {
  const trimmedOrderId = String(orderId || "").trim();
  if (!trimmedOrderId) return { inserted: 0, skipped: 0 };

  const [orderRows] = await conn.execute(
    `SELECT order_id, quote_number, delivery_status, delivery_proof, delivered_on, delivery_location
     FROM neworder WHERE order_id = ? LIMIT 1`,
    [trimmedOrderId],
  );
  const order = orderRows?.[0];
  if (!order) return { inserted: 0, skipped: 0 };

  const deliveryStatus = Number(order.delivery_status);
  if (
    deliveryStatus !== DELIVERY_STATUS_FULL &&
    deliveryStatus !== DELIVERY_STATUS_PARTIAL
  ) {
    return { inserted: 0, skipped: 0 };
  }

  const dispatchEligibility =
    deliveryStatus === DELIVERY_STATUS_FULL
      ? `
    AND COALESCE(no.delivery_status, 0) IN (1, 2)
    AND COALESCE(d.stock_deducted, 0) = 1`
      : dispatchSerialEligibleForInstallation("d", "no");

  const [rows] = await conn.execute(
    `SELECT
       d.id AS dispatch_id,
       d.serial_no AS serial_number,
       COALESCE(NULLIF(TRIM(qi.item_name), ""), d.item_name) AS product_name,
       COALESCE(NULLIF(TRIM(qi.item_code), ""), d.item_code) AS model,
       qi.specification AS specification,
       COALESCE(qr.gstin, '') AS gstin,
       COALESCE(no.state, qr.state, '') AS state,
       no.company_name AS customer_name,
       COALESCE(NULLIF(TRIM(no.email), ''), NULLIF(TRIM(cust.email), '')) AS email,
       no.client_name AS contact_person,
       no.contact AS contact,
       COALESCE(NULLIF(TRIM(no.company_address), ''), NULLIF(TRIM(no.delivery_location), '')) AS customer_address,
       no.delivery_location AS delivery_location,
       no.invoice_number AS invoice_number,
       no.invoice_date AS invoice_date,
       no.delivered_on AS delivered_on,
       no.delivery_proof AS delivery_proof
     FROM neworder no
     JOIN dispatch d
       ON CONVERT(d.quote_number USING utf8mb3) COLLATE utf8mb3_unicode_ci = no.quote_number
     LEFT JOIN quotation_items qi
       ON ${sqlTrimUtf8EqColumns("qi.quote_number", "no.quote_number")}
      AND ${sqlTrimUtf8EqColumns("qi.item_code", "d.item_code")}
     LEFT JOIN quotations_records qr
       ON qr.quote_number = no.quote_number
     LEFT JOIN customers cust ON cust.customer_id = qr.customer_id
     LEFT JOIN warranty_products wp
       ON wp.serial_number = CONVERT(d.serial_no USING utf8mb3) COLLATE utf8mb3_unicode_ci
     WHERE BINARY no.order_id = BINARY ?
       AND wp.serial_number IS NULL
       AND EXISTS (
         SELECT 1 FROM products_list pl2
         WHERE ${sqlTrimUtf8EqColumns("pl2.item_code", "d.item_code")}
       )
       AND d.serial_no IS NOT NULL
       AND TRIM(d.serial_no) <> ''
       ${dispatchEligibility}
     ORDER BY d.id ASC`,
    [trimmedOrderId],
  );

  let inserted = 0;
  let skipped = 0;
  const now = new Date();

  const insertSql = `INSERT INTO warranty_products
    (product_name, specification, model, serial_number, gstin, warranty_period,
     customer_name, email, contact, customer_address, state, invoice_number,
     invoice_date, invoice_file, report_file, quantity, contact_person,
     created_by, created_at, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  for (const rawRow of rows || []) {
    const row = {
      ...rawRow,
      delivery_location:
        rawRow.delivery_location ?? order.delivery_location ?? null,
      delivered_on: rawRow.delivered_on ?? order.delivered_on ?? null,
    };
    const normalized = normalizeAutoWarrantyProductRow(row, trimmedOrderId);
    if (!normalized) {
      skipped += 1;
      continue;
    }

    const values = [
      normalized.product_name,
      normalized.specification,
      normalized.model,
      normalized.serial_number,
      normalized.gstin || "",
      STANDARD_WARRANTY_PERIOD_MONTHS,
      normalized.customer_name,
      normalized.email,
      normalized.contact,
      normalized.customer_address,
      normalized.state || "",
      normalized.invoice_number,
      normalized.invoice_date,
      null,
      null,
      1,
      normalized.contact_person,
      AUTO_WARRANTY_REGISTERED_BY,
      now,
      null,
      null,
    ].map((v) => (v === undefined ? null : v));

    try {
      await conn.execute(insertSql, values);
      inserted += 1;
    } catch (err) {
      if (err?.code === "ER_DUP_ENTRY") {
        skipped += 1;
        continue;
      }
      throw err;
    }
  }

  return { inserted, skipped };
}