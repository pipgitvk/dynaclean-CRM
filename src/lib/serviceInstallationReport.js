/** DB flag: digital form report saved in `service_reports`, not a file under /attachments. */
export const INSTALLATION_REPORT_FORM_FLAG = "uploadFO";

export function isInstallationReportFile(value) {
  const v = String(value || "").trim();
  if (!v || v === INSTALLATION_REPORT_FORM_FLAG) return false;
  return true;
}

export function productAttachmentSrc(filename) {
  const name = String(filename || "").trim();
  if (!name) return "";
  if (name.startsWith("http://") || name.startsWith("https://")) return name;
  if (name.startsWith("/")) return name;
  return `/attachments/${name}`;
}

/**
 * Link for completion-report "Digital Report" action.
 */
export function getInstallationReportLink(installationReport, serviceId, dashboardBase) {
  const value = String(installationReport || "").trim();
  if (!value) return null;

  if (value === INSTALLATION_REPORT_FORM_FLAG) {
    const base = dashboardBase || "/admin-dashboard";
    return {
      href: `${base}/warranty/service-records/service-report/${serviceId}`,
      label: "View Digital Service Report",
    };
  }

  const path = productAttachmentSrc(value);
  return {
    href: `/api/open-attachment?path=${encodeURIComponent(path)}`,
    label: "Download Digital Report",
  };
}
