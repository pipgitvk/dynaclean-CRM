/** Meta instant form for Tamil leads — CRM assigns to this employee only */
export const TAMIL_META_FORM_ID = "1402217014975670";
export const TAMIL_META_ASSIGNEE_USERNAME = "KAVYA";

/** Rolling date window for Tamil cron / auto-poll (UTC calendar dates). Safe for client + server. */
export function getTamilCronDateRange(daysBack = 7) {
  const n = Math.max(1, Math.min(30, Number(daysBack) || 7));
  const until = new Date();
  const since = new Date(until);
  since.setUTCDate(since.getUTCDate() - n);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { since: fmt(since), until: fmt(until) };
}
