import {
  allReassignFieldKeys,
  BASIC_PERSONAL_REASSIGN_KEYS,
  EDUCATION_DOCUMENT_REASSIGN_KEYS,
  EMPLOYEE_MANDATORY_DOCS_REASSIGN_KEYS,
  EXPERIENCE_COLUMN_KEYS,
  EXPERIENCE_DOCUMENT_REASSIGN_KEYS,
  QUALIFICATION_COLUMN_KEYS,
  REFERENCE_COLUMN_KEYS,
} from "@/lib/profileReassignFields";

const ALL_GRANULAR_KEYS = allReassignFieldKeys().filter((k) => !k.startsWith("section_"));

const BANKING_KEYS = new Set(["name_as_per_bank", "bank_name", "ifsc_code", "bank_account_number"]);

/** Shown under Banking Details card (not Employee Personal Details). */
export const TAX_STATUTORY_KEYS_IN_BANKING_CARD = new Set([
  "pan_number",
  "aadhar_number",
  "pf_uan",
  "esic_number",
]);

function hasAnyKey(keys, setOrArray) {
  const arr = setOrArray instanceof Set ? Array.from(setOrArray) : setOrArray;
  return arr.some((k) => keys.includes(k));
}

/** True when HR flagged work experience table rows and/or experience-related document uploads. */
export function reassignKeysImplyExperience(keys) {
  if (!Array.isArray(keys) || keys.length === 0) return false;
  if (keys.includes("section_experience")) return true;
  return hasAnyKey(keys, EXPERIENCE_COLUMN_KEYS) || hasAnyKey(keys, EXPERIENCE_DOCUMENT_REASSIGN_KEYS);
}

/**
 * Employee re-submit screen: show work experience UI if the profile is experienced OR HR asked for
 * experience corrections (even when is_experienced was wrongly stored as false).
 */
export function effectiveExperiencedForEmployeeReassignUi(isExperienced, keys) {
  if (!isReassignFieldMode(keys)) return isExperienced;
  return isExperienced || reassignKeysImplyExperience(keys);
}

export function parseReassignKeys(raw) {
  if (raw == null) return null;
  try {
    const keys = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(keys) && keys.length > 0 ? keys : null;
  } catch {
    return null;
  }
}

export function isReassignFieldMode(keys) {
  return Array.isArray(keys) && keys.length > 0;
}

export function shouldShowField(keys, fieldKey) {
  if (!isReassignFieldMode(keys)) return true;
  return keys.includes(fieldKey);
}

export function shouldShowPersonalBlock(keys) {
  if (!isReassignFieldMode(keys)) return true;
  return keys.some((k) => BASIC_PERSONAL_REASSIGN_KEYS.has(k));
}

export function shouldShowBankingBlock(keys) {
  if (!isReassignFieldMode(keys)) return true;
  return keys.some((k) => BANKING_KEYS.has(k));
}

/** Banking account + tax IDs + work experience (and related document uploads) in one card. */
export function shouldShowBankingDetailsCard(keys, isExperienced) {
  if (!isReassignFieldMode(keys)) return true;
  const eff = effectiveExperiencedForEmployeeReassignUi(isExperienced, keys);
  if (shouldShowBankingBlock(keys)) return true;
  if (keys.some((k) => TAX_STATUTORY_KEYS_IN_BANKING_CARD.has(k))) return true;
  if (eff && keys.includes("section_experience")) return true;
  if (eff && hasAnyKey(keys, EXPERIENCE_COLUMN_KEYS)) return true;
  if (eff && hasAnyKey(keys, EXPERIENCE_DOCUMENT_REASSIGN_KEYS)) return true;
  return false;
}

export function shouldShowEducationSection(keys) {
  if (!isReassignFieldMode(keys)) return true;
  if (keys.includes("section_education")) return true;
  if (hasAnyKey(keys, QUALIFICATION_COLUMN_KEYS)) return true;
  if (hasAnyKey(keys, EDUCATION_DOCUMENT_REASSIGN_KEYS)) return true;
  return false;
}

export function shouldShowExperienceSection(keys) {
  if (!isReassignFieldMode(keys)) return true;
  if (keys.includes("section_experience")) return true;
  return hasAnyKey(keys, EXPERIENCE_COLUMN_KEYS);
}

export function shouldShowReferencesSection(keys) {
  if (!isReassignFieldMode(keys)) return true;
  if (keys.includes("section_references")) return true;
  return hasAnyKey(keys, REFERENCE_COLUMN_KEYS);
}

export function shouldShowDocumentsSection(keys) {
  if (!isReassignFieldMode(keys)) return true;
  if (keys.includes("section_documents")) return true;
  return keys.some((k) => EMPLOYEE_MANDATORY_DOCS_REASSIGN_KEYS.has(k));
}

/** For DocumentsSection: show this upload row in reassign mode. */
export function shouldShowDocumentReassignItem(keys, itemKey) {
  if (!isReassignFieldMode(keys)) return true;
  if (keys.includes("section_documents")) return true;
  return keys.includes(itemKey);
}

/** Photo block: show passport row if any of these conditions. */
export function shouldShowProfilePhotoReassign(keys) {
  if (!isReassignFieldMode(keys)) return true;
  if (keys.includes("section_documents")) return true;
  return keys.includes("profile_photo");
}

export function shouldShowSignatureReassign(keys) {
  if (!isReassignFieldMode(keys)) return true;
  if (keys.includes("section_documents")) return true;
  return keys.includes("signature");
}

/** Education grid: show qualification table columns (per row). */
export function shouldShowQualificationColumn(keys, columnKey) {
  if (!isReassignFieldMode(keys)) return true;
  if (keys.includes("section_education")) return true;
  return keys.includes(columnKey);
}

export function shouldShowEducationDataRows(keys) {
  if (!isReassignFieldMode(keys)) return true;
  if (keys.includes("section_education")) return true;
  return hasAnyKey(keys, QUALIFICATION_COLUMN_KEYS);
}

/** Experience grid: show column in each experience row. */
export function shouldShowExperienceColumn(keys, columnKey) {
  if (!isReassignFieldMode(keys)) return true;
  if (keys.includes("section_experience")) return true;
  return keys.includes(columnKey);
}

/** References: show field in each reference row. */
export function shouldShowReferenceColumn(keys, columnKey) {
  if (!isReassignFieldMode(keys)) return true;
  if (keys.includes("section_references")) return true;
  return keys.includes(columnKey);
}

// Kept for any external imports; personal block no longer uses this heuristic.
export const ALL_REASSIGN_GRANULAR_KEYS = ALL_GRANULAR_KEYS;
