export function activeAmcBucketRecordCount(amcBucket, breakdown = {}) {
  const b = String(amcBucket || "active").trim().toLowerCase();
  if (b === "expiring_30") return Number(breakdown.expiring_30_days ?? 0);
  if (b === "expired") return Number(breakdown.expired_amc ?? 0);
  return Number(breakdown.active_amc ?? 0);
}