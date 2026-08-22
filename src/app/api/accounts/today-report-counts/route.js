import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { PAYMENT_PENDING_ORDER_SQL_WHERE } from "@/lib/paymentPendingFilters";

async function columnExists(conn, tableName, columnName) {
  const [rows] = await conn.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]);
  return rows.length > 0;
}

async function tableExists(conn, tableName) {
  const [rows] = await conn.query("SHOW TABLES LIKE ?", [tableName]);
  return rows.length > 0;
}

async function getPaymentPendingCountLikeReport(conn) {
  const [rows] = await conn.query(
    `SELECT
      o.order_id,
      o.quote_number,
      o.totalamt,
      o.payment_amount,
      o.is_returned
     FROM neworder AS o
     WHERE ${PAYMENT_PENDING_ORDER_SQL_WHERE}`
  );

  const deductionByOrder = new Map();
  if (rows.length > 0) {
    try {
      const orderIds = rows.map((order) => order.order_id);
      const placeholders = orderIds.map(() => "?").join(",");
      const [deductionRows] = await conn.query(
        `SELECT order_id, COALESCE(SUM(amount), 0) AS total
         FROM payment_deductions
         WHERE order_id IN (${placeholders})
         GROUP BY order_id`,
        orderIds
      );
      for (const row of deductionRows) {
        deductionByOrder.set(row.order_id, parseFloat(row.total || 0));
      }
    } catch {
      // Keep remaining without deductions if table is missing.
    }
  }

  let pendingCount = 0;

  for (const order of rows) {
    let totalAmt = parseFloat(order.totalamt || 0);

    // Keep return-adjustment logic in sync with payment-pending report.
    if (Number(order.is_returned) === 2 && order.quote_number) {
      try {
        const [returnedItems] = await conn.query(
          `SELECT item_code, quantity_returned FROM order_return_items WHERE order_id = ?`,
          [order.order_id]
        );

        if (returnedItems.length > 0) {
          const itemCodes = returnedItems.map((item) => item.item_code);
          const placeholders = itemCodes.map(() => "?").join(",");
          const [quotationItems] = await conn.query(
            `SELECT item_code, total_price, quantity FROM quotation_items
             WHERE quote_number = ? AND item_code IN (${placeholders})`,
            [order.quote_number, ...itemCodes]
          );

          let returnedValue = 0;
          returnedItems.forEach((returnedItem) => {
            const quotItem = quotationItems.find((q) => q.item_code === returnedItem.item_code);
            if (quotItem) {
              const qty = parseInt(quotItem.quantity, 10);
              if (qty > 0) {
                const pricePerUnit = parseFloat(quotItem.total_price) / qty;
                returnedValue += pricePerUnit * Number(returnedItem.quantity_returned || 0);
              }
            }
          });

          totalAmt -= returnedValue;
        }
      } catch {
        // Ignore per-order calc failure and keep original totalAmt.
      }
    }

    const paidAmount = (order.payment_amount || "")
      .toString()
      .split(",")
      .map((s) => parseFloat(s.trim()) || 0)
      .reduce((sum, amt) => sum + amt, 0);

    const deductionAmount = deductionByOrder.get(order.order_id) || 0;
    const remaining = totalAmt - paidAmount - deductionAmount;
    if (remaining > 0) pendingCount += 1;
  }

  return pendingCount;
}

