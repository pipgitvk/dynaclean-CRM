import { appendSqlWhereClause, orderListApprovalWhereSql } from "@/lib/orderApprovalVisibility";
import { orderListReportWhereSql } from "@/lib/orderReportVisibility";
import { canViewAllOrders } from "@/lib/dataScope";
import { ensureOrderLinkedPaymentColumns } from "@/lib/ensureOrderLinkedPaymentColumns";
import { attachActiveInvoiceFields } from "@/lib/activeInvoiceForOrder";
import {
  ORDER_LIST_DISPATCHED_STOCK_COUNT_SELECT,
  ORDER_LIST_PENDING_DISPATCH_UNITS_SELECT,
} from "@/lib/orderDeliveryEligibility";
import {
  attachBookingBatchesToOrders,
  attachDispatchPendingToOrders,
} from "@/lib/orderBookingBatches";
import { attachDeliveryBatchesToOrders } from "@/lib/orderDeliveryBatches";

const PAYMENT_TERM_LABEL_TO_DAYS = {
  Advance: 0,
  COD: 9,
  "15 Days": 15,
  "30 Days": 30,
  "45 Days": 45,
  "60 Days": 60,
};

export async function ensureAccountsOrderListSchema(conn) {
  await ensureOrderLinkedPaymentColumns(conn);
  const safeAlters = [
    "ALTER TABLE neworder ADD COLUMN IF NOT EXISTS warehouse_in_done TINYINT(1) DEFAULT 0",
    "ALTER TABLE neworder ADD COLUMN IF NOT EXISTS warehouse_in_date DATE NULL",
    "ALTER TABLE neworder ADD COLUMN IF NOT EXISTS warehouse_in_image VARCHAR(500) NULL",
    "ALTER TABLE neworder ADD COLUMN IF NOT EXISTS warehouse_in_by VARCHAR(100) NULL",
    "ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS is_saved TINYINT(1) NOT NULL DEFAULT 0",
    "ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS saved_at DATETIME NULL DEFAULT NULL",
  ];
  for (const alter of safeAlters) {
    await conn.execute(alter).catch(() => {});
  }
}

export async function getAccountsOrderListUserRole(conn, username) {
  const [roleRows] = await conn.execute(
    "SELECT userRole FROM rep_list WHERE username = ?",
    [username],
  );
  return roleRows[0]?.userRole || "";
}

function buildAccountsOrderListBaseSql(userRole, username) {
  let sql = `SELECT 
                no.order_id, no.report_file, no.po_file, no.payment_proof, no.booking_url,
                no.client_name, no.contact, no.is_cancelled, no.dispatch_status,
                ${ORDER_LIST_DISPATCHED_STOCK_COUNT_SELECT},
                ${ORDER_LIST_PENDING_DISPATCH_UNITS_SELECT},
                no.created_at, no.created_by , no.einvoice_file, no.booking_id, no.quote_number, no.duedate,
                no.invoice_date , no.account_by ,no.booking_by , no.dispatch_person,
                no.payment_id, no.payment_date, no.payment_amount, no.payment_status,no.totalamt, no.baseAmount, no.taxamt, no.transaction_id,
                no.invoice_number, no.amount_received, no.payment_received_date, no.linked_payments_json,
                MAX(qr.grand_total) AS quotation_grand_total,
                no.delivery_date, no.delivered_on, no.delivery_status,no.delivery_proof,
                COALESCE(no.delivery_remark, '') as delivery_remark,
                no.installation_status, no.is_returned, no.approval_status, no.approval_remark, no.approval_date,
                COALESCE(no.return_booking_done, 0) as return_booking_done,
                no.return_booking_ref,
                no.return_booking_date,
                no.expected_pickup_date,
                no.return_booking_url,
                no.return_booking_remarks,
                no.return_booking_by,
                COALESCE(no.warehouse_in_done, 0) as warehouse_in_done,
                no.warehouse_in_date,
                no.warehouse_in_image,
                no.warehouse_in_by,
                CASE 
                  WHEN qr.payment_term_days = 0 THEN 'Advance'
                  WHEN qr.payment_term_days = 9 THEN 'COD'
                  WHEN qr.payment_term_days = 15 THEN '15 Days'
                  WHEN qr.payment_term_days = 30 THEN '30 Days'
                  WHEN qr.payment_term_days = 45 THEN '45 Days'
                  WHEN qr.payment_term_days = 60 THEN '60 Days'
                  ELSE CONCAT(qr.payment_term_days, ' Days')
                END as payment_terms,
                qr.company_name, qr.emp_name, qr.state,
                MAX(cn.id) as credit_note_id,
                MAX(cn.credit_note_number) as credit_note_number,
                GROUP_CONCAT(DISTINCT qi.item_name SEPARATOR ', ') as item_name,
                GROUP_CONCAT(DISTINCT qi.item_code SEPARATOR ', ') as item_code
            FROM 
                neworder no
            LEFT JOIN 
                quotations_records qr ON no.quote_number = qr.quote_number
            LEFT JOIN 
                quotation_items qi ON no.quote_number = qi.quote_number
            LEFT JOIN
                credit_notes cn ON CAST(cn.order_id AS CHAR) COLLATE utf8mb4_unicode_ci = CAST(no.order_id AS CHAR) COLLATE utf8mb4_unicode_ci AND cn.is_saved = 1`;

  const params = [];

  if (userRole === "SERVICE HEAD") {
    sql += `
    WHERE 
      no.created_by COLLATE utf8mb4_unicode_ci = ?
      OR no.created_by COLLATE utf8mb4_unicode_ci NOT IN (
        SELECT username COLLATE utf8mb4_unicode_ci 
        FROM rep_list 
        WHERE userRole LIKE '%SALES%'
      )`;
    params.push(username);
  } else if (
    !["ACCOUNTANT", "ADMIN", "WAREHOUSE INCHARGE", "TEAM LEADER"].includes(
      userRole,
    )
  ) {
    sql += " WHERE no.created_by = ?";
    params.push(username);
  }

  sql = appendSqlWhereClause(sql, orderListApprovalWhereSql(userRole));
  sql = appendSqlWhereClause(
    sql,
    orderListReportWhereSql(userRole, { seesAllOrders: canViewAllOrders(userRole) }),
  );

  sql = appendSqlWhereClause(
    sql,
    "(no.approval_status IS NULL OR no.approval_status <> 'pending')",
  );

  return { sql, params };
}

