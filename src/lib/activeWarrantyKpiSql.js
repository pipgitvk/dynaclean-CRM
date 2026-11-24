/** Estimate list total from KPI breakdown for the selected active-warranty card. */
export function activeWarrantyBucketRecordCount(warrantyBucket, breakdown = {}) {
  const b = String(warrantyBucket || "active").trim().toLowerCase();
  if (b === "expiring_30") return Number(breakdown.expiring_30_days ?? 0);
  if (b === "expired") return Number(breakdown.expired_warranty ?? 0);
  return Number(breakdown.active_warranty ?? 0);
}