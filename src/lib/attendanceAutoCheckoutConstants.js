/** Checkout address when system applies auto checkout (no GPS). */
export const AUTO_CHECKOUT_ATTENDANCE_ADDRESS = "Automatic";

/** Only auto check-out clock time (IST) — not per-employee schedule. */
export const AUTO_CHECKOUT_WALL_TIME = "21:00:00";

export function isAutomaticCheckoutAddress(address) {
  return String(address ?? "").trim().toLowerCase() === "automatic";
}
