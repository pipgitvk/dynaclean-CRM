/**
 * Product code normalization and validation.
 * Handles variations like "Dyna40", "Dyna 40" -> "Dyna-40"
 */

function normalizeForComparison(code) {
  if (!code || typeof code !== "string") return "";
  return code.replace(/[\s\-_]/g, "").toLowerCase().trim();
}

export function resolveToCanonical(userInput, validCodes) {
  const input = String(userInput || "").trim();
  if (!input || !Array.isArray(validCodes) || validCodes.length === 0) return null;

  const normalizedInput = normalizeForComparison(input);

  const exact = validCodes.find((c) => String(c || "").toLowerCase() === input.toLowerCase());
  if (exact) return { canonical: exact };

  const match = validCodes.find((c) => normalizeForComparison(c) === normalizedInput);
  if (match) return { canonical: match };

  return null;
}
