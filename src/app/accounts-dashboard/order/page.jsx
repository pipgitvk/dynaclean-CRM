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

  // Ensure return / warehouse-in columns exist
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

  // 1. Fetch the user role
  const [roleRows] = await conn.execute(
    "SELECT userRole FROM rep_list WHERE username = ?",
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
      userRole
    )
  ) {
    sql += " WHERE no.created_by = ?";
    params.push(username);
  }

  sql += " GROUP BY no.order_id ORDER BY no.created_at DESC";

  const [orders] = await conn.execute(sql, params);

  // await conn.end();

  console.log("fetched orders:", orders);

  return (
    <div className=" mx-auto p-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4">
        <h3 className="text-xl font-bold">Your Orders</h3>

        <div className="flex flex-wrap gap-2">
          <a
            href="/user-dashboard/order/delivery-status"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            📦 Delivery Status
          </a>

          <a
            href="/user-dashboard/estimate-delivery"
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
          >
            ⏱ Estimate Delivery
          </a>

          <a
            href="/user-dashboard/order/new"
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
          >
            + New Order
          </a>
        </div>
      </div>


      <OrderTable orders={orders} userRole={userRole} />
    </div>
  );
}