async function getScopedOrderWhereClause(conn, session) {
  const username = session?.username || "";
  let role = (session?.role || "").toString().trim().toUpperCase();

  // Match orders page: role comes from rep_list.userRole
  if (username) {
    try {
      const [roleRows] = await conn.execute(
        "SELECT userRole FROM rep_list WHERE username = ? LIMIT 1",
        [username]
      );
      const dbRole = roleRows?.[0]?.userRole;
      if (dbRole) role = String(dbRole).trim().toUpperCase();
    } catch {
      // Ignore and keep session role fallback.
    }
  }

  const clauses = [];
  const params = [];
  const fullAccessRoles = ["ACCOUNTANT", "ADMIN", "WAREHOUSE INCHARGE", "TEAM LEADER"];

  if (role === "SERVICE HEAD") {
    clauses.push(
      `(o.created_by COLLATE utf8mb4_unicode_ci = ?
        OR o.created_by COLLATE utf8mb4_unicode_ci NOT IN (
          SELECT username COLLATE utf8mb4_unicode_ci
          FROM rep_list
          WHERE userRole LIKE '%SALES%'
        ))`
    );
    params.push(username);
  } else if (!fullAccessRoles.includes(role)) {
    clauses.push("o.created_by = ?");
    params.push(username);
  }

  return { clause: clauses.length ? ` AND ${clauses.join(" AND ")}` : "", params };
}

