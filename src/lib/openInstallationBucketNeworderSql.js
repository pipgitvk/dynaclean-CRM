import { sqlTrimUtf8EqColumns } from "@/lib/sqlUtf8Compare";
import {
  NO_ACTUALLY_DELIVERED_SQL,
  NO_DELIVERY_PENDING_AFTER_DISPATCH_SQL,
} from "@/lib/openInstallationKpiSql";
import { NO_MISSING_INSTALLATION_REPORT_ON_ORDER_SQL } from "@/lib/openInstallationNoReportSql";

/**
 * Narrow {@code neworder} before dispatch/service aggregates when a KPI bucket is active.
 */
export function buildNeworderOpenInstallationBucketWhereSql(openInstallationBucket) {
  const b = String(openInstallationBucket || "").trim().toLowerCase();
  if (!b) return "";

  if (b === "delivery_pending") {
    return `AND ${NO_DELIVERY_PENDING_AFTER_DISPATCH_SQL}`;
  }
  if (b === "delivered_pending") {
    return `AND COALESCE(no.installation_status, 0) = 0 AND (${NO_ACTUALLY_DELIVERED_SQL})`;
  }
  if (b === "completed") {
    return `AND (
      COALESCE(no.installation_status, 0) = 1
      OR EXISTS (
        SELECT 1
        FROM dispatch d_ob
        INNER JOIN service_records sr_ob
          ON ${sqlTrimUtf8EqColumns("sr_ob.serial_number", "d_ob.serial_no")}
        WHERE ${sqlTrimUtf8EqColumns("d_ob.quote_number", "no.quote_number")}
          AND UPPER(TRIM(COALESCE(sr_ob.service_type, ''))) = 'INSTALLATION'
          AND UPPER(TRIM(COALESCE(sr_ob.status, ''))) = 'COMPLETED'
      )
    )`;
  }
  if (b === "no_feedback") {
    return `AND ${NO_MISSING_INSTALLATION_REPORT_ON_ORDER_SQL}`;
  }
  return "";
}