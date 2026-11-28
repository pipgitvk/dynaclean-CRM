import { getDbConnection } from "@/lib/db";
import { normalizeRoleKey } from "@/lib/roleKeyUtils";

/** SERVICE SUPPORT / SALES CUM BACKOFFICE — expense list only for service engineers */
export function limitExpenseRowsToServiceEngineers(viewerRole) {
  const key = normalizeRoleKey(viewerRole);
  return key === "SERVICE SUPPORT" || key === "SALES CUM BACKOFFICE";
}

const EXPENSE_SERVICE_ENGINEER_ONLY_SQL = `
  AND EXISTS (
    SELECT 1 FROM rep_list r_eng
    WHERE TRIM(r_eng.username) = TRIM(e.username)
      AND UPPER(TRIM(COALESCE(r_eng.userRole, ''))) = 'SERVICE ENGINEER'
  )`;

const EXPENSE_LIST_SQL = `
  SELECT e.ID, e.TravelDate, e.timestamp, e.attachments, e.travel_mode, e.train_class, e.ConveyanceMode,
         e.expense_status,
         e.FromLocation, e.Tolocation,
         e.TicketCost, e.HotelCost, e.MealsCost, e.OtherExpenses,
         e.person_name, e.person_contact, e.designation, e.state, e.service_type, e.service_id,
         e.approved_amount, e.payment_date, e.approval_status, e.rejection_remark, e.username,
         e.linked_statement_ids, e.approved_by,
         COALESCE(r.status, 1) AS employee_status
  FROM expenses e
  LEFT JOIN rep_list r
    ON TRIM(r.username) = TRIM(e.username)
  ORDER BY e.TravelDate DESC
`;

export async function ensureExpenseLinkedStatementColumn(conn) {
  try {
    await conn.execute("SELECT linked_statement_ids FROM expenses LIMIT 1");
  } catch (_) {
    try {
      await conn.execute("ALTER TABLE expenses ADD COLUMN linked_statement_ids TEXT NULL");
    } catch (__) {}
  }
}

export async function ensureExpenseTravelModeColumn(conn) {
  try {
    await conn.execute("SELECT travel_mode FROM expenses LIMIT 1");
  } catch (_) {
    try {
      await conn.execute("ALTER TABLE expenses ADD COLUMN travel_mode VARCHAR(128) NULL");
      await conn.execute(
        `UPDATE expenses
         SET travel_mode = ConveyanceMode
         WHERE (travel_mode IS NULL OR TRIM(travel_mode) = '')
           AND ConveyanceMode IS NOT NULL
           AND TRIM(ConveyanceMode) != ''`,
      );
    } catch (__) {}
  }
}

export async function ensureExpenseTrainClassColumn(conn) {
  try {
    await conn.execute("SELECT train_class FROM expenses LIMIT 1");
  } catch (_) {
    try {
      await conn.execute("ALTER TABLE expenses ADD COLUMN train_class VARCHAR(128) NULL");
    } catch (__) {}
  }
}

export async function ensureExpenseServiceTypeColumn(conn) {
  try {
    await conn.execute("SELECT service_type FROM expenses LIMIT 1");
  } catch (_) {
    try {
      await conn.execute("ALTER TABLE expenses ADD COLUMN service_type VARCHAR(32) NULL");
    } catch (__) {}
  }
}

export async function ensureExpenseServiceIdColumn(conn) {
  try {
    await conn.execute("SELECT service_id FROM expenses LIMIT 1");
  } catch (_) {
    try {
      await conn.execute("ALTER TABLE expenses ADD COLUMN service_id VARCHAR(64) NULL");
    } catch (__) {}
  }
}

export async function ensureExpenseRejectionRemarkColumn(conn) {
  try {
    await conn.execute("SELECT rejection_remark FROM expenses LIMIT 1");
  } catch (_) {
    try {
      await conn.execute("ALTER TABLE expenses ADD COLUMN rejection_remark TEXT NULL");
    } catch (__) {}
  }
}

export async function ensureExpenseStateColumn(conn) {
  try {
    await conn.execute("SELECT state FROM expenses LIMIT 1");
  } catch (_) {
    try {
      await conn.execute("ALTER TABLE expenses ADD COLUMN state VARCHAR(64) NULL");
    } catch (__) {}
  }
}

