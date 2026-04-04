import { PROFILE_REASSIGN_FIELD_GROUPS } from "@/lib/profileReassignFields";

const ALL_GRANULAR_KEYS = PROFILE_REASSIGN_FIELD_GROUPS.flatMap((g) =>
  g.fields.map((f) => f.key).filter((k) => !k.startsWith("section_"))
);

const BANKING_KEYS = new Set(["name_as_per_bank", "bank_name", "ifsc_code", "bank_account_number"]);

/** Shown under Banking Details card (not Employee Personal Details). */
export const TAX_STATUTORY_KEYS_IN_BANKING_CARD = new Set([
  "pan_number",
  "aadhar_number",
  "pf_uan",
  "esic_number",
]);

const PERSONAL_FAMILY_TAX_KEYS = ALL_GRANULAR_KEYS.filter((k) => !BANKING_KEYS.has(k));

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
  return keys.some(
    (k) =>
      PERSONAL_FAMILY_TAX_KEYS.includes(k) && !TAX_STATUTORY_KEYS_IN_BANKING_CARD.has(k)
  );
}

export function shouldShowBankingBlock(keys) {
  if (!isReassignFieldMode(keys)) return true;
  return keys.some((k) => BANKING_KEYS.has(k));
}

/** Banking account + tax IDs + work experience (and related document uploads) in one card. */
export function shouldShowBankingDetailsCard(keys, isExperienced) {
  if (!isReassignFieldMode(keys)) return true;
  if (shouldShowBankingBlock(keys)) return true;
  if (keys.some((k) => TAX_STATUTORY_KEYS_IN_BANKING_CARD.has(k))) return true;
  if (isExperienced && keys.includes("section_experience")) return true;
  return false;
}

export function shouldShowEducationSection(keys) {
  if (!isReassignFieldMode(keys)) return true;
  return keys.includes("section_education");
}

export function shouldShowExperienceSection(keys) {
  if (!isReassignFieldMode(keys)) return true;
  return keys.includes("section_experience");
}

export function shouldShowReferencesSection(keys) {
  if (!isReassignFieldMode(keys)) return true;
  return keys.includes("section_references");
}

export function shouldShowDocumentsSection(keys) {
  if (!isReassignFieldMode(keys)) return true;
  return keys.includes("section_documents");
}
