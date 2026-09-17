import { getFollowupCardBackgroundFromHours } from "./followupDateColors";

/**
 * Returns a card background color based on how far away the follow-up is.
 *
 * @param {number|null} hours  Hours until follow-up (negative = overdue)
 * @returns {string}  CSS rgb() color string
 *
 * Color logic:
 *  🔴 Red            — overdue (hours < 0)
 *  🟠 Light Orange    — due within next 2 hours (0 <= hours <= 2)
 *  🟢 Light Green     — 2–12 hours away
 *  🔵 Light Sky Blue  — more than 12 hours away
 */
export function getGradientColor(hours) {
  return getFollowupCardBackgroundFromHours(hours);
}
