/**
 * Schedule time used for follow-up card colouring (matches HiringEntryCard logic).
 * Prefers rescheduled_at / next_followup_at when status matches, else interview_at.
 */
export function getScheduleMsForFollowUpCard(row) {
  const st = String(row?.status || "").trim();
  if (st === "Rescheduled" && row.rescheduled_at) {
    const ms = new Date(row.rescheduled_at).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (st === "Hired" && String(row?.tag || "").trim() === "Follow-Up") {
    if (row.next_followup_at) {
      const ms = new Date(row.next_followup_at).getTime();
      return Number.isFinite(ms) ? ms : null;
    }
    if (row.hire_date) {
      const ms = new Date(row.hire_date).getTime();
      return Number.isFinite(ms) ? ms : null;
    }
  }
  if ((st === "next-follow-up" || st === "follow-up") && row.next_followup_at) {
    const ms = new Date(row.next_followup_at).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (row.interview_at) {
    const ms = new Date(row.interview_at).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

/** Hours until the relevant schedule time (negative = overdue). */
export function getHoursUntilSchedule(row) {
  const ms = getScheduleMsForFollowUpCard(row);
  if (ms == null) return null;
  return (ms - Date.now()) / 3600000;
}

/** Flat mid-tones — no near-white stops (avoids washed-out cards). */
const SLATE_FALLBACK =
  "linear-gradient(165deg, rgb(100, 116, 138) 0%, rgb(118, 132, 152) 100%)";

const TRAFFIC_RED =
  "linear-gradient(165deg, rgb(198, 105, 105) 0%, rgb(175, 88, 88) 100%)";

const TRAFFIC_YELLOW =
  "linear-gradient(165deg, rgb(200, 155, 70) 0%, rgb(185, 140, 58) 100%)";

const TRAFFIC_GREEN =
  "linear-gradient(165deg, rgb(72, 145, 108) 0%, rgb(58, 128, 95) 100%)";

/**
 * Discrete dashboard colours: red (soon/overdue), yellow (medium), green (later).
 * Thresholds: ≤24h or overdue → red; 24–72h → yellow; &gt;72h → green.
 */
export function getTrafficGradientForHours(hours) {
  if (hours == null || Number.isNaN(hours)) {
    return SLATE_FALLBACK;
  }
  if (hours < 0 || hours <= 24) {
    return TRAFFIC_RED;
  }
  if (hours <= 72) {
    return TRAFFIC_YELLOW;
  }
  return TRAFFIC_GREEN;
}

export const HIRING_URGENCY_LEGEND = [
  {
    key: "red",
    label: "Red",
    dotClass: "bg-gradient-to-r from-rose-400 to-rose-200",
  },
  {
    key: "yellow",
    label: "Yellow",
    dotClass: "bg-gradient-to-r from-amber-400 to-amber-200",
  },
  {
    key: "green",
    label: "Green",
    dotClass: "bg-gradient-to-r from-emerald-400 to-emerald-200",
  },
];