export async function ensureExpenseDesignationColumn(conn) {
  try {
    await conn.execute("SELECT designation FROM expenses LIMIT 1");
  } catch (_) {
    try {
      await conn.execute("ALTER TABLE expenses ADD COLUMN designation VARCHAR(128) NULL");
    } catch (__) {}
  }
}

export async function ensureExpenseStatusColumn(conn) {
  try {
    await conn.execute("SELECT expense_status FROM expenses LIMIT 1");
  } catch (_) {
    try {
      await conn.execute("ALTER TABLE expenses ADD COLUMN expense_status VARCHAR(32) NULL");
    } catch (__) {}
  }
}

/** SBI / accounts — approved, no statement link, submit on or after this date */
export const SBI_PENDING_LINK_STATEMENTS_FROM_DATE = "2026-05-10";

/** Hub KPI — same rule as ExpenseTable “Pending approval” bucket. */
export async function countExpensePendingApproval(
  conn,
  { from = "", to = "", serviceEngineersOnly = false } = {},
) {
  let sql = `
    SELECT COUNT(*) AS c
    FROM expenses e
    WHERE LOWER(TRIM(COALESCE(e.approval_status, 'pending'))) IN ('pending', 'pending approval')
      AND (
        e.approved_amount IS NULL
        OR CAST(COALESCE(e.approved_amount, 0) AS DECIMAL(12, 2)) <= 0
      )`;
  const params = [];
  if (serviceEngineersOnly) {
    sql += EXPENSE_SERVICE_ENGINEER_ONLY_SQL;
  }
  if (from) {
    sql += " AND DATE(e.timestamp) >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND DATE(e.timestamp) <= ?";
    params.push(to);
  }
  const [rows] = await conn.execute(sql, params);
  return Number(rows?.[0]?.c || 0);
}

/** Accountant home KPI — matches ExpenseTable “Pending to linked statements”. */
export async function countExpensePendingLinkedStatements(
  conn,
  { serviceEngineersOnly = false } = {},
) {
  await ensureExpenseLinkedStatementColumn(conn);
  let sql = `
    SELECT COUNT(*) AS c
    FROM expenses e
    WHERE LOWER(TRIM(COALESCE(e.approval_status, ''))) = 'approved'
      AND (
        e.linked_statement_ids IS NULL
        OR TRIM(e.linked_statement_ids) = ''
        OR TRIM(e.linked_statement_ids) = '[]'
        OR TRIM(e.linked_statement_ids) = 'null'
      )
      AND e.timestamp IS NOT NULL
      AND TRIM(e.timestamp) NOT IN ('', '0000-00-00', '0000-00-00 00:00:00')
      AND DATE(e.timestamp) >= ?`;
  if (serviceEngineersOnly) {
    sql += EXPENSE_SERVICE_ENGINEER_ONLY_SQL;
  }
  const [rows] = await conn.execute(sql, [SBI_PENDING_LINK_STATEMENTS_FROM_DATE]);
  return Number(rows?.[0]?.c || 0);
}

/** Shared expense list for all-expenses and SBI expense approval dashboard. */
export async function fetchExpenseDashboardRows({ viewerRole } = {}) {
  const conn = await getDbConnection();
  await ensureExpenseLinkedStatementColumn(conn);
  await ensureExpenseTravelModeColumn(conn);
  await ensureExpenseTrainClassColumn(conn);
  await ensureExpenseRejectionRemarkColumn(conn);
  await ensureExpenseServiceTypeColumn(conn);
  await ensureExpenseServiceIdColumn(conn);
  await ensureExpenseStatusColumn(conn);
  await ensureExpenseDesignationColumn(conn);
  await ensureExpenseStateColumn(conn);
  let sql = EXPENSE_LIST_SQL;
  if (limitExpenseRowsToServiceEngineers(viewerRole)) {
    sql = sql.replace(
      "ORDER BY e.TravelDate DESC",
      `${EXPENSE_SERVICE_ENGINEER_ONLY_SQL} ORDER BY e.TravelDate DESC`,
    );
  }
  const [results] = await conn.execute(sql);
  return results;
}