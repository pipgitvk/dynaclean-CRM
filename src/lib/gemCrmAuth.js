export function isGemCrmRoleAllowed(role) {
  return ["SUPERADMIN", "GEM"].includes(String(role || "").trim().toUpperCase());
}

export async function resolveGemCrmEmployeeId(conn, payload) {
  const direct = payload?.empId || payload?.id || null;
  if (direct) return direct;

  const username = String(payload?.username || "").trim();
  if (!username) return null;

  const [empRows] = await conn.execute(
    "SELECT empId FROM emplist WHERE LOWER(username) = LOWER(?) LIMIT 1",
    [username]
  );
  if (empRows?.[0]?.empId) return empRows[0].empId;

  const [repRows] = await conn.execute(
    "SELECT empId FROM rep_list WHERE LOWER(username) = LOWER(?) LIMIT 1",
    [username]
  );
  return repRows?.[0]?.empId || null;
}
