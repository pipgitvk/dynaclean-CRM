/** CRM login allowed window (IST), when per-employee login time restriction is ON. */

export const LOGIN_TIME_RESTRICTION_START_MINUTES = 7 * 60; // 07:00
export const LOGIN_TIME_RESTRICTION_END_MINUTES = 20 * 60 + 30; // 20:30

export const LOGIN_TIME_RESTRICTION_RANGE_LABEL = "07:00–20:30 IST";

export function isWithinLoginTimeWindow(currentTimeMinutes) {
  return (
    currentTimeMinutes >= LOGIN_TIME_RESTRICTION_START_MINUTES &&
    currentTimeMinutes <= LOGIN_TIME_RESTRICTION_END_MINUTES
  );
}
