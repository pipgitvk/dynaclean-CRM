import { PROFILE_REASSIGN_FIELD_GROUPS } from "@/lib/profileReassignFields";

const ALL_GRANULAR_KEYS = PROFILE_REASSIGN_FIELD_GROUPS.flatMap((g) =>
  g.fields.map((f) => f.key).filter((k) => !k.startsWith("section_"))
);

const BANKING_KEYS = new Set(["name_as_per_bank", "bank_name", "ifsc_code", "bank_account_number"]);

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
  return keys.some((k) => PERSONAL_FAMILY_TAX_KEYS.includes(k));
}

export function shouldShowBankingBlock(keys) {
  if (!isReassignFieldMode(keys)) return true;
  return keys.some((k) => BANKING_KEYS.has(k));
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
