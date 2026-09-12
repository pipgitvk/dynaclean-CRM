/**
 * Returns a card background color based on how far away the follow-up is.
 *
 * @param {number|null} hours  Hours until follow-up (negative = overdue)
 * @returns {string}  CSS rgb() color string
 *
 * Color logic:
 *  🔴 Red         — overdue (hours < 0)
 *  🟠 Light Orange — due within next 2 hours (0 <= hours <= 2)
 *  🟢 Light Green  — 2–12 hours away
 *  🔵 Blue         — 12–48 hours away
 *  ⚪ Grey          — more than 48 hours away
 */
export function getGradientColor(hours) {
  if (hours === null) {
    // No follow-up date set → light orange as a neutral "needs attention" signal
    return "rgb(255, 180, 100)";
  }

  if (hours < 0) {
    // Overdue — Red
    return "rgb(220, 53, 69)";
  }

  if (hours <= 2) {
    // Due soon (within 2 hours) — Light Orange
    return "rgb(255, 153, 51)";
  }

  if (hours <= 12) {
    // Upcoming (2–12 hours) — Light Green
    return "rgb(60, 179, 113)";
  }

  if (hours <= 48) {
    // Far upcoming (12–48 hours) — Sky Blue
    return "rgb(100, 181, 246)";
  }

  // Beyond 48 hours — Sky Blue
  return "rgb(100, 181, 246)";
}
