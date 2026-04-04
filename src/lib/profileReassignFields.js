/**
 * Checkbox options for HR "Reassign fields" modal (keys stored in employee_profile_submissions.reassigned_fields).
 * Legacy `section_*` keys still work for old rows; new HR picks use per-field keys like the profile form.
 */

/** Tailwind classes aligned with profile section cards */
export const REASSIGN_CARD_VARIANTS = {
  sky: {
    shell: "rounded-xl border border-sky-200 bg-sky-50/90 p-5 md:p-6 shadow-sm",
    heading: "text-lg font-semibold text-gray-800 mb-3 pb-2 border-b border-sky-200/80",
    rowBorder: "border-sky-100",
  },
  violet: {
    shell: "rounded-xl border border-violet-200 bg-violet-50/85 p-5 md:p-6 shadow-sm",
    heading: "text-lg font-semibold text-gray-800 mb-3 pb-2 border-b border-violet-200/80",
    rowBorder: "border-violet-100",
  },
  amber: {
    shell: "rounded-xl border border-amber-200 bg-amber-50/85 p-5 md:p-6 shadow-sm",
    heading: "text-lg font-semibold text-gray-800 mb-3 pb-2 border-b border-amber-200/80",
    rowBorder: "border-amber-100",
  },
  emerald: {
    shell: "rounded-xl border border-emerald-200 bg-emerald-50/85 p-5 md:p-6 shadow-sm",
    heading: "text-lg font-semibold text-gray-800 mb-3 pb-2 border-b border-emerald-200/80",
    rowBorder: "border-emerald-100",
  },
  slate: {
    shell: "rounded-xl border border-slate-200 bg-slate-50/90 p-5 md:p-6 shadow-sm",
    heading: "text-lg font-semibold text-gray-800 mb-3 pb-2 border-b border-slate-200/80",
    rowBorder: "border-slate-200",
  },
};

export function getReassignCardVariant(variant) {
  return REASSIGN_CARD_VARIANTS[variant] || REASSIGN_CARD_VARIANTS.slate;
}

/**
 * @typedef {{ key: string, label: string }} ReassignFieldDef
 * @typedef {{ subtitle: string, fields: ReassignFieldDef[] }} ReassignBlockDef
 * @typedef {{ title: string, variant: string, fields?: ReassignFieldDef[], blocks?: ReassignBlockDef[] }} ReassignGroupDef
 */

export const QUALIFICATION_COLUMN_KEYS = new Set([
  "qualification_exam_name",
  "qualification_board_university",
  "qualification_year_of_passing",
  "qualification_grade_percentage",
]);

export const EDUCATION_DOCUMENT_REASSIGN_KEYS = new Set([
  "doc_10th_certificate",
  "doc_12th_certificate",
  "doc_degree_diploma",
  "doc_technical_cert",
]);

export const EXPERIENCE_COLUMN_KEYS = new Set([
  "experience_company_name",
  "experience_designation",
  "experience_gross_salary_ctc",
  "experience_period_from",
  "experience_period_to",
  "experience_reason_for_leaving",
]);

export const EXPERIENCE_DOCUMENT_REASSIGN_KEYS = new Set([
  "doc_appt_letter_prev",
  "doc_exp_letter",
  "doc_relieving_letter",
  "doc_salary_slips",
]);

export const REFERENCE_COLUMN_KEYS = new Set([
  "reference_name",
  "reference_contact",
  "reference_address",
  "reference_relationship",
]);

/** Employee-facing uploads (main profile form — not HR-only cards). */
export const EMPLOYEE_MANDATORY_DOCS_REASSIGN_KEYS = new Set([
  "profile_photo",
  "signature",
  "doc_pan_card",
  "doc_voter_id",
  "doc_aadhaar_card",
  "doc_electricity_bill",
  "doc_rent_agreement",
  ...Array.from(EDUCATION_DOCUMENT_REASSIGN_KEYS),
  ...Array.from(EXPERIENCE_DOCUMENT_REASSIGN_KEYS),
  "doc_cancelled_cheque",
  "doc_police_verification",
]);

