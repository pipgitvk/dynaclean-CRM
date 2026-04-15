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
  "linear-gradient(165deg, rgb(108, 122, 144) 0%, rgb(126, 138, 158) 100%)";

/** Darker slate — card outer when schedule is missing (pairs with SLATE_FALLBACK on inner panel). */
const SLATE_OUTER =
  "linear-gradient(165deg, rgb(96, 112, 132) 0%, rgb(112, 128, 144) 100%)";

const TRAFFIC_RED =
  "linear-gradient(165deg, rgb(228, 138, 138) 0%, rgb(212, 122, 122) 100%)";

const TRAFFIC_RED_OUTER =
  "linear-gradient(165deg, rgb(210, 128, 128) 0%, rgb(192, 112, 112) 100%)";

/** Medium-urgency band (24–72h): light blue instead of amber/yellow for clearer contrast with red/green. */
const TRAFFIC_LIGHT_BLUE =
  "linear-gradient(165deg, rgb(138, 192, 235) 0%, rgb(110, 170, 225) 100%)";

const TRAFFIC_LIGHT_BLUE_OUTER =
  "linear-gradient(165deg, rgb(126, 172, 220) 0%, rgb(116, 164, 212) 100%)";

const TRAFFIC_GREEN =
  "linear-gradient(165deg, rgb(102, 178, 138) 0%, rgb(88, 162, 128) 100%)";

const TRAFFIC_GREEN_OUTER =
  "linear-gradient(165deg, rgb(90, 168, 130) 0%, rgb(78, 152, 118) 100%)";

/** Hours until event: red band = overdue or within this many hours (next ~24h). */
export const FOLLOWUP_TRAFFIC_RED_MAX_HOURS = 24;
/** Upper bound for light blue: “1–3 days” from now = after 24h through 72h. */
export const FOLLOWUP_TRAFFIC_BLUE_MAX_HOURS = 72;

/**
 * Discrete traffic colours for the **hiring / TL card background** (red / light blue / green by due window).
 * Thresholds: overdue or within {@link FOLLOWUP_TRAFFIC_RED_MAX_HOURS}h → red;
 * after that through {@link FOLLOWUP_TRAFFIC_BLUE_MAX_HOURS}h (1–3 days) → light blue;
 * later than that → green.
 */
export function getTrafficGradientForHours(hours) {
  if (hours == null || Number.isNaN(hours)) {
    return SLATE_FALLBACK;
  }
  if (hours < 0 || hours <= FOLLOWUP_TRAFFIC_RED_MAX_HOURS) {
    return TRAFFIC_RED;
  }
  if (hours <= FOLLOWUP_TRAFFIC_BLUE_MAX_HOURS) {
    return TRAFFIC_LIGHT_BLUE;
  }
  return TRAFFIC_GREEN;
}

/**
 * TL customer follow-up cards: strictly vs **now** — overdue (any past) → red,
 * any future instant → blue (no 24h “red window”, no green band).
 */
export function getTlFollowUpCardGradientForHours(hours) {
  if (hours == null || Number.isNaN(hours)) {
    return SLATE_FALLBACK;
  }
  if (hours < 0) {
    return TRAFFIC_RED;
  }
  return TRAFFIC_LIGHT_BLUE;
}

/**
 * Darker traffic variants (optional); not used by the current hiring card layout.
 */
export function getTrafficOuterGradientForHours(hours) {
  if (hours == null || Number.isNaN(hours)) {
    return SLATE_OUTER;
  }
  if (hours < 0 || hours <= FOLLOWUP_TRAFFIC_RED_MAX_HOURS) {
    return TRAFFIC_RED_OUTER;
  }
  if (hours <= FOLLOWUP_TRAFFIC_BLUE_MAX_HOURS) {
    return TRAFFIC_LIGHT_BLUE_OUTER;
  }
  return TRAFFIC_GREEN_OUTER;
}

/**
 * Hours used for traffic red / light blue / green (or slate when `null`).
 * Returns `undefined` when this row uses a non-traffic card background (e.g. plain Hired, Reject).
 */
export function getHoursForTrafficCard(row, colorScheme) {
  if (colorScheme !== "traffic") return undefined;
  const st = String(row?.status || "").trim();
  const hiredFollowUpTag = st === "Hired" && String(row?.tag || "").trim() === "Follow-Up";
  if (hiredFollowUpTag) {
    const ms = getScheduleMsForFollowUpCard(row);
    if (ms != null && !Number.isNaN(ms)) {
      return (ms - Date.now()) / 3600000;
    }
    return undefined;
  }
  if (st === "Hired" || st === "Reject") return undefined;
  const ms = getScheduleMsForFollowUpCard(row);
  if (ms == null || Number.isNaN(ms)) {
    return null;
  }
  return (ms - Date.now()) / 3600000;
}

export const HIRING_URGENCY_LEGEND = [
  {
    key: "red",
    label: "Red",
    dotClass: "bg-gradient-to-r from-rose-200 to-rose-50",
  },
  {
    key: "lightBlue",
    label: "Light blue",
    dotClass: "bg-gradient-to-r from-sky-300 to-sky-100",
  },
  {
    key: "green",
    label: "Green",
    dotClass: "bg-gradient-to-r from-emerald-200 to-emerald-50",
  },
];

/**
 * Legend for dashboards that colour cards by **next follow-up date** (from current time) using
 * {@link getTrafficGradientForHours}.
 */
export const NEXT_FOLLOWUP_DATE_TRAFFIC_LEGEND = [
  {
    key: "red",
    title: "Red",
    caption: "Overdue or within 24 hours from now",
    dotClass: "bg-gradient-to-r from-rose-200 to-rose-50",
  },
  {
    key: "lightBlue",
    title: "Light blue",
    caption: "Between 1 and 3 days from now (after 24h, up to 72h)",
    dotClass: "bg-gradient-to-r from-sky-300 to-sky-100",
  },
  {
    key: "green",
    title: "Green",
    caption: "More than 3 days from now (after 72h)",
    dotClass: "bg-gradient-to-r from-emerald-200 to-emerald-50",
  },
];
