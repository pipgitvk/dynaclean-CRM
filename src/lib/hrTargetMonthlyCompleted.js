/**
 * Shared logic for HR monthly targets: order revenue + hiring count per designation bucket.
 * Used by /api/empcrm/hr-target-chart and Superadmin dashboard.
 */

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

  let hireCompleted = 0;
  try {
    const [hireRows] = await conn.execute(
      `SELECT COUNT(*) AS c FROM candidates
       WHERE LOWER(TRIM(created_by)) = LOWER(TRIM(?))
         AND YEAR(hire_date) = ? AND MONTH(hire_date) = ?
         AND LOWER(TRIM(designation)) = LOWER(TRIM(?))`,
      [username, year, month, d]
    );
    hireCompleted = Number(hireRows[0]?.c ?? 0) || 0;
  } catch (hireErr) {
    if (!String(hireErr?.message || "").includes("candidates")) {
      console.error("[hrTargetMonthlyCompleted] hire count skipped:", hireErr?.message || hireErr);
    }
    hireCompleted = 0;
  }

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
