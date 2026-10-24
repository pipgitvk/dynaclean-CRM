import { canViewAllOrders } from "@/lib/dataScope";
import { orderListApprovalWhereSql } from "@/lib/orderApprovalVisibility";
import { orderListReportWhereSql } from "@/lib/orderReportVisibility";
import { ensureOrderLinkedPaymentColumns } from "@/lib/ensureOrderLinkedPaymentColumns";
import { attachActiveInvoiceFields } from "@/lib/activeInvoiceForOrder";
import {
  attachBookingBatchesToOrders,
  attachDispatchPendingToOrders,
} from "@/lib/orderBookingBatches";
import { attachDeliveryBatchesToOrders } from "@/lib/orderDeliveryBatches";

let orderListSchemaReady = false;

const ORDER_LIST_SCHEMA_ALTERS = [
  "ALTER TABLE neworder ADD COLUMN approval_remark TEXT NULL DEFAULT NULL",
  "ALTER TABLE neworder ADD COLUMN approval_date DATETIME NULL DEFAULT NULL",
  "ALTER TABLE neworder ADD COLUMN return_booking_done TINYINT(1) DEFAULT 0",
  "ALTER TABLE neworder ADD COLUMN return_booking_ref VARCHAR(255) NULL",
  "ALTER TABLE neworder ADD COLUMN return_booking_date DATE NULL",
  "ALTER TABLE neworder ADD COLUMN expected_pickup_date DATE NULL",
  "ALTER TABLE neworder ADD COLUMN return_booking_url VARCHAR(500) NULL",
  "ALTER TABLE neworder ADD COLUMN return_booking_remarks TEXT NULL",
  "ALTER TABLE neworder ADD COLUMN return_booking_by VARCHAR(255) NULL",
  "ALTER TABLE neworder ADD COLUMN warehouse_in_done TINYINT(1) DEFAULT 0",
  "ALTER TABLE neworder ADD COLUMN warehouse_in_date DATE NULL",
  "ALTER TABLE neworder ADD COLUMN warehouse_in_image VARCHAR(500) NULL",
  "ALTER TABLE neworder ADD COLUMN warehouse_in_by VARCHAR(100) NULL",
  "ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS is_saved TINYINT(1) NOT NULL DEFAULT 0",
  "ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS saved_at DATETIME NULL DEFAULT NULL",
];

export async function ensureAdminOrderListSchema(conn) {
  if (orderListSchemaReady) return;
  await ensureOrderLinkedPaymentColumns(conn);
  for (const sql of ORDER_LIST_SCHEMA_ALTERS) {
    try {
      await conn.execute(sql);
    } catch (_) {}
  }
  orderListSchemaReady = true;
}

export async function getAdminOrderListUserRole(conn, username) {
  const [roleRows] = await conn.execute(
    "SELECT userRole FROM emplist WHERE username = ?",
    [username],
  );
  return roleRows[0]?.userRole || "";
}

function parseLineItemsFromRaw(raw) {
  if (typeof raw !== "string" || !raw) return [];
  return raw
    .split("||")
    .map((part) => {
      const [item_name, item_code, quantity] = part.split("::");
      return {
        item_name: item_name || "",
        item_code: item_code || "",
        quantity: Number(quantity) || 0,
      };
    })
    .filter((item) => item.item_name);
}