async function getInvoicePendingCountLikeOrderPage(conn, session) {
  const { clause, params } = await getScopedOrderWhereClause(conn, session);
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS count
     FROM neworder o
     WHERE (o.approval_status IS NULL OR LOWER(TRIM(o.approval_status)) != 'pending')
       AND (o.is_returned IS NULL OR o.is_returned = 0)
       AND (o.is_cancelled IS NULL OR o.is_cancelled = 0)
       AND (o.approval_status IS NULL OR LOWER(TRIM(o.approval_status)) != 'rejected')
       AND (o.installation_status IS NULL OR o.installation_status = 0)
       AND (o.delivery_status IS NULL OR o.delivery_status = 0)
       AND (o.dispatch_status IS NULL OR o.dispatch_status = 0)
       AND (o.booking_id IS NULL OR TRIM(CAST(o.booking_id AS CHAR)) = '' OR TRIM(CAST(o.booking_id AS CHAR)) = '0')
       AND (o.report_file IS NULL OR TRIM(o.report_file) = '')
       ${clause}`,
    params
  );
  return rows?.[0]?.count || 0;
}

export async function GET() {
  let conn;

  try {
    const session = await getSessionPayload();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pool = await getDbConnection();
    conn = await pool.getConnection();

    const hasPaymentStatus = await columnExists(conn, "neworder", "payment_status");

    // Match accounts order page "Pending Invoice" status derivation + role scope.
    const invoicePendingCount = await getInvoicePendingCountLikeOrderPage(conn, session);

    // 2. Unsettled Payment Count (matches StatementTable isSettledRow/display logic)
    let unsettledPaymentCount = 0;
    const hasStatementsTable = await tableExists(conn, "statements");
    if (hasStatementsTable) {
      const [unsettledPaymentRows] = await conn.execute(
        `SELECT COUNT(*) AS count
         FROM statements s
         WHERE NOT (
           TRIM(COALESCE(s.invoice_status, '')) = 'Settled'
           OR (s.client_expense_id IS NOT NULL AND TRIM(CAST(s.client_expense_id AS CHAR)) <> '')
           OR (s.dd_id IS NOT NULL AND TRIM(CAST(s.dd_id AS CHAR)) <> '')
           OR (
             s.linked_module_type = 'Assets'
             AND s.linked_module_id IS NOT NULL
             AND TRIM(CAST(s.linked_module_id AS CHAR)) <> ''
           )
           OR (
             s.linked_purchase_ids IS NOT NULL
             AND TRIM(s.linked_purchase_ids) <> ''
             AND TRIM(s.linked_purchase_ids) <> '[]'
           )
           OR (s.failed_transaction_id IS NOT NULL AND TRIM(CAST(s.failed_transaction_id AS CHAR)) <> '')
           OR (s.cancelled_transaction_id IS NOT NULL AND TRIM(CAST(s.cancelled_transaction_id AS CHAR)) <> '')
         )`
      );
      unsettledPaymentCount = unsettledPaymentRows[0]?.count || 0;
    }

    let paymentPendingCount = 0;
    if (hasPaymentStatus) {
      paymentPendingCount = await getPaymentPendingCountLikeReport(conn);
    }

    // 4. Task Pending Count (all time) - support both "task" and "tasks" schemas
    let taskPendingCount = 0;
    const hasTaskTable = await tableExists(conn, "task");
    const hasTasksTable = !hasTaskTable && (await tableExists(conn, "tasks"));
    if (hasTaskTable || hasTasksTable) {
      const taskTable = hasTaskTable ? "task" : "tasks";
      const [hasCreatedBy, hasTaskAssignTo] = await Promise.all([
        columnExists(conn, taskTable, "createdby"),
        columnExists(conn, taskTable, "taskassignto"),
      ]);

      // Match accounts task-manager page scope: tasks created by OR assigned to current user.
      if (hasCreatedBy && hasTaskAssignTo && session?.username) {
        const [taskPendingRows] = await conn.execute(
          `SELECT COUNT(*) AS count
           FROM \`${taskTable}\`
           WHERE LOWER(TRIM(status)) = 'pending'
             AND (createdby = ? OR taskassignto = ?)`,
          [session.username, session.username]
        );
        taskPendingCount = taskPendingRows[0]?.count || 0;
      } else {
        const [taskPendingRows] = await conn.execute(
          `SELECT COUNT(*) AS count
           FROM \`${taskTable}\`
           WHERE LOWER(TRIM(status)) = 'pending'`
        );
        taskPendingCount = taskPendingRows[0]?.count || 0;
      }
    }

    // 5. Expense cards counts
    let expensePaymentPendingCount = 0; // approved but not linked to statements
    let expenseApprovePendingCount = 0; // not yet approved
    const hasExpensesTable = await tableExists(conn, "expenses");
    if (hasExpensesTable) {
      const [hasExpenseApprovalStatus, hasExpenseStatus, hasLinkedStatementIds] = await Promise.all([
        columnExists(conn, "expenses", "approval_status"),
        columnExists(conn, "expenses", "status"),
        columnExists(conn, "expenses", "linked_statement_ids"),
      ]);

      if (hasExpenseApprovalStatus) {
        const [expenseApprovePendingRows] = await conn.execute(
          `SELECT COUNT(*) AS count
           FROM expenses
           WHERE approval_status IS NULL
              OR TRIM(approval_status) = ''
              OR LOWER(TRIM(approval_status)) = 'pending'`
        );
        expenseApprovePendingCount = expenseApprovePendingRows[0]?.count || 0;

        if (hasLinkedStatementIds) {
          const [expensePaymentPendingRows] = await conn.execute(
            `SELECT COUNT(*) AS count
             FROM expenses
             WHERE LOWER(TRIM(COALESCE(approval_status, ''))) = 'approved'
               AND (
                 linked_statement_ids IS NULL
                 OR TRIM(linked_statement_ids) = ''
                 OR TRIM(linked_statement_ids) = '[]'
               )`
          );
          expensePaymentPendingCount = expensePaymentPendingRows[0]?.count || 0;
        }
      } else if (hasExpenseStatus) {
        const [expenseApprovePendingRows] = await conn.execute(
          `SELECT COUNT(*) AS count
           FROM expenses
           WHERE status IS NULL
              OR TRIM(status) = ''
              OR LOWER(TRIM(status)) = 'pending'`
        );
        expenseApprovePendingCount = expenseApprovePendingRows[0]?.count || 0;
      }
    }

    // 6. DD/EMD Cards counts
    let ddEmdOverdueCount = 0;
    let ddEmdOverdueValue = 0;
    let ddEmdTotalAmount = 0;
    const hasDdRecordsTable = await tableExists(conn, "dd_records");
    if (hasDdRecordsTable) {
      // Apply role-based filtering similar to DD management API
      const userRole = session?.role?.toUpperCase() || "GUEST";
      const username = session?.username || session?.name;
      const isPrivileged = ["SUPERADMIN", "ADMIN", "ACCOUNTANT", "DIRECTOR"].includes(userRole);
      
      let roleCondition = "";
      let roleParams = [];
      if (!isPrivileged && username) {
        roleCondition = " AND assigned_by = ?";
        roleParams.push(username);
      }

      // Check which date columns actually exist to avoid SQL errors
      const hasExpiryDate = await columnExists(conn, "dd_records", "expiry_date");
      const hasClaimExpiryDate = await columnExists(conn, "dd_records", "claim_expiry_date");
      const hasOverdueDate = await columnExists(conn, "dd_records", "overdue_date");

      const dateConditions = [];
      if (hasExpiryDate) dateConditions.push(`(expiry_date IS NOT NULL AND expiry_date != '0000-00-00' AND DATE(expiry_date) < CURDATE())`);
      if (hasClaimExpiryDate) dateConditions.push(`(claim_expiry_date IS NOT NULL AND claim_expiry_date != '0000-00-00' AND DATE(claim_expiry_date) < CURDATE())`);
      if (hasOverdueDate) dateConditions.push(`(overdue_date IS NOT NULL AND overdue_date != '0000-00-00' AND DATE(overdue_date) < CURDATE())`);

      // DD/EMD Overdue - records that are NOT yet Claimed/Unclaimed AND have any date before today
      // Count ALL non-claimed records (Assigned / Filled / Issued / Sent to Client) whose any date has passed
      // IMPORTANT: Only run overdue query if at least one date column exists,
      // otherwise all non-claimed records would be incorrectly counted as overdue
      if (dateConditions.length > 0) {
        const dateWhere = ` AND (${dateConditions.join(" OR ")})`;
        const ddOverdueQuery = `SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total_value
           FROM dd_records 
           WHERE (
             claim_from_bank = 0 
             AND (status IS NULL OR status NOT IN ('Claimed', 'Unclaimed'))
             ${dateWhere}
           )${roleCondition}`;
        
        console.log("DD Overdue Count Query:", ddOverdueQuery);
        console.log("DD Overdue Count Params:", roleParams);
        
        let ddOverdueRows;
        try {
          [ddOverdueRows] = await conn.execute(ddOverdueQuery, roleParams);
          ddEmdOverdueCount = ddOverdueRows?.[0]?.count || 0;
          ddEmdOverdueValue = Number(ddOverdueRows?.[0]?.total_value || 0);
        } catch (ddErr) {
          console.warn("DD overdue count query failed (fallback to 0):", ddErr.message);
          ddEmdOverdueCount = 0;
          ddEmdOverdueValue = 0;
        }
      } else {
        console.warn("No date columns found for DD overdue check - keeping count as 0");
      }

      // DD/EMD Total Amount - sum of ALL records in dd_records table
      try {
        const [ddTotalRows] = await conn.execute(
          `SELECT COALESCE(SUM(amount), 0) AS total_amount
           FROM dd_records 
           WHERE 1=1${roleCondition}`,
          roleParams
        );
        ddEmdTotalAmount = Number(ddTotalRows?.[0]?.total_amount || 0);
      } catch (ddTotalErr) {
        console.warn("DD total amount query failed (fallback to 0):", ddTotalErr.message);
        ddEmdTotalAmount = 0;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        invoicePending: invoicePendingCount,
        unsettledPayment: unsettledPaymentCount,
        paymentPending: paymentPendingCount,
        taskPending: taskPendingCount,
        expensePaymentPending: expensePaymentPendingCount,
        expenseApprovePending: expenseApprovePendingCount,
        ddEmdOverdueCount: ddEmdOverdueCount,
        ddEmdOverdueValue: ddEmdOverdueValue,
        ddEmdTotalAmount: ddEmdTotalAmount,
        // Backward-compat key for any old consumer.
        expensePending: expenseApprovePendingCount,
      },
    });
  } catch (error) {
    console.error("Error fetching today report counts:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  } finally {
    if (conn) conn.release();
  }
}
