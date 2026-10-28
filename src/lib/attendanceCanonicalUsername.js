import { ensureRepListMachineCodeColumn } from "@/lib/ensureRepListMachineCode";

export function normalizeUsernameKey(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function normalizeUsernameDisplay(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function pickLongerUsername(a, b) {
  if (!b) return a;
  if (!a) return b;
  return b.length > a.length ? b : a;
}

/** One CRM login per empId / machine_code (handles duplicate rep_list spellings). */
export async function loadRepListCanonicalUsernameMaps(conn) {
  await ensureRepListMachineCodeColumn(conn);
  const [rows] = await conn.query(
    `SELECT username, empId, TRIM(machine_code) AS machine_code
     FROM rep_list
     WHERE status = 1`
  );

  const canonicalByEmpId = new Map();
  for (const row of rows || []) {
    const u = normalizeUsernameDisplay(row.username);
    if (!u) continue;
    const empId =
      row.empId != null && row.empId !== "" ? String(row.empId) : null;
    if (empId) {
      canonicalByEmpId.set(
        empId,
        pickLongerUsername(canonicalByEmpId.get(empId), u),
      );
    }
  }

  const canonicalByNorm = new Map();
  const canonicalByMachineCode = new Map();
  for (const row of rows || []) {
    const u = normalizeUsernameDisplay(row.username);
    if (!u) continue;
    const empId =
      row.empId != null && row.empId !== "" ? String(row.empId) : null;
    const canon =
      empId && canonicalByEmpId.has(empId)
        ? canonicalByEmpId.get(empId)
        : u;
    const norm = normalizeUsernameKey(u);
    if (norm) {
      canonicalByNorm.set(
        norm,
        pickLongerUsername(canonicalByNorm.get(norm), canon),
      );
    }
    const mc = String(row.machine_code || "").trim();
    if (mc) {
      canonicalByMachineCode.set(
        mc,
        pickLongerUsername(canonicalByMachineCode.get(mc), canon),
      );
    }
  }

  return { canonicalByEmpId, canonicalByNorm, canonicalByMachineCode };
}

export function resolveCanonicalUsername(rawUsername, maps, extras = {}) {
  if (!maps) return normalizeUsernameDisplay(rawUsername);
  const { canonicalByEmpId, canonicalByNorm, canonicalByMachineCode } = maps;
  const empId =
    extras.employee_id != null && extras.employee_id !== ""
      ? String(extras.employee_id)
      : null;
  const mc = extras.machine_code ? String(extras.machine_code).trim() : "";
  if (empId && canonicalByEmpId?.has(empId)) {
    return canonicalByEmpId.get(empId);
  }
  if (mc && canonicalByMachineCode?.has(mc)) {
    return canonicalByMachineCode.get(mc);
  }
  const norm = normalizeUsernameKey(rawUsername);
  if (norm && canonicalByNorm?.has(norm)) {
    return canonicalByNorm.get(norm);
  }
  return normalizeUsernameDisplay(rawUsername);
}

export function applyCanonicalUsernameToRow(row, maps) {
  if (!row) return row;
  row.username = resolveCanonicalUsername(row.username, maps, {
    employee_id: row.employee_id ?? row.empId,
    machine_code: row.machine_code,
  });
  return row;
}
