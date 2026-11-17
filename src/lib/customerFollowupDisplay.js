import { isGemRole } from "@/lib/isGemRole";

export function pickNextFollowupField(entry, userRole) {
  if (!entry) return null;
  if (entry.followup_source === "TL") {
    return entry.next_followup_date || null;
  }
  if (userRole === "SERVICE SUPPORT") {
    return entry.service_next_followup || entry.next_followup_date || null;
  }
  if (isGemRole(userRole)) {
    return entry.gem_next_followup || entry.next_followup_date || null;
  }
  return (
    entry.next_followup_date ||
    entry.service_next_followup ||
    entry.gem_next_followup ||
    null
  );
}

/** Newest follow-up row that has a next date (history is usually newest-first). */
export function pickLatestNextFollowupDate(entries = [], userRole = "") {
  for (const entry of entries) {
    const value = pickNextFollowupField(entry, userRole);
    if (value != null && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
}