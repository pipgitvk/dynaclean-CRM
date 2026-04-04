/**
 * Whether a scalar is_experienced value means "Experienced" (not Fresher).
 * Matches API semantics in profile/submissions routes.
 */
export function scalarMeansExperienced(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    return t === "true" || t === "1" || t === "on" || t === "yes";
  }
  return false;
}

function hasExplicitIsExperienced(row) {
  if (!row || typeof row !== "object") return false;
  const v = row.is_experienced;
  if (v === undefined || v === null) return false;
  if (typeof v === "string" && v.trim() === "") return false;
  return true;
}

/**
 * ProfileForm / HR review: prefer payload is_experienced; do not infer from
 * experience[] when the flag is set (avoids live-profile merge showing wrong type).
 */
export function deriveIsExperiencedForForm(row) {
  if (!row || typeof row !== "object") return false;
  if (hasExplicitIsExperienced(row)) {
    return scalarMeansExperienced(row.is_experienced);
  }
  const ex = row.experience;
  return Array.isArray(ex) && ex.length > 0;
}

export function isExplicitlyFresherSubmission(row) {
  if (!row || typeof row !== "object") return false;
  if (!hasExplicitIsExperienced(row)) return false;
  return !scalarMeansExperienced(row.is_experienced);
}
