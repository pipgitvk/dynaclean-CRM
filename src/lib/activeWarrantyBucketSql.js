import { normalizeWarrantyBucket } from "@/lib/serviceBeforeInstallationFilters";
import {
  EXPIRED_WARRANTY_SQL,
  IN_WARRANTY_SQL,
  WARRANTY_EXPIRING_30_DAYS_SQL,
} from "@/lib/serviceBeforeInstallationQueries";

export function buildActiveWarrantyBucketWhereSql(warrantyBucket) {
  const b = normalizeWarrantyBucket(warrantyBucket) || "active";
  if (b === "expiring_30") {
    return { sql: ` AND (${WARRANTY_EXPIRING_30_DAYS_SQL})`, params: [] };
  }
  if (b === "expired") {
    return { sql: ` AND (${EXPIRED_WARRANTY_SQL})`, params: [] };
  }
  return { sql: ` AND (${IN_WARRANTY_SQL})`, params: [] };
}

export function activeWarrantyBucketBaseSql(warrantyBucket) {
  const b = normalizeWarrantyBucket(warrantyBucket) || "active";
  if (b === "expiring_30") return WARRANTY_EXPIRING_30_DAYS_SQL;
  if (b === "expired") return EXPIRED_WARRANTY_SQL;
  return IN_WARRANTY_SQL;
}