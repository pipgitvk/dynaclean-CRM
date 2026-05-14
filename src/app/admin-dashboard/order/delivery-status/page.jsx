import { getDbConnection } from "@/lib/db";
import DeliveryStatusTable from "./DeliveryStatusTable";
import { getSessionPayload } from "@/lib/auth";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function DeliveryStatusPage() {
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

  // 1. Fetch the user role
  const [roleRows] = await conn.execute(
    "SELECT userRole FROM emplist WHERE username = ?",
    [username]
  );
  const userRole = roleRows[0]?.userRole || "";

  // 2. Fetch delivered orders with delivery tracking information
  let sql = `SELECT 
                no.order_id, no.client_name, no.contact, 
                no.created_at, no.created_by, no.booking_by,
                no.delivery_date, no.delivered_on, no.delivery_status, no.delivery_proof,
                qr.company_name, qr.state
            FROM 
                neworder no
            LEFT JOIN 
                quotations_records qr ON no.quote_number = qr.quote_number
            WHERE 
                no.booking_id IS NOT NULL`;

  const params = [];

  // Filter based on user role
  if (!["SUPERADMIN"].includes(userRole)) {
    sql += " AND no.created_by = ?";
    params.push(username);
  }

  sql += " ORDER BY no.delivered_on DESC";

  const [orders] = await conn.execute(sql, params);

  console.log("fetched delivery status orders:", orders);

  return (
    <div className="mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin-dashboard/order"
          className="p-2 hover:bg-gray-100 rounded-full transition"
        >
          <ArrowLeft size={24} />
        </Link>
        <h3 className="text-2xl font-bold">Delivery Status Tracker</h3>
      </div>

      <DeliveryStatusTable orders={orders} />
    </div>
  );
}