const LEGACY_SECTION_LABELS = {
  section_education: "Qualification Details * (entire section — all rows)",
  section_experience: "Work experience (entire section — all rows)",
  section_references: "Reference Verification Details (Minimum 3) — entire section",
  section_documents: "Documents, photo & signature — entire section",
};

/** @type {ReassignGroupDef[]} */
export const PROFILE_REASSIGN_FIELD_GROUPS = [
  {
    title: "Employee Basic Details",
    variant: "sky",
    fields: [
      { key: "is_experienced", label: "Employment Type (Select before filling details) *" },
      { key: "full_name", label: "Full Name *" },
      { key: "probation_period", label: "Probation Period *" },
      { key: "department", label: "Department *" },
      { key: "designation", label: "Designation *" },
      { key: "date_of_joining", label: "Date of Joining *" },
      { key: "reporting_manager", label: "Reporting Manager *" },
      { key: "work_location", label: "Work Location" },
      { key: "employment_status", label: "Employment Status *" },
    ],
  },
  {
    title: "Employee Personal Details",
    variant: "violet",
    fields: [
      { key: "date_of_birth", label: "Date of Birth *" },
      { key: "contact_mobile", label: "Contact Mobile *" },
      { key: "email", label: "Email" },
      { key: "blood_group", label: "Blood Group" },
      { key: "marital_status", label: "Marital Status *" },
      { key: "father_name", label: "Father's Name *" },
      { key: "father_phone", label: "Father's Contact *" },
      { key: "mother_name", label: "Mother's Name *" },
      { key: "mother_phone", label: "Mother's Contact *" },
      { key: "emergency_contact_name", label: "Emergency Contact Name" },
      { key: "emergency_contact_number", label: "Emergency Contact Number" },
      { key: "correspondence_address", label: "Current Address" },
      { key: "permanent_address", label: "Permanent Address *" },
      { key: "near_police_station", label: "Near police station *" },
    ],
  },
  {
    title: "Banking Details",
    variant: "amber",
    blocks: [
      {
        subtitle: "Tax & compliance",
        fields: [
          { key: "pan_number", label: "PAN Number *" },
          { key: "aadhar_number", label: "Aadhaar Number *" },
          { key: "pf_uan", label: "PF UAN Number" },
          { key: "esic_number", label: "ESIC Number (If Available)" },
        ],
      },
      {
        subtitle: "Bank account",
        fields: [
          { key: "name_as_per_bank", label: "Name as per Bank" },
          { key: "bank_name", label: "Bank Name" },
          { key: "ifsc_code", label: "IFSC Code" },
          { key: "bank_account_number", label: "Bank Account Number" },
        ],
      },
    ],
  },
  {
    title: "Qualification Details *",
    variant: "emerald",
    fields: [
      { key: "qualification_exam_name", label: "Exam/Degree" },
      { key: "qualification_board_university", label: "Board/University" },
      { key: "qualification_year_of_passing", label: "Year of Passing" },
      { key: "qualification_grade_percentage", label: "Grade/Percentage" },
    ],
  },
  {
    title: "Educational Documents",
    variant: "emerald",
    fields: [
      { key: "doc_10th_certificate", label: "10th Qualification Certificate *" },
      { key: "doc_12th_certificate", label: "12th Qualification Certificate *" },
      { key: "doc_degree_diploma", label: "Diploma / Degree Certificate" },
      { key: "doc_technical_cert", label: "Relevant Technical Certification" },
    ],
  },
  {
    title: "Work experience",
    variant: "amber",
    fields: [
      { key: "experience_company_name", label: "Company Name" },
      { key: "experience_designation", label: "Designation" },
      { key: "experience_gross_salary_ctc", label: "Gross Salary (CTC)" },
      { key: "experience_period_from", label: "Period From" },
      { key: "experience_period_to", label: "Period To" },
      { key: "experience_reason_for_leaving", label: "Reason for Leaving *" },
    ],
  },
  {
    title: "Experience documents (if experienced)",
    variant: "amber",
    fields: [
      { key: "doc_appt_letter_prev", label: "Appointment Letter (Previous Company) *" },
      { key: "doc_exp_letter", label: "Experience Letter *" },
      { key: "doc_relieving_letter", label: "Relieving Letter *" },
      { key: "doc_salary_slips", label: "Last 3 Months Salary Slips *" },
    ],
  },
  {
    title: "Reference Verification Details (Minimum 3)",
    variant: "slate",
    fields: [
      { key: "reference_name", label: "Reference Name *" },
      { key: "reference_contact", label: "Contact Number *" },
      { key: "reference_address", label: "Address *" },
      { key: "reference_relationship", label: "Relationship w/ Applicant *" },
    ],
  },
  {
    title: "Mandatory Documents Upload",
    variant: "slate",
    blocks: [
      {
        subtitle: "Photo & signature",
        fields: [
          { key: "profile_photo", label: "Passport Size Photograph *" },
          { key: "signature", label: "Signature *" },
        ],
      },
      {
        subtitle: "Identity Proof (Mandatory)",
        fields: [
          { key: "doc_pan_card", label: "PAN Card *" },
          { key: "doc_voter_id", label: "Voter ID" },
        ],
      },
      {
        subtitle: "Address Proof (Mandatory)",
        fields: [
          { key: "doc_aadhaar_card", label: "Aadhaar Card *" },
          { key: "doc_electricity_bill", label: "Electricity Bill *" },
          { key: "doc_rent_agreement", label: "Rent Agreement (If Applicable)" },
        ],
      },
      {
        subtitle: "Bank & Payroll Details",
        fields: [{ key: "doc_cancelled_cheque", label: "Cancelled Cheque / Bank Passbook (Front) *" }],
      },
      {
        subtitle: "Other / Verification",
        fields: [{ key: "doc_police_verification", label: "Police Verification Form" }],
      },
    ],
  },
];

