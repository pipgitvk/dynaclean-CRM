export const GOOGLE_FEEDBACK_COLLECTION_OPTIONS = [
  { value: "", label: "Select" },
  { value: "not_collected", label: "Not collected" },
  { value: "collected_at_site_by_engineer", label: "Collected at site by engineer" },
  {
    value: "collected_by_service_support_followup",
    label: "Collected by service support followup",
  },
];

const ALLOWED_FEEDBACK = new Set(
  GOOGLE_FEEDBACK_COLLECTION_OPTIONS.map((o) => o.value).filter(Boolean),
);

export function canShowInstallationManualBackofficeFields(role) {
  const r = String(role ?? "")
    .trim()
    .toUpperCase();
  return (
    r === "SUPERADMIN" || r === "SERVICE SUPPORT" || r === "SALES CUM BACKOFFICE"
  );
}

export function normalizeGoogleFeedbackCollection(raw) {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (!v) return "";
  if (ALLOWED_FEEDBACK.has(v)) return v;
  const aliases = {
    collected_at_site: "collected_at_site_by_engineer",
    collected_by_service_support: "collected_by_service_support_followup",
  };
  return aliases[v] && ALLOWED_FEEDBACK.has(aliases[v]) ? aliases[v] : "";
}

export function googleFeedbackCollectionLabel(value) {
  const v = normalizeGoogleFeedbackCollection(value);
  if (!v) return "";
  return (
    GOOGLE_FEEDBACK_COLLECTION_OPTIONS.find((o) => o.value === v)?.label || v
  );
}

function normalizeYmd(value) {
  if (value == null || String(value).trim() === "") return null;
  const s = String(value).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export function parseInstallationManualMetaFromForm(formData) {
  return {
    installationCompletionDate: normalizeYmd(
      formData.get("installation_completion_date"),
    ),
    completedByServiceEngineer: String(
      formData.get("completed_by_service_engineer") || "",
    ).trim(),
    googleFeedbackCollection: normalizeGoogleFeedbackCollection(
      formData.get("google_feedback_collection"),
    ),
  };
}