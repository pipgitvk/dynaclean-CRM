/**
 * Shared logic for HR monthly targets: order revenue + hiring count per designation bucket.
 * Used by /api/empcrm/hr-target-chart and Superadmin dashboard.
 *
 * Hiring “completed” counts rows where status is Hired, hire_date is set, and hire_date falls
 * in the selected month — so a target of 1 shows completed after one hire in that month.
 */

/**
 * @param {import("mysql2/promise").Connection} conn
 * @param {string} username HR who created the hiring row
 * @param {number} year
 * @param {number} month 1–12
 * @param {string} designation Row designation (must match target row)
 */
async function countMonthlyHiresForHr(conn, username, year, month, designation) {
  const d = (designation || "").trim();
  if (!d) return 0;
  const params = [username, year, month, d];
  const sqlLegacy = `
    SELECT COUNT(*) AS c FROM hr_hiring_entries
    WHERE LOWER(TRIM(created_by_username)) = LOWER(TRIM(?))
      AND hire_date IS NOT NULL
      AND YEAR(hire_date) = ? AND MONTH(hire_date) = ?
      AND LOWER(TRIM(designation)) = LOWER(TRIM(?))
      AND TRIM(COALESCE(status, '')) = 'Hired'`;
  try {
    const [hireRows] = await conn.execute(sqlLegacy, params);
    return Number(hireRows[0]?.c ?? 0) || 0;
  } catch (hireErr) {
    const msg = String(hireErr?.message || "");
    if (!msg.includes("hr_hiring_entries") && !msg.includes("doesn't exist") && !msg.includes("Unknown table")) {
      console.error("[hrTargetMonthlyCompleted] hire count (hr_hiring_entries):", hireErr?.message || hireErr);
      return 0;
    }
  }

  const sqlCandidates = `
    SELECT COUNT(*) AS c FROM candidates
    WHERE LOWER(TRIM(created_by_username)) = LOWER(TRIM(?))
      AND hire_date IS NOT NULL
      AND YEAR(hire_date) = ? AND MONTH(hire_date) = ?
      AND LOWER(TRIM(designation)) = LOWER(TRIM(?))
      AND TRIM(COALESCE(hiring_status, '')) = 'Hired'`;
  try {
    const [hireRows] = await conn.execute(sqlCandidates, params);
    return Number(hireRows[0]?.c ?? 0) || 0;
  } catch (hireErr2) {
    const msg2 = String(hireErr2?.message || "");
    if (msg2.includes("hiring_status") && msg2.includes("Unknown column")) {
      try {
        const sqlFallback = `
          SELECT COUNT(*) AS c FROM candidates
          WHERE LOWER(TRIM(created_by_username)) = LOWER(TRIM(?))
            AND hire_date IS NOT NULL
            AND YEAR(hire_date) = ? AND MONTH(hire_date) = ?
            AND LOWER(TRIM(designation)) = LOWER(TRIM(?))
            AND TRIM(COALESCE(status, '')) = 'Hired'`;
        const [hireRowsFb] = await conn.execute(sqlFallback, params);
        return Number(hireRowsFb[0]?.c ?? 0) || 0;
      } catch (e3) {
        console.error("[hrTargetMonthlyCompleted] hire count (candidates status):", e3?.message || e3);
        return 0;
      }
    }
    if (!msg2.includes("candidates") && !msg2.includes("doesn't exist") && !msg2.includes("Unknown table")) {
      console.error("[hrTargetMonthlyCompleted] hire count (candidates):", hireErr2?.message || hireErr2);
    }
    return 0;
  }
}

/** @param {import("mysql2/promise").Connection} conn */
export async function computeCompletedForDesignation(conn, username, year, month, forCompletedDesignation) {
  const d = (forCompletedDesignation || "").trim();
  if (!d) return 0;

  let orderCompleted = 0;
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

  const hireCompleted = await countMonthlyHiresForHr(conn, username, year, month, d);

  return orderCompleted + hireCompleted;
}

/** Targets + completed for one HR username (rows with hr_username set for that month). */
export async function buildItemsForHrUsername(conn, username, year, month) {
  const [userRows] = await conn.execute(
    `SELECT designation, target_amount FROM hr_designation_monthly_targets
     WHERE year = ? AND month = ? AND TRIM(hr_username) <> ''
       AND LOWER(TRIM(hr_username)) = LOWER(TRIM(?))
     ORDER BY designation ASC`,
    [year, month, username]
  );
  const items = [];
  for (const row of userRows) {
    const des = String(row.designation || "").trim();
    const tgt = row.target_amount != null ? Number(row.target_amount) : 0;
    const completed = await computeCompletedForDesignation(conn, username, year, month, des);
    items.push({ designation: des, target: tgt, completed });
  }
  return items;
}
