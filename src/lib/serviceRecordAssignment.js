/** Whether a service record has a real engineer (not placeholder / empty). */
export function isServiceRecordAssigned(assignedTo) {
  const value = String(assignedTo ?? "").trim();
  if (!value) return false;
  const normalized = value.toUpperCase().replace(/[\s_-]+/g, " ");
  if (normalized === "NOT ASSIGNED") return false;
  return true;
}
