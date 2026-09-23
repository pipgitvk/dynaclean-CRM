export function getGemCrmBasePath(pathname = "") {
  const path = String(pathname || "");
  if (path.startsWith("/director-dashboard/gem-crm")) {
    return "/director-dashboard/gem-crm";
  }
  if (path.startsWith("/gem-dashboard/gem-crm")) {
    return "/gem-dashboard/gem-crm";
  }
  return "/admin-dashboard/gem-crm";
}