function walkGroupFields(group, fn) {
  if (group.blocks) {
    for (const b of group.blocks) {
      for (const f of b.fields) fn(f, group);
    }
  } else if (group.fields) {
    for (const f of group.fields) fn(f, group);
  }
}

/** Keys that live on flat `formData` (not education/experience/reference rows or file checkboxes). */
export const FORM_TOP_LEVEL_REASSIGN_KEYS = new Set();
export const BASIC_PERSONAL_REASSIGN_KEYS = new Set();
for (const g of PROFILE_REASSIGN_FIELD_GROUPS) {
  walkGroupFields(g, (f, group) => {
    if (
      group.title === "Employee Basic Details" ||
      group.title === "Employee Personal Details" ||
      group.title === "Banking Details"
    ) {
      FORM_TOP_LEVEL_REASSIGN_KEYS.add(f.key);
    }
    if (group.title === "Employee Basic Details" || group.title === "Employee Personal Details") {
      BASIC_PERSONAL_REASSIGN_KEYS.add(f.key);
    }
  });
}

/** @param {(field: ReassignFieldDef, group: ReassignGroupDef, block: ReassignBlockDef | null) => void} fn */
export function eachReassignField(fn) {
  for (const g of PROFILE_REASSIGN_FIELD_GROUPS) {
    if (g.blocks) {
      for (const b of g.blocks) {
        for (const f of b.fields) fn(f, g, b);
      }
    } else if (g.fields) {
      for (const f of g.fields) fn(f, g, null);
    }
  }
}

export function allReassignFieldKeys() {
  const out = [];
  eachReassignField((f) => out.push(f.key));
  return out;
}

export function labelForReassignKey(key) {
  if (LEGACY_SECTION_LABELS[key]) return LEGACY_SECTION_LABELS[key];
  let found = null;
  eachReassignField((f) => {
    if (f.key === key) found = f.label;
  });
  return found != null ? found : key;
}
