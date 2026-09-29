import { getDbConnection } from "@/lib/db";
import OrderTable from "./OrderTable";
import { getSessionPayload } from "@/lib/auth";

// Secret for verifying JWT
const JWT_SECRET = process.env.JWT_SECRET;

export default async function OrdersPage() {
  const payload = await getSessionPayload();
  if (!payload) {
    // You can handle unauthorized access here, e.g., redirect or return an error
    return null;
  }

  const username = payload.username;
  if (!username) {
    return (
      <div className="text-center mt-20 text-red-600 font-semibold">
        Unauthorized access
      </div>
    );
  }

  const conn = await getDbConnection();

  // Ensure approval_remark and approval_date columns exist
  try {
    await conn.execute(
      "ALTER TABLE neworder ADD COLUMN approval_remark TEXT NULL DEFAULT NULL"
    );
  } catch (_) {}
  try {
    await conn.execute(
      "ALTER TABLE neworder ADD COLUMN approval_date DATETIME NULL DEFAULT NULL"
    );
  } catch (_) {}
  // Ensure return booking columns exist
  try {
    await conn.execute("ALTER TABLE neworder ADD COLUMN return_booking_done TINYINT(1) DEFAULT 0");
  } catch (_) {}
  try {
    await conn.execute("ALTER TABLE neworder ADD COLUMN return_booking_ref VARCHAR(255) NULL");
  } catch (_) {}
  try {
    await conn.execute("ALTER TABLE neworder ADD COLUMN return_booking_date DATE NULL");
  } catch (_) {}
  try {
    await conn.execute("ALTER TABLE neworder ADD COLUMN expected_pickup_date DATE NULL");
  } catch (_) {}
  try {
    await conn.execute("ALTER TABLE neworder ADD COLUMN return_booking_url VARCHAR(500) NULL");
  } catch (_) {}
  try {
    await conn.execute("ALTER TABLE neworder ADD COLUMN return_booking_remarks TEXT NULL");
  } catch (_) {}
  try {
    await conn.execute("ALTER TABLE neworder ADD COLUMN return_booking_by VARCHAR(255) NULL");
  } catch (_) {}
  // Ensure warehouse-in columns exist
  try {
    await conn.execute("ALTER TABLE neworder ADD COLUMN warehouse_in_done TINYINT(1) DEFAULT 0");
  } catch (_) {}
  try {
    await conn.execute("ALTER TABLE neworder ADD COLUMN warehouse_in_date DATE NULL");
  } catch (_) {}
  try {
    await conn.execute("ALTER TABLE neworder ADD COLUMN warehouse_in_image VARCHAR(500) NULL");
  } catch (_) {}
  try {
    await conn.execute("ALTER TABLE neworder ADD COLUMN warehouse_in_by VARCHAR(100) NULL");
  } catch (_) {}
  try {
    await conn.execute(
      "ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS is_saved TINYINT(1) NOT NULL DEFAULT 0"
    );
  } catch (_) {}
  try {
    await conn.execute(
      "ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS saved_at DATETIME NULL DEFAULT NULL"
    );
  } catch (_) {}

  // 1. Fetch the user role
  const [roleRows] = await conn.execute(
    "SELECT userRole FROM emplist WHERE username = ?",
    [username]
  );
  const userRole = roleRows[0]?.userRole || "";

  // 2. Fetch orders based on role
  let sql = `SELECT 
                no.order_id, no.report_file, no.po_file, no.payment_proof, no.booking_url,
                no.client_name, no.contact, no.is_cancelled, no.dispatch_status,
                no.created_at, no.created_by , no.einvoice_file, no.booking_id, no.quote_number, no.duedate,
                no.invoice_date , no.account_by ,no.booking_by , no.dispatch_person,
                no.payment_id, no.payment_date, no.payment_amount, no.payment_status,no.totalamt,
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
                MAX(cn.id) as credit_note_id,
                MAX(cn.credit_note_number) as credit_note_number,
                GROUP_CONCAT(DISTINCT qi.item_name SEPARATOR ', ') as item_name,
                GROUP_CONCAT(DISTINCT qi.item_code SEPARATOR ', ') as item_code,
                COALESCE(SUM(COALESCE(qi.total_taxable_amt, qi.taxable_price, 0)), 0) AS order_taxable_total
            FROM 
                neworder no
            LEFT JOIN 
                quotations_records qr ON no.quote_number = qr.quote_number
            LEFT JOIN 
                quotation_items qi ON no.quote_number = qi.quote_number
            LEFT JOIN
                credit_notes cn ON CAST(cn.order_id AS CHAR) COLLATE utf8mb4_unicode_ci = CAST(no.order_id AS CHAR) COLLATE utf8mb4_unicode_ci AND cn.is_saved = 1`;

  const params = [];

  if (!["SUPERADMIN", "DIRECTOR"].includes(String(userRole).toUpperCase())) {
    sql += " WHERE no.created_by = ?";
    params.push(username);
  }

  sql += " GROUP BY no.order_id ORDER BY no.created_at DESC";

  const [orders] = await conn.execute(sql, params);

  const enrichedOrders = orders;

  // await conn.end();

  return (
    <div className="mx-auto p-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4">
        <h3 className="text-xl font-bold">Your Orders</h3>

        <div className="flex flex-wrap gap-2">
          <a
            href="/admin-dashboard/order/delivery-status"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            📦 Delivery Status
          </a>

          <a
            href="/admin-dashboard/order/estimate-delivery"
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
          >
            ⏱ Estimate Delivery
          </a>

          <a
            href="/admin-dashboard/order/new"
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
          >
            + New Order
          </a>
        </div>
      </div>


      <OrderTable orders={enrichedOrders} userRole={userRole} />
    </div>
  );
}