function buildAdminOrderListSql(userRole, username, serviceSupportOnly) {
  let sql = `SELECT 
                no.order_id, no.report_file, no.po_file, no.payment_proof, no.booking_url,
                no.client_name, no.contact, no.is_cancelled, no.dispatch_status,
                0 AS dispatched_stock_count,
                0 AS pending_dispatch_units,
                no.created_at, no.created_by , no.einvoice_file, no.booking_id, no.quote_number, no.duedate,
                no.invoice_date , no.account_by ,no.booking_by , no.dispatch_person,
                no.payment_id, no.payment_date, no.payment_amount, no.amount_received, no.payment_received_date,
                no.linked_payments_json,
                no.payment_status,no.totalamt, no.transaction_id,
                no.baseAmount, no.taxamt,
                no.delivery_date, no.delivered_on, no.delivery_status,no.delivery_proof,
                COALESCE(no.delivery_remark, '') as delivery_remark,
                no.installation_status, no.is_returned, no.approval_status, no.approval_remark, no.approval_date,
                COALESCE(no.return_booking_done, 0) as return_booking_done,
                no.invoice_number,
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
                qr.company_name, qr.emp_name, qr.state, qr.grand_total as quotation_grand_total, qr.subtotal as quotation_subtotal, qr.gst as quotation_gst,
                MAX(c.lead_campaign) AS lead_campaign,
                MAX(cn.id) as credit_note_id,
                MAX(cn.credit_note_number) as credit_note_number,
                GROUP_CONCAT(DISTINCT qi.item_name SEPARATOR ', ') as item_name,
                GROUP_CONCAT(DISTINCT qi.item_code SEPARATOR ', ') as item_code,
                COALESCE(SUM(COALESCE(qi.total_taxable_amt, qi.taxable_price, 0)), 0) AS order_taxable_total,
                GROUP_CONCAT(
                  CONCAT(
                    COALESCE(qi.item_name, ''),
                    '::',
                    COALESCE(qi.item_code, ''),
                    '::',
                    COALESCE(qi.quantity, 0)
                  )
                  SEPARATOR '||'
                ) AS line_items_raw
            FROM 
                neworder no
            LEFT JOIN 
                quotations_records qr ON no.quote_number = qr.quote_number
            LEFT JOIN
                customers c ON qr.customer_id = c.customer_id
            LEFT JOIN 
                quotation_items qi ON no.quote_number = qi.quote_number
            LEFT JOIN
                credit_notes cn ON CAST(cn.order_id AS CHAR) COLLATE utf8mb4_unicode_ci = CAST(no.order_id AS CHAR) COLLATE utf8mb4_unicode_ci AND cn.is_saved = 1`;

  const params = [];
  const where = [];

  if (!canViewAllOrders(userRole)) {
    where.push("no.created_by = ?");
    params.push(username);
  }

  if (serviceSupportOnly) {
    where.push(
      `no.created_by COLLATE utf8mb4_unicode_ci IN (
        SELECT username COLLATE utf8mb4_unicode_ci FROM rep_list
        WHERE userRole = 'SERVICE SUPPORT' AND status = 1
      )`,
    );
  }

  const approvalWhere = orderListApprovalWhereSql(userRole, {
    adminOrderPage: true,
  });
  if (approvalWhere) where.push(approvalWhere);

  const reportWhere = orderListReportWhereSql(userRole, {
    seesAllOrders: canViewAllOrders(userRole),
  });
  if (reportWhere) where.push(reportWhere);

  return { sql, params, where };
}

export async function fetchAdminOrderListPage(
  conn,
  {
    username,
    userRole,
    serviceSupportOnly = false,
    page = 1,
    limit = 40,
    search = "",
    dateFrom = "",
    dateTo = "",
    createdBy = "",
    leadCampaign = "",
    approvalStatus = "",
  } = {},
) {
  const offset = (Math.max(1, page) - 1) * limit;
  const fetchLimit = limit + 1;

  const { sql: baseSql, params, where } = buildAdminOrderListSql(
    userRole,
    username,
    serviceSupportOnly,
  );

  if (dateFrom) {
    where.push("no.created_at >= ?");
    params.push(`${dateFrom} 00:00:00`);
  }
  if (dateTo) {
    where.push("no.created_at <= ?");
    params.push(`${dateTo} 23:59:59`);
  }
  if (createdBy) {
    where.push("no.created_by = ?");
    params.push(createdBy);
  }
  if (approvalStatus) {
    where.push("LOWER(TRIM(COALESCE(no.approval_status, ''))) = ?");
    params.push(approvalStatus.toLowerCase());
  }
  if (leadCampaign === "__none__") {
    where.push("(c.lead_campaign IS NULL OR TRIM(c.lead_campaign) = '')");
  } else if (leadCampaign) {
    where.push("TRIM(c.lead_campaign) = ?");
    params.push(leadCampaign);
  }
  if (search) {
    const term = `%${search}%`;
    where.push(
      `(no.order_id LIKE ? OR no.client_name LIKE ? OR qr.company_name LIKE ? OR no.contact LIKE ? OR qr.state LIKE ? OR c.lead_campaign LIKE ?)`,
    );
    params.push(term, term, term, term, term, term);
  }

  let sql = baseSql;
  if (where.length) {
    sql += " WHERE " + where.join(" AND ");
  }

  sql += " GROUP BY no.order_id ORDER BY no.created_at DESC LIMIT ? OFFSET ?";
  params.push(fetchLimit, offset);

  const [rows] = await conn.execute(sql, params);
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  let enrichedOrders = pageRows.map((order) => ({
    ...order,
    line_items: parseLineItemsFromRaw(order.line_items_raw),
  }));

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