export async function fetchAccountsOrderListPage(
  conn,
  {
    username,
    userRole,
    page = 1,
    limit = 40,
    search = "",
    dateFrom = "",
    dateTo = "",
    createdBy = "",
    paymentTerms = "",
  } = {},
) {
  const offset = (Math.max(1, page) - 1) * limit;
  const fetchLimit = limit + 1;

  let { sql, params } = buildAccountsOrderListBaseSql(userRole, username);

  if (dateFrom) {
    sql = appendSqlWhereClause(sql, "no.created_at >= ?");
    params.push(`${dateFrom} 00:00:00`);
  }
  if (dateTo) {
    sql = appendSqlWhereClause(sql, "no.created_at <= ?");
    params.push(`${dateTo} 23:59:59`);
  }
  if (createdBy) {
    sql = appendSqlWhereClause(sql, "no.created_by = ?");
    params.push(createdBy);
  }
  if (paymentTerms) {
    const days = PAYMENT_TERM_LABEL_TO_DAYS[paymentTerms];
    if (days !== undefined) {
      sql = appendSqlWhereClause(sql, "qr.payment_term_days = ?");
      params.push(days);
    } else {
      const m = String(paymentTerms).match(/^(\d+)\s+Days$/i);
      if (m) {
        sql = appendSqlWhereClause(sql, "qr.payment_term_days = ?");
        params.push(Number(m[1]));
      }
    }
  }
  if (search) {
    const term = `%${search}%`;
    sql = appendSqlWhereClause(
      sql,
      `(no.order_id LIKE ? OR no.client_name LIKE ? OR qr.company_name LIKE ? OR no.contact LIKE ? OR qr.state LIKE ?)`,
    );
    params.push(term, term, term, term, term);
  }

  sql += " GROUP BY no.order_id ORDER BY no.created_at DESC LIMIT ? OFFSET ?";
  params.push(fetchLimit, offset);

  const [rows] = await conn.execute(sql, params);
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  let enrichedOrders = [...pageRows];
  enrichedOrders = await attachActiveInvoiceFields(conn, enrichedOrders);
  enrichedOrders = await attachBookingBatchesToOrders(conn, enrichedOrders);
  enrichedOrders = await attachDispatchPendingToOrders(conn, enrichedOrders);
  enrichedOrders = await attachDeliveryBatchesToOrders(conn, enrichedOrders);

  return {
    orders: enrichedOrders,
    hasMore,
    page,
    limit,
  };
}
