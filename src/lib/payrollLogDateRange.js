/**
 * Attendance log fetch range for salary pay-days: include up to 6 days before
 * month start so Mon–Sat before the 1st Sunday of the month are available.
 */
export function getPayrollAttendanceLogDateRange(monthStr) {
  const parts = String(monthStr).split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return null;
  }
  const monthStart = new Date(y, m - 1, 1);
  const from = new Date(monthStart);
  from.setDate(from.getDate() - 6);
  const to = new Date(y, m, 0);
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { from: fmt(from), to: fmt(to) };
}
