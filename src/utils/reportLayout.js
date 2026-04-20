/** Complaint summary text that triggers Installation Report layout (screen + PDF). */
export const SCHEDULED_INSTALLATION_COMPLAINT_SUMMARY =
  "Scheduled for Installation";

export function isInstallationReportLayout(complaintSummary) {
  return (
    String(complaintSummary ?? "").trim() ===
    SCHEDULED_INSTALLATION_COMPLAINT_SUMMARY
  );
}
