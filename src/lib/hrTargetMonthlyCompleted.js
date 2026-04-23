import { normalizeDesignationKey } from "@/lib/designationDedupe";

/**
 * Shared logic for HR monthly targets: order revenue + hiring count per designation bucket.
 * Used by /api/empcrm/hr-target-chart and Superadmin dashboard.
 */

/**
 * @param {import("mysql2/promise").Connection} conn
 * @param {string | null} [forTargetCity] When set, completed hires must match `candidates.hiring_city` (and order revenue is not counted).
 */
export async function computeCompletedForDesignation(
  conn,
  username,
  year,
  month,
  forCompletedDesignation,
  forTargetCity = null
) {
  const d = (forCompletedDesignation || "").trim();
  if (!d) return 0;
  const targetKey = normalizeDesignationKey(d);
  const targetCity = String(forTargetCity ?? "").trim();

  let orderCompleted = 0;
  if (!targetCity) {
    try {
      const [nameRows] = await conn.execute(
        `SELECT username FROM employee_profiles
         WHERE LOWER(TRIM(COALESCE(designation, ''))) = LOWER(TRIM(?))`,
        [d]
      );
      const names = (nameRows || []).map((r) => String(r.username || "").trim()).filter(Boolean);
      if (names.length > 0) {
        const ph = names.map(() => "?").join(", ");
        const [sumRows] = await conn.execute(
          `SELECT COALESCE(SUM(COALESCE(totalamt, 0)), 0) AS completed
           FROM neworder
           WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?
             AND LOWER(TRIM(COALESCE(created_by, ''))) IN (${ph})`,
          [year, month, ...names.map((n) => n.toLowerCase())]
        );
        orderCompleted = sumRows[0]?.completed != null ? Number(sumRows[0].completed) : 0;
      }
    } catch (sumErr) {
      console.error("[hrTargetMonthlyCompleted] order completed skipped:", sumErr?.message || sumErr);
      orderCompleted = 0;
    }
  }

  const citySql = targetCity
    ? ` AND LOWER(TRIM(COALESCE(c.hiring_city, ''))) = LOWER(TRIM(?)) `
    : "";
  const hireBaseParams = targetCity
    ? [username, targetCity, year, month, year, month]
    : [username, year, month, year, month];

  let hireCompleted = 0;
  try {
    /**
     * "Done" for hires uses the month/year when status became Hired (audit `logged_at`),
     * not joining date — so next-month `hire_date` still credits the month they were marked Hired.
     * Legacy rows with no Hired row in `candidates_followups` fall back to `hire_date` month.
     */
    const [hireRows] = await conn.execute(
      `SELECT TRIM(c.designation) AS desig FROM candidates c
       WHERE LOWER(TRIM(c.created_by)) = LOWER(TRIM(?))
         AND LOWER(TRIM(COALESCE(c.status, ''))) = 'hired'
         ${citySql}
         AND (
           EXISTS (
             SELECT 1 FROM candidates_followups f
             WHERE f.entry_id = c.id
               AND LOWER(TRIM(COALESCE(f.status, ''))) = 'hired'
               AND YEAR(f.logged_at) = ? AND MONTH(f.logged_at) = ?
           )
           OR (
             NOT EXISTS (
               SELECT 1 FROM candidates_followups f
               WHERE f.entry_id = c.id AND LOWER(TRIM(COALESCE(f.status, ''))) = 'hired'
             )
             AND c.hire_date IS NOT NULL
             AND YEAR(c.hire_date) = ? AND MONTH(c.hire_date) = ?
           )
         )`,
      hireBaseParams
    );
    hireCompleted = (hireRows || []).filter(
      (r) => normalizeDesignationKey(r.desig ?? "") === targetKey
    ).length;
  } catch (hireErr) {
    const msg = String(hireErr?.message || "");
    if (msg.includes("candidates_followups") && (msg.includes("doesn't exist") || msg.includes("Unknown table"))) {
      try {
        const legCitySql = targetCity
          ? ` AND LOWER(TRIM(COALESCE(hiring_city, ''))) = LOWER(TRIM(?)) `
          : "";
        const legParams = targetCity ? [username, targetCity, year, month] : [username, year, month];
        const [hireRowsLegacy] = await conn.execute(
          `SELECT TRIM(designation) AS desig FROM candidates
           WHERE LOWER(TRIM(created_by)) = LOWER(TRIM(?))
             AND LOWER(TRIM(COALESCE(status, ''))) = 'hired'
             ${legCitySql}
             AND hire_date IS NOT NULL
             AND YEAR(hire_date) = ? AND MONTH(hire_date) = ?`,
          legParams
        );
        hireCompleted = (hireRowsLegacy || []).filter(
          (r) => normalizeDesignationKey(r.desig ?? "") === targetKey
        ).length;
      } catch (e2) {
        if (!String(e2?.message || "").includes("candidates")) {
          console.error("[hrTargetMonthlyCompleted] hire count legacy skipped:", e2?.message || e2);
        }
        hireCompleted = 0;
      }
    } else if (!msg.includes("candidates")) {
      console.error("[hrTargetMonthlyCompleted] hire count skipped:", hireErr?.message || hireErr);
    }
  }

  return orderCompleted + hireCompleted;
}

/** Targets + completed for one HR username (rows with hr_username set for that month). */
export async function buildItemsForHrUsername(conn, username, year, month) {
  let hasCity = false;
  try {
    const [cols] = await conn.execute(`SHOW COLUMNS FROM hr_designation_monthly_targets LIKE 'city'`);
    hasCity = (cols || []).length > 0;
  } catch {
    hasCity = false;
  }

  const selectCols = hasCity ? "designation, target_amount, city" : "designation, target_amount";

  const [userRows] = await conn.execute(
    `SELECT ${selectCols} FROM hr_designation_monthly_targets
     WHERE year = ? AND month = ? AND TRIM(hr_username) <> ''
       AND LOWER(TRIM(hr_username)) = LOWER(TRIM(?))
     ORDER BY designation ASC`,
    [year, month, username]
  );
  const items = [];
  for (const row of userRows) {
    const des = String(row.designation || "").trim();
    const tgt = row.target_amount != null ? Number(row.target_amount) : 0;
    const cityRaw = hasCity ? String(row.city || "").trim() : "";
    const cityFilter = hasCity && cityRaw ? cityRaw : null;
    const completed = await computeCompletedForDesignation(conn, username, year, month, des, cityFilter);
    const city = hasCity ? cityRaw : "";
    items.push({ designation: des, target: tgt, completed, city });
  }
  return items;
}
