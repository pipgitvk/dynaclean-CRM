import { sqlTrimUtf8EqColumns } from "@/lib/sqlUtf8Compare";
import { dispatchSerialEligibleForInstallation } from "@/lib/upcomingInstallationOrderEligibility";
import {
  DELIVERY_STATUS_FULL,
  DELIVERY_STATUS_PARTIAL,
} from "@/lib/orderDeliveryStatus";
import { ensureServiceReportStepsTable } from "@/lib/ensureServiceReportStepsTable";

/**
 * Create INSTALLATION service_records (videos null) for delivered product serials.
 * Skips serials that already have an open installation job.
 *
 * @param {import("mysql2/promise").Connection | import("mysql2/promise").Pool} conn
 * @param {string} orderId
 */
export async function autoCreateInstallationRequestsOnDelivery(conn, orderId) {
  const trimmedOrderId = String(orderId || "").trim();
  if (!trimmedOrderId) return { inserted: 0, skipped: 0 };

  const [orderRows] = await conn.execute(
    `SELECT delivery_status FROM neworder WHERE order_id = ? LIMIT 1`,
    [trimmedOrderId],
  );
  const deliveryStatus = Number(orderRows?.[0]?.delivery_status);
  if (
    deliveryStatus !== DELIVERY_STATUS_FULL &&
    deliveryStatus !== DELIVERY_STATUS_PARTIAL
  ) {
    return { inserted: 0, skipped: 0 };
  }

  await ensureServiceReportStepsTable();

  const dispatchEligibility =
    deliveryStatus === DELIVERY_STATUS_FULL
      ? `
    AND COALESCE(no.delivery_status, 0) IN (1, 2)
    AND COALESCE(d.stock_deducted, 0) = 1`
      : dispatchSerialEligibleForInstallation("d", "no");

  const [rows] = await conn.execute(
    `SELECT DISTINCT TRIM(d.serial_no) AS serial_number
     FROM neworder no
     INNER JOIN dispatch d
       ON CONVERT(d.quote_number USING utf8mb3) COLLATE utf8mb3_unicode_ci = no.quote_number
     INNER JOIN warranty_products wp
       ON ${sqlTrimUtf8EqColumns("wp.serial_number", "d.serial_no")}
     WHERE BINARY no.order_id = BINARY ?
       AND d.serial_no IS NOT NULL
       AND TRIM(d.serial_no) <> ''
       AND EXISTS (
         SELECT 1 FROM products_list pl2
         WHERE ${sqlTrimUtf8EqColumns("pl2.item_code", "d.item_code")}
       )
       ${dispatchEligibility}`,
    [trimmedOrderId],
  );

  let inserted = 0;
  let skipped = 0;

  for (const row of rows || []) {
    const serial = String(row.serial_number || "").trim();
    if (!serial) {
      skipped += 1;
      continue;
    }

    const [existing] = await conn.execute(
      `SELECT UPPER(TRIM(COALESCE(status, ''))) AS status
       FROM service_records
       WHERE TRIM(serial_number) = TRIM(?)
         AND UPPER(TRIM(COALESCE(service_type, ''))) = 'INSTALLATION'`,
      [serial],
    );

    const hasOpen = (existing || []).some((r) => {
      const st = String(r.status || "").toUpperCase();
      return st !== "COMPLETED" && st !== "CANCELLED";
    });
    if (hasOpen) {
      skipped += 1;
      continue;
    }

    const [ins] = await conn.execute(
      `INSERT INTO service_records
         (serial_number, service_type, complaint_date, complaint_summary, status, assigned_to)
       VALUES (?, 'INSTALLATION', CURDATE(), ?, 'PENDING', 'NOT ASSIGNED')`,
      [serial, "Scheduled for Installation"],
    );
    const serviceId = ins?.insertId;
    if (!serviceId) {
      skipped += 1;
      continue;
    }

    await conn.execute(
      `INSERT IGNORE INTO service_report_steps (service_id, video_360, video_problem, video_damaged, video_completion)
       VALUES (?, NULL, NULL, NULL, NULL)`,
      [serviceId],
    );

    inserted += 1;
  }

  return { inserted, skipped };
}