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

  // Ensure approval_remark column exists
  try {
    await conn.execute(
      "ALTER TABLE neworder ADD COLUMN approval_remark TEXT NULL DEFAULT NULL"
    );
  } catch (_) {
    // Column may already exist
  }

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
                no.delivery_date, no.delivered_on, no.delivery_status,no.delivery_proof,
                no.installation_status, no.is_returned, no.approval_status, no.approval_remark,
                qr.company_name, qr.emp_name, qr.state,
                GROUP_CONCAT(DISTINCT qi.item_name SEPARATOR ', ') as item_name,
                GROUP_CONCAT(DISTINCT qi.item_code SEPARATOR ', ') as item_code
            FROM 
                neworder no
            LEFT JOIN 
                quotations_records qr ON no.quote_number = qr.quote_number
            LEFT JOIN 
                quotation_items qi ON no.quote_number = qi.quote_number`;

  const params = [];

  if (!["SUPERADMIN"].includes(userRole)) {
    sql += " WHERE no.created_by = ?";
    params.push(username);
  }

  sql += " GROUP BY no.order_id ORDER BY no.created_at DESC";

  const [orders] = await conn.execute(sql, params);

  // await conn.end();

  console.log("fetched orders:", orders);

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


      <OrderTable orders={orders} userRole={userRole} />
    </div>
  );
}
