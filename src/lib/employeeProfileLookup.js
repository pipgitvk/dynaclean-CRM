export function normalizeUserKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

function profileScore(p) {
  if (!p) return 0;
  let s = 0;
  if (p.date_of_joining) s += 4;
  if (p.father_name) s += 4;
  if (p.full_name) s += 2;
  if (p.employee_code) s += 1;
  return s;
}

/** Index profiles by username, empId, and employee_code (best row wins per key). */
export function buildEmployeeProfileIndex(profiles) {
  const index = new Map();

  const put = (rawKey, row) => {
    const key = normalizeUserKey(rawKey);
    if (!key) return;
    const prev = index.get(key);
    if (!prev || profileScore(row) > profileScore(prev)) {
      index.set(key, row);
    }
  };

  for (const p of profiles || []) {
    put(p.username, p);
    put(p.empId, p);
    put(p.employee_code, p);
  }

  return index;
}

export function resolveEmployeeProfile(emp, index) {
  if (!emp || !index) return null;
  const keys = [
    emp.username,
    emp.empId,
  ].filter((k) => k != null && String(k).trim() !== "");

  for (const k of keys) {
    const hit = index.get(normalizeUserKey(k));
    if (hit) return hit;
  }
  return null;
}

export function pickDateOfJoining(profile) {
  if (!profile) return null;
  const raw =
    profile.date_of_joining ??
    profile.joining_date ??
    profile.doj ??
    null;
  if (raw == null || raw === "") return null;
  return raw;
}

export function pickFatherOrSpouseName(profile) {
  if (!profile) return "";
  return (
    profile.father_name ||
    profile.father_or_spouse_name ||
    profile.fathers_name ||
    profile.husband_name ||
    ""
  );
}

export function formatDojDisplay(d) {
  if (!d) return "";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d.trim())) {
    const [y, m, day] = d.trim().slice(0, 10).split("-").map(Number);
    if (y && m && day) {
      return `${String(day).padStart(2, "0")}-${months[m - 1]}-${String(y).slice(-2)}`;
    }
  }
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  const day = String(dt.getUTCDate()).padStart(2, "0");
  const mon = months[dt.getUTCMonth()];
  const yr = String(dt.getUTCFullYear()).slice(-2);
  return `${day}-${mon}-${yr}`;
}

/** Load employee_profiles without optional columns that may be missing in older DBs. */
export async function loadEmployeeProfilesRows(db) {
  const sqlVariants = [
    `SELECT username, full_name, employee_code, empId, father_name, date_of_joining FROM employee_profiles`,
    `SELECT username, full_name, empId, father_name, date_of_joining FROM employee_profiles`,
    `SELECT username, full_name, empId, date_of_joining FROM employee_profiles`,
  ];
  for (const sql of sqlVariants) {
    try {
      const [rows] = await db.query(sql);
      return rows || [];
    } catch {
      /* try simpler select */
    }
  }
  try {
    const [rows] = await db.query(`SELECT * FROM employee_profiles`);
    return rows || [];
  } catch (e) {
    console.error("loadEmployeeProfilesRows failed:", e);
    return [];
  }
}
