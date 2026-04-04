/** MySQL "YYYY-MM-DD HH:mm:ss" or ISO → value for <input type="datetime-local" /> */
export function mysqlDatetimeToDatetimeLocalValue(v) {
  if (v == null || v === "") return "";
  const s = String(v).trim().replace(" ", "T");
  if (s.length >= 16) return s.slice(0, 16);
  return s;
}

/** datetime-local → MySQL datetime string or null if empty */
export function datetimeLocalToMysql(v) {
  if (v == null || v === "") return null;
  const t = String(v).trim();
  if (!t) return null;
  if (t.includes("T")) return `${t.replace("T", " ")}:00`;
  return `${t}:00`;
}
