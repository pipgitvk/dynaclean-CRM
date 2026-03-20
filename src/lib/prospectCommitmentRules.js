/** Calendar rules for prospect commitment + final submit (India business day). */
export const PROSPECT_COMMITMENT_TZ = "Asia/Kolkata";

/** Today as YYYY-MM-DD in Asia/Kolkata. */
export function getTodayYmdIST() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: PROSPECT_COMMITMENT_TZ,
  });
}

/**
 * Last calendar day of the month before the commitment month.
 * e.g. 2026-05-15 → 2026-04-30 (final submit allowed through that date, IST).
 */
export function getFinalSubmitDeadlineYmd(commitmentYmd) {
  if (!commitmentYmd || !/^\d{4}-\d{2}-\d{2}$/.test(commitmentYmd)) return null;
  const [y, m] = commitmentYmd.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return null;
  }
  const last = new Date(y, m - 1, 0);
  const yy = last.getFullYear();
  const mm = String(last.getMonth() + 1).padStart(2, "0");
  const dd = String(last.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function compareYmd(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Optional commitment on create: if set, must be today or later (IST). */
export function validateCommitmentDateForCreate(
  commitmentRawTrimmed,
  todayYmd = getTodayYmdIST(),
) {
  const s = String(commitmentRawTrimmed ?? "").trim();
  if (!s) return { ok: true };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { ok: false, code: "commitment_invalid" };
  if (compareYmd(s, todayYmd) < 0) return { ok: false, code: "commitment_past" };
  return { ok: true };
}

/**
 * Final submit: allowed if no commitment, else commitment not in past (IST)
 * and today is on or before last day of month before commitment month.
 */
export function canFinalSubmitWithCommitment(
  commitmentRawTrimmed,
  todayYmd = getTodayYmdIST(),
) {
  const s = String(commitmentRawTrimmed ?? "").trim();
  if (!s) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  if (compareYmd(s, todayYmd) < 0) return false;
  const deadline = getFinalSubmitDeadlineYmd(s);
  if (!deadline) return false;
  return compareYmd(todayYmd, deadline) <= 0;
}

/** Display helper for deadline / commitment (calendar date, local formatting). */
export function formatYmdLongEnIN(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  const local = new Date(y, m - 1, d);
  if (Number.isNaN(local.getTime())) return ymd;
  return local.toLocaleDateString("en-IN", { dateStyle: "long" });
}
