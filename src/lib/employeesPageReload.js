/** Parent `EmpTable` listens for this after iframe edits (quick-edit, password, IP, etc.). */
export const ADMIN_EMPLOYEES_RELOAD_MESSAGE = "ADMIN_EMPLOYEES_RELOAD";

/** If loaded inside the employees iframe modal, notify parent to reload. Returns true when handled. */
export function notifyEmployeesListReload() {
  if (typeof window === "undefined") return false;
  if (window.self !== window.top) {
    window.parent.postMessage(
      { type: ADMIN_EMPLOYEES_RELOAD_MESSAGE },
      window.location.origin,
    );
    return true;
  }
  return false;
}

export function reloadEmployeesAdminPage() {
  if (typeof window === "undefined") return;
  window.location.assign("/admin-dashboard/employees");
}
