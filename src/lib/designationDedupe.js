/**
 * Collapse case/whitespace duplicates for designation dropdowns (e.g. Developer vs developer).
 * Does not merge different spellings (e.g. typo vs correct) — those stay separate.
 */

export function normalizeDesignationKey(s) {
  return String(s).trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Pick one display string from variants that share the same normalizeDesignationKey.
 * Prefers mixed/title case over ALL CAPS when both exist; then longer/more readable.
 */
export function pickCanonicalDesignationLabel(variants) {
  const uniq = [...new Set(variants.map((v) => String(v).trim()).filter(Boolean))];
  if (uniq.length === 0) return "";
  if (uniq.length === 1) return uniq[0];

  const hasNonAllCaps = uniq.some((v) => v !== v.toUpperCase());
  const pool = hasNonAllCaps
    ? uniq.filter((v) => !(v === v.toUpperCase() && v.length > 4))
    : uniq;
  const use = pool.length ? pool : uniq;

  const score = (v) => {
    let sc = 0;
    if (/[a-z]/.test(v) && /[A-Z]/.test(v)) sc += 10;
    if (v !== v.toUpperCase()) sc += 3;
    sc += Math.min(v.length, 120) * 0.001;
    return sc;
  };

  use.sort((a, b) => {
    const d = score(b) - score(a);
    if (d !== 0) return d;
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  });
  return use[0];
}

/** @param {string[]} rawList */
export function dedupeDesignationStrings(rawList) {
  const byKey = new Map();
  for (const raw of rawList) {
    const t = String(raw ?? "").trim();
    if (!t) continue;
    const k = normalizeDesignationKey(t);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(t);
  }
  const out = [];
  for (const variants of byKey.values()) {
    out.push(pickCanonicalDesignationLabel(variants));
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/** Normalized keys hidden from designation dropdowns / filters (data may still exist in DB). */
const DESIGNATION_DROPDOWN_BLOCKLIST_KEYS = new Set(["full stack developer", "digital marketer"]);

/** Remove blocklisted designations from API-fed option lists. */
export function omitBlockedDesignations(designations) {
  return (designations || []).filter((d) => !DESIGNATION_DROPDOWN_BLOCKLIST_KEYS.has(normalizeDesignationKey(d)));
}

/** Merge master list with extra values (e.g. current form value); dedupes by normalized key. */
export function mergeDesignationOptions(baseList, ...extras) {
  const all = [...(baseList || [])];
  for (const e of extras) {
    const t = String(e ?? "").trim();
    if (t) all.push(t);
  }
  return dedupeDesignationStrings(all);
}

/** Map a raw DB value to the canonical label used in dropdown options. */
export function resolveCanonicalDesignation(raw, baseList) {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  const list = dedupeDesignationStrings([...(baseList || []), t]);
  const k = normalizeDesignationKey(t);
  return list.find((x) => normalizeDesignationKey(x) === k) || t;
}
