import { getDbConnection } from "@/lib/db";

const EXPENSE_LIST_SQL = `
  SELECT e.ID, e.TravelDate, e.timestamp, e.attachments, e.travel_mode, e.train_class, e.ConveyanceMode,
         e.expense_status,
         e.FromLocation, e.Tolocation,
         e.TicketCost, e.HotelCost, e.MealsCost, e.OtherExpenses,
         e.person_name, e.person_contact, e.designation, e.service_type, e.service_id,
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

/** Hub KPI — same rule as ExpenseTable “Pending approval” bucket. */
export async function countExpensePendingApproval(conn, { from = "", to = "" } = {}) {
  let sql = `
    SELECT COUNT(*) AS c
    FROM expenses e
    WHERE LOWER(TRIM(COALESCE(e.approval_status, 'pending'))) IN ('pending', 'pending approval')
      AND (
        e.approved_amount IS NULL
        OR CAST(COALESCE(e.approved_amount, 0) AS DECIMAL(12, 2)) <= 0
      )`;
  const params = [];
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

/** Shared expense list for all-expenses and SBI expense approval dashboard. */
export async function fetchExpenseDashboardRows() {
  const conn = await getDbConnection();
  await ensureExpenseLinkedStatementColumn(conn);
  await ensureExpenseTravelModeColumn(conn);
  await ensureExpenseTrainClassColumn(conn);
  await ensureExpenseRejectionRemarkColumn(conn);
  await ensureExpenseServiceTypeColumn(conn);
  await ensureExpenseServiceIdColumn(conn);
  await ensureExpenseStatusColumn(conn);
  await ensureExpenseDesignationColumn(conn);
  const [results] = await conn.execute(EXPENSE_LIST_SQL);
  return results;
}