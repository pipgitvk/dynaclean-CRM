import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getMainSessionPayload } from "@/lib/auth";
import {
  ALL_MODULE_KEYS,
  parseModuleAccess,
  applySuperadminOnlyModuleRestrictions,
  applyRoleDenyModuleRestrictions,
  applyRoleMaxAllowedModuleRestrictions,
} from "@/lib/moduleAccess";

const VALID_OPERATIONS = new Set(["REPLACE", "MERGE", "REMOVE"]);

let _columnEnsured = false;
async function ensureModuleAccessColumn(db) {
  if (_columnEnsured) return;
  const [cols] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'rep_list'
       AND COLUMN_NAME = 'module_access'`,
  );
  if (cols.length === 0) {
    await db.query(`ALTER TABLE rep_list ADD COLUMN module_access TEXT NULL DEFAULT NULL`);
  }
  _columnEnsured = true;
}

function normRole(role) {
  return String(role || "").trim().toUpperCase();
}

function uniqueStrings(arr) {
  return [...new Set((arr || []).map((v) => String(v || "").trim()).filter(Boolean))];
}

export async function POST(req) {
  const actor = await getMainSessionPayload();
  if (actor?.role !== "SUPERADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const roles = uniqueStrings(body?.roles).map(normRole);
  const operation = normRole(body?.operation);
  const moduleKeysRaw = uniqueStrings(body?.moduleKeys);

  if (roles.length === 0) {
    return NextResponse.json({ message: "roles is required" }, { status: 400 });
  }
  if (!VALID_OPERATIONS.has(operation)) {
    return NextResponse.json(
      { message: "operation must be REPLACE, MERGE, or REMOVE" },
      { status: 400 },
    );
  }

  // Keep only valid known keys (silently drop unknowns)
  const known = new Set(ALL_MODULE_KEYS);
  const moduleKeys = moduleKeysRaw.filter((k) => known.has(k));

  const db = await getDbConnection();
  await ensureModuleAccessColumn(db);

  const rolePh = roles.map(() => "?").join(",");
  const [rows] = await db.query(
    `SELECT username, userRole, module_access FROM rep_list
     WHERE UPPER(TRIM(userRole)) IN (${rolePh})`,
    roles,
  );

  let updated = 0;
  let skipped = 0;

  for (const row of rows || []) {
    const username = String(row?.username || "").trim();
    const userRole = String(row?.userRole || "");
    if (!username) {
      skipped += 1;
      continue;
    }

    const existing = parseModuleAccess(row?.module_access ?? null);
    let next;

    if (operation === "REPLACE") {
      next = [...moduleKeys];
    } else if (operation === "MERGE") {
      const set = new Set(existing);
      for (const k of moduleKeys) set.add(k);
      next = [...set];
    } else {
      // REMOVE
      const remove = new Set(moduleKeys);
      next = existing.filter((k) => !remove.has(k));
    }

    next = applySuperadminOnlyModuleRestrictions(next, userRole) ?? [];
    next = applyRoleDenyModuleRestrictions(next, userRole) ?? [];
    next = applyRoleMaxAllowedModuleRestrictions(next, userRole) ?? [];
    next = uniqueStrings(next);

    await db.query(
      `UPDATE rep_list SET module_access = ? WHERE username = ?`,
      [JSON.stringify(next), username],
    );
    updated += 1;
  }

  return NextResponse.json({
    success: true,
    roles,
    operation,
    requestedKeys: moduleKeysRaw.length,
    appliedKeys: moduleKeys.length,
    matchedUsers: (rows || []).length,
    updated,
    skipped,
  });
}

