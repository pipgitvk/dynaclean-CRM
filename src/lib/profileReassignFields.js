/**
 * Checkbox options for HR "Reassign fields" modal (keys stored in employee_profile_submissions.reassigned_fields).
 * Section keys: section_* mean the whole block must be reviewed by the employee.
 */
export const PROFILE_REASSIGN_FIELD_GROUPS = [
  {
    title: "Employment & basic",
    fields: [
      { key: "is_experienced", label: "Employment type (Fresher / Experienced)" },
      { key: "full_name", label: "Full Name" },
      { key: "probation_period", label: "Probation Period" },
      { key: "department", label: "Department" },
      { key: "designation", label: "Designation" },
      { key: "date_of_joining", label: "Date of Joining" },
      { key: "reporting_manager", label: "Reporting Manager" },
      { key: "work_location", label: "Work Location" },
      { key: "employment_status", label: "Employment Status" },
      { key: "date_of_birth", label: "Date of Birth" },
      { key: "contact_mobile", label: "Contact Mobile" },
      { key: "email", label: "Email" },
      { key: "blood_group", label: "Blood Group" },
      { key: "marital_status", label: "Marital Status" },
    ],
  },
  {
    title: "Family & emergency",
    fields: [
      { key: "father_name", label: "Father's Name" },
      { key: "father_phone", label: "Father's Contact" },
      { key: "mother_name", label: "Mother's Name" },
      { key: "mother_phone", label: "Mother's Contact" },
      { key: "emergency_contact_name", label: "Emergency Contact Name" },
      { key: "emergency_contact_number", label: "Emergency Contact Number" },
    ],
  },
  {
    title: "Tax & address",
    fields: [
      { key: "pan_number", label: "PAN Number" },
      { key: "aadhar_number", label: "Aadhaar Number" },
      { key: "pf_uan", label: "PF UAN" },
      { key: "esic_number", label: "ESIC Number" },
      { key: "correspondence_address", label: "Current Address" },
      { key: "permanent_address", label: "Permanent Address" },
    ],
  },
  {
    title: "Banking",
    fields: [
      { key: "name_as_per_bank", label: "Name as per Bank" },
      { key: "bank_name", label: "Bank Name" },
      { key: "ifsc_code", label: "IFSC Code" },
      { key: "bank_account_number", label: "Bank Account Number" },
    ],
  },
  {
    title: "Sections (whole block)",
    fields: [
      { key: "section_education", label: "Education qualifications (all rows)" },
      { key: "section_experience", label: "Work experience (all rows)" },
      { key: "section_references", label: "Reference verification (all references)" },
      { key: "section_documents", label: "Documents, photo & signature (all uploads)" },
    ],
  },
];

export function labelForReassignKey(key) {
  for (const g of PROFILE_REASSIGN_FIELD_GROUPS) {
    const f = g.fields.find((x) => x.key === key);
    if (f) return f.label;
  }
  return key;
}
