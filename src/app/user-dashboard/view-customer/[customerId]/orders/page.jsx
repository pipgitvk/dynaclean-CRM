import { getDbConnection } from "@/lib/db";
import OrderTable from "@/app/user-dashboard/order/OrderTable";
import { getSessionPayload } from "@/lib/auth";
import Link from "next/link";

export default async function CustomerOrdersPage({ params }) {
  const { customerId } = await params;
  const payload = await getSessionPayload();
  if (!payload) {
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

  // Fetch customer details
  const [custs] = await conn.execute(
    `SELECT customer_id, first_name, last_name, company, phone, email 
     FROM customers WHERE customer_id = ?`,
    [customerId],
  );
  const customer = custs[0] || {};

  // Fetch user role
  const [roleRows] = await conn.execute(
    "SELECT userRole FROM emplist WHERE username = ?",
    [username]
  );
  const userRole = roleRows[0]?.userRole || "";

  // Fetch orders for this specific customer (filtered by user role if not superadmin/director)
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
                credit_notes cn ON CAST(cn.order_id AS CHAR) COLLATE utf8mb4_unicode_ci = CAST(no.order_id AS CHAR) COLLATE utf8mb4_unicode_ci AND cn.is_saved = 1
            WHERE no.customer_id = ?`;

  const ordersParams = [customerId];
  const isPrivilegedRole = ["SUPERADMIN", "DIRECTOR"].includes(String(userRole).toUpperCase());
  if (!isPrivilegedRole) {
    sql += " AND no.created_by = ?";
    ordersParams.push(username);
  }

  sql += " GROUP BY no.order_id ORDER BY no.created_at DESC";

  const [orders] = await conn.execute(sql, ordersParams);

  const customerName = `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Customer";

  return (
    <div className="mx-auto p-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
        <div>
          <Link
            href={`/user-dashboard/view-customer/${customerId}`}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-2 inline-block"
          >
            ← Back to Customer Details
          </Link>
          <h3 className="text-xl font-bold text-gray-800">
            Orders for {customerName}
            {customer.company && (
              <span className="text-gray-600 font-normal text-base ml-2">
                ({customer.company})
              </span>
            )}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Customer ID: {customer.customer_id} | Total Orders: {orders.length}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/user-dashboard/order/new?customerId=${customerId}`}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition text-sm"
          >
            + New Order
          </Link>
        </div>
      </div>

      <OrderTable orders={orders} userRole={userRole} />
    </div>
  );
}
