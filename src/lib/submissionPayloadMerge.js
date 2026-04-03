/**
 * Incoming FormData often sends "" for hidden fields — do not treat that as an intentional clear
 * when merging onto an existing submission row or employee_profiles row.
 */
export function isMeaningfulSubmissionValue(v) {
  if (v === undefined || v === null) return false;
  if (typeof v === "boolean") return true;
  if (typeof v === "number") return !Number.isNaN(v);
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "") return false;
    if (t === "{}" || t === "[]") return false;
    return true;
  }
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return true;
}

/** Merge incoming POST `data` onto `base` — only meaningful keys overwrite. */
export function mergePayloadDataPreferNonEmpty(base, incoming) {
  const out = { ...(base && typeof base === "object" ? base : {}) };
  if (!incoming || typeof incoming !== "object") return out;
  for (const [k, v] of Object.entries(incoming)) {
    if (isMeaningfulSubmissionValue(v)) {
      out[k] = v;
    }
  }
  return out;
}

export function referencesPayloadHasContent(refs) {
  if (!Array.isArray(refs) || refs.length === 0) return false;
  return refs.some((r) => {
    const n = (r?.name || r?.reference_name || "").trim();
    const c = (r?.contact || r?.reference_mobile || "").trim();
    return Boolean(n || c);
  });
}

export function educationPayloadHasContent(edu) {
  if (!Array.isArray(edu) || edu.length === 0) return false;
  return edu.some((e) => (e?.exam_name || "").trim());
}

export function experiencePayloadHasContent(exp) {
  if (!Array.isArray(exp) || exp.length === 0) return false;
  return exp.some((e) => (e?.company_name || "").trim());
}

/** Map DB reference rows to submission-style objects used by approve INSERT. */
export function mapDbReferencesToPayload(rows) {
  return (rows || []).map((r) => ({
    name: r.reference_name || r.name || "",
    contact: r.reference_mobile || r.contact || "",
    address: r.reference_address || r.address || "",
    relationship: r.relationship || "",
    reference_type: r.reference_type || "Reference1",
  }));
}

export function mapDbEducationToPayload(rows) {
  return (rows || []).map((e) => ({
    exam_name: e.exam_name,
    board_university: e.board_university,
    year_of_passing: e.year_of_passing,
    grade_percentage: e.grade_percentage,
  }));
}

export function mapDbExperienceToPayload(rows) {
  return (rows || []).map((e) => ({
    company_name: e.company_name,
    designation: e.designation,
    gross_salary_ctc: e.gross_salary_ctc,
    period_from: e.period_from,
    period_to: e.period_to,
    reason_for_leaving: e.reason_for_leaving,
  }));
}
