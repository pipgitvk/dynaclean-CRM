/** Navbar header-search TL follow-up iframe listens for this after a successful save. */
export const HEADER_TL_FOLLOWUP_SAVED_MESSAGE = "HEADER_TL_FOLLOWUP_SAVED";

/** Notify parent to close the TL follow-up popup. Returns true when handled. */
export function notifyHeaderTlFollowupSaved(customerId) {
  if (typeof window === "undefined") return false;
  if (window.self !== window.top) {
    window.parent.postMessage(
      {
        type: HEADER_TL_FOLLOWUP_SAVED_MESSAGE,
        customerId: customerId != null ? String(customerId) : undefined,
      },
      window.location.origin,
    );
    return true;
  }
  return false;
}
