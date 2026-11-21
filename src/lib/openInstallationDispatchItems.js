/** Split dispatch GROUP_CONCAT model codes + product names into readable line items. */
export function parseOpenInstallationDispatchItems(modelStr, nameStr) {
  const codes = String(modelStr || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const names = String(nameStr || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!codes.length && !names.length) return [];

  const pairCount = Math.max(codes.length, names.length);
  const items = [];
  for (let i = 0; i < pairCount; i += 1) {
    const code = codes[i] ?? "";
    const name = names[i] ?? "";
    if (!code && !name) continue;
    items.push({ code, name });
  }

  const seen = new Set();
  return items.filter((it) => {
    const key = `${it.code.toLowerCase()}|${it.name.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}