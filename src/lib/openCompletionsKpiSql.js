/** Map KPI breakdown fields to open-completions table bucket. */
export function openCompletionsBucketRecordCount(bucket, breakdown = {}) {
  const b = String(bucket || "")
    .trim()
    .toLowerCase();
  if (b === "pending") return Number(breakdown.pending_complaint ?? 0);
  if (b === "planned") return Number(breakdown.planned_complaint ?? 0);
  if (b === "completed") return Number(breakdown.completed_complaint ?? 0);
  if (b === "pending_by_customer") return Number(breakdown.pending_by_customer ?? 0);
  if (b === "pending_for_spares") return Number(breakdown.pending_for_spares ?? 0);
  if (b === "pending_over_48h_no_plan") return Number(breakdown.pending_over_48h_no_plan ?? 0);
  return Number(breakdown.total_complaints_registered ?? 0);
}