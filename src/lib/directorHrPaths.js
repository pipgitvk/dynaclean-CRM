export function getDirectorHrHiringBase(pathname = "") {
  const path = String(pathname || "");
  if (path.startsWith("/director-dashboard/hiring")) {
    return "/director-dashboard/hiring";
  }
  return "/empcrm/admin-dashboard/hiring";
}

export function getDirectorHrProfileApprovalsAdminBase(pathname = "") {
  const path = String(pathname || "");
  if (path.startsWith("/director-dashboard/final-profile-approval")) {
    return "/director-dashboard/final-profile-approval";
  }
  return "/empcrm/admin-dashboard/profile/approvals-admin";
}

export function getDirectorHrProfileApprovalDetailPath(id, pathname = "", from = "admin") {
  if (String(pathname).startsWith("/director-dashboard/final-profile-approval")) {
    return `/director-dashboard/final-profile-approval/${id}?from=${from}`;
  }
  return `/empcrm/admin-dashboard/profile/approvals/${id}?from=${from}`;
}

export function getDirectorDashboardHome(pathname = "") {
  const path = String(pathname || "");
  if (path.startsWith("/director-dashboard")) {
    return "/director-dashboard";
  }
  return "/user-dashboard";
}
