import { getDbConnection } from "@/lib/db";
import { normalizeRoleKey } from "@/lib/roleKeyUtils";
import {
  ALL_MODULE_KEYS,
  parseModuleAccess,
  applySuperadminOnlyModuleRestrictions,
  applyRoleDenyModuleRestrictions,
} from "@/lib/moduleAccess";

function uniqueStrings(arr) {
  return [...new Set((arr || []).map((v) => String(v || "").trim()).filter(Boolean))];
}

/**
 * Returns the effective allowed module keys for a user, after applying the same
 * restriction pipeline used by the user sidebar.
 *
 * - `null` means "not configured / treat as full access" (legacy backward-compat),
 *   except SUPERADMIN which is always explicit.
 * - `[]` means explicitly no access (or unknown user / DB read failure fail-closed).
 */
export async function getEffectiveAllowedModuleKeys(username, role) {
  const roleKey = normalizeRoleKey(role || "") || String(role || "").trim().toUpperCase();
  if (roleKey === "SUPERADMIN") {
    return uniqueStrings(
      applySuperadminOnlyModuleRestrictions([...ALL_MODULE_KEYS], roleKey) ?? [],
    );
  }

  const u = String(username || "").trim();
  if (!u) return [];

  let allowedRaw = null;
  try {
    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      "SELECT module_access FROM rep_list WHERE username = ? LIMIT 1",
      [u],
    );
    if (!rows.length) return [];
    allowedRaw = parseModuleAccess(rows[0].module_access ?? null);
  } catch (err) {
    const msg = String(err?.message || "").toLowerCase();
    if (msg.includes("unknown column") && msg.includes("module_access")) {
      return null; // legacy: column missing → full access behavior handled by callers
    }
    return [];
  }

  let next = applySuperadminOnlyModuleRestrictions(allowedRaw, roleKey) ?? [];
  next = applyRoleDenyModuleRestrictions(next, roleKey) ?? [];
  return uniqueStrings(next);
}

export async function userHasModuleKey(username, role, moduleKey) {
  const key = String(moduleKey || "").trim();
  if (!key) return false;

  const roleKey = normalizeRoleKey(role || "") || String(role || "").trim().toUpperCase();
  if (roleKey === "SUPERADMIN") return true;

  const allowed = await getEffectiveAllowedModuleKeys(username, role);
  if (allowed === null) {
    // Legacy: module_access not configured yet → treat as full access (minus superadmin-only etc.)
    const base = applySuperadminOnlyModuleRestrictions([...ALL_MODULE_KEYS], roleKey) ?? [];
    const base2 = applyRoleDenyModuleRestrictions(base, roleKey) ?? [];
    return uniqueStrings(base2).includes(key);
  }

  return allowed.includes(key);
}
