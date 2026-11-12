export function getDirectorHrHiringBase(pathname = "") {
  const path = String(pathname || "");
  if (path.startsWith("/director-dashboard/hiring")) {
    return "/director-dashboard/hiring";
  }
  if (path.startsWith("/hr-dashboard")) {
    return "/hr-dashboard/hiring";
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
  const path = String(pathname || "");
  if (path.startsWith("/director-dashboard/final-profile-approval")) {
    return `/director-dashboard/final-profile-approval/${id}?from=${from}`;
  }
  if (path.startsWith("/hr-dashboard")) {
    return `/hr-dashboard/admin-crm/profile/approvals/${id}?from=${from}`;
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
