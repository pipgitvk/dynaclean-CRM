import { normalizeAmcBucket } from "@/lib/serviceBeforeInstallationFilters";

export const ACTIVE_AMC_SQL = `(
  LOWER(TRIM(status)) = 'approved'
  AND amc_end_datetime IS NOT NULL
  AND DATE(amc_end_datetime) >= CURDATE()
)`;

export const AMC_EXPIRING_30_DAYS_SQL = `(
  LOWER(TRIM(status)) = 'approved'
  AND amc_end_datetime IS NOT NULL
  AND DATE(amc_end_datetime) >= CURDATE()
  AND DATE(amc_end_datetime) <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
)`;

export const EXPIRED_AMC_SQL = `(
  LOWER(TRIM(status)) = 'approved'
  AND amc_end_datetime IS NOT NULL
  AND DATE(amc_end_datetime) < CURDATE()
)`;

export const DUE_AMC_SQL = `(
  LOWER(TRIM(status)) = 'approved'
  AND amc_end_datetime IS NOT NULL
  AND (
    DATE(amc_end_datetime) < CURDATE()
    OR DATE(amc_end_datetime) <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
  )
)`;

export function activeAmcBucketBaseSql(amcBucket) {
  const b = normalizeAmcBucket(amcBucket) || "active";
  if (b === "expiring_30") return AMC_EXPIRING_30_DAYS_SQL;
  if (b === "expired") return EXPIRED_AMC_SQL;
  return ACTIVE_AMC_SQL;
}