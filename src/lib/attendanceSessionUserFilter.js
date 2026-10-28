/** Keep only attendance rows for the logged-in employee (personal dashboards). */
export function attendanceRowsForSessionUser(attendance, username) {
  const rows = Array.isArray(attendance) ? attendance : [];
  const me = String(username || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (!me) return rows;
  return rows.filter((row) => {
    const who = String(row?.username || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
    return !who || who === me;
  });
}
