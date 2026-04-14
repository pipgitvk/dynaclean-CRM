const HIRING_STATUS_OPTIONS = [
  // Current statuses
  "Follow-up",
  "Shortlisted",
  "Selected",
  "Negotiation",
  "Hold",
  "Backup",
  "Hired",
  "Rejected",
  // Legacy — kept so old DB rows can still be saved without being reset
  "Shortlisted for interview",
  "Rescheduled",
  "next-follow-up",
  "follow-up",
  "Waiting List",
  "Reject",
];

const HIRING_TAG_OPTIONS = ["Probation", "Permanent", "Terminate", "Follow-Up"];

const HIRING_MARITAL_OPTIONS = ["Unmarried", "Married"];
const HIRING_EXPERIENCE_VALUES = ["fresher", "experience"];
const HIRING_INTERVIEW_MODES = ["Virtual", "Walk-in"];

function normalizeStatus(v) {
  const s = String(v ?? "").trim();
  if (!s) return "Shortlisted";
  if (HIRING_STATUS_OPTIONS.includes(s)) return s;
  return "Shortlisted";
}

function normalizeTag(v) {
  const t = String(v ?? "").trim();
  if (!t) return null;
  return HIRING_TAG_OPTIONS.includes(t) ? t : null;
}

export function toMysqlDatetime(v) {
  if (!v) return null;
  const s = String(v).trim().replace("T", " ");
  if (s.length === 16) return `${s}:00`;
  if (s.length >= 19) return s.slice(0, 19);
  return s;
}

/**
 * Shared create/update validation for hiring entries.
 * @returns {{ error: string } | { data: object }}
 */
export function parseHiringPayload(body) {
  const candidate_name = String(body.candidate_name ?? "").trim();
  const designation = String(body.designation ?? "").trim();
  const emp_contact = String(body.emp_contact ?? "").trim();
  const marital_raw = String(body.marital_status ?? "").trim();
  const experience_raw = String(body.experience_type ?? "").trim();
  const interview_at_raw = String(body.interview_at ?? "").trim();
  const interview_mode_raw = String(body.interview_mode ?? "").trim();
  const note = String(body.note ?? "").trim();
  const status = normalizeStatus(body.status);
  const isHired = status === "Hired";
  const isSelected = status === "Selected";
  const isRescheduled = status === "Rescheduled";
  const isNextFollowUp = status === "next-follow-up";
  const rescheduled_at_raw = String(body.rescheduled_at ?? "").trim();
  const next_followup_at_raw = String(body.next_followup_at ?? "").trim();
  const tagForHired = isHired ? normalizeTag(body.tag) : null;
  const isHiredFollowUpTag = isHired && tagForHired === "Follow-Up";
  const hire_date = isHired ? String(body.hire_date ?? "").trim() || null : null;
  const tag = tagForHired;
  const packageStr = isHired ? String(body.package ?? "").trim() || null : null;

  let probation_months = null;
  if (isHired && tag === "Probation") {
    const pm = parseInt(String(body.probation_months ?? "").trim(), 10);
    if (!Number.isFinite(pm) || pm < 1 || pm > 120) {
      return { error: "When tag is Probation, enter probation duration (1–120 months)." };
    }
    probation_months = pm;
  }

  const selected_resume = isSelected ? String(body.selected_resume ?? "").trim() || null : null;

  let mgmt_interview_score = null;
  if (isSelected) {
    const mgmtRaw = String(body.mgmt_interview_score ?? "").trim();
    if (mgmtRaw !== "") {
      const n = parseInt(mgmtRaw, 10);
      if (Number.isFinite(n) && n >= 1 && n <= 10) mgmt_interview_score = n;
    }
  }

  // Always parsed — field is always visible (not Selected-only)
  let hr_interview_score = null;
  const hrRaw = String(body.hr_interview_score ?? "").trim();
  if (hrRaw !== "") {
    const n = parseInt(hrRaw, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 10) hr_interview_score = n;
  }

  const current_salary = String(body.current_salary ?? "").trim() || null;

  if (!hr_interview_score) {
    return { error: "HR interview score (1–10) is required." };
  }
  if (!current_salary) {
    return { error: "Current salary is required." };
  }

  if (!candidate_name || !designation || !emp_contact) {
    return { error: "Employee name, contact, and designation are required." };
  }
  if (!marital_raw || !HIRING_MARITAL_OPTIONS.includes(marital_raw)) {
    return { error: "Marital status is required." };
  }
  if (!experience_raw || !HIRING_EXPERIENCE_VALUES.includes(experience_raw)) {
    return { error: "Experience / Fresher is required." };
  }
  if (!interview_at_raw) {
    return { error: "Interview date and time is required." };
  }
  if (!interview_mode_raw || !HIRING_INTERVIEW_MODES.includes(interview_mode_raw)) {
    return { error: "Mode of interview is required." };
  }
  if (!note) {
    return { error: "Note is required." };
  }

  if (isHired && !hire_date) {
    return { error: "Joining date is required when status is Hired." };
  }
  if (isHired && !tag) {
    return { error: "Tag is required when status is Hired." };
  }
  if (isHired && !packageStr) {
    return { error: "Package is required when status is Hired." };
  }
  if (isRescheduled && !rescheduled_at_raw) {
    return { error: "Rescheduled date and time is required when status is Rescheduled." };
  }
  if (isNextFollowUp && !next_followup_at_raw) {
    return { error: "Next follow-up date and time is required when status is next-follow-up." };
  }
  if (isSelected && !selected_resume) {
    return { error: "Resume is required when status is Selected." };
  }
  if (isSelected && mgmt_interview_score === null) {
    return { error: "Management interview score (1–10) is required when status is Selected." };
  }

  let resolved_next_followup_at = null;
  if (isNextFollowUp) {
    resolved_next_followup_at = next_followup_at_raw;
  } else if (isHiredFollowUpTag && next_followup_at_raw) {
    resolved_next_followup_at = next_followup_at_raw;
  }

  return {
    data: {
      candidate_name,
      emp_contact,
      designation,
      marital_status: marital_raw,
      experience_type: experience_raw,
      interview_at: interview_at_raw,
      rescheduled_at: isRescheduled ? rescheduled_at_raw : null,
      next_followup_at: resolved_next_followup_at,
      interview_mode: interview_mode_raw,
      status,
      tag,
      hire_date,
      packageStr,
      probation_months,
      selected_resume,
      mgmt_interview_score,
      hr_interview_score,
      current_salary,
      note,
    },
  };
}

