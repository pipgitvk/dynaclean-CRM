import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import ScheduleVisitForm from "./ScheduleVisitForm";

export const dynamic = "force-dynamic";

export default async function ScheduleVisitPage({ params }) {
  const { customerId } = await params;
  const payload = await getSessionPayload();
  const username = payload?.username || "Unknown";

  const conn = await getDbConnection();
  const [rows] = await conn.execute(
    `SELECT customer_id, first_name, last_name, phone, address, company
     FROM customers WHERE customer_id = ?`,
    [customerId]
  );

  if (!rows[0]) {
    return <div className="text-red-600 text-center mt-20">Customer not found.</div>;
  }

  const customer = rows[0];
  const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim();

  return (
    <div className="max-w-3xl mx-auto mt-4 p-6 bg-white shadow-lg rounded-xl">
      <h1 className="text-2xl font-bold text-center mb-6 text-gray-700">Schedule Visit</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-gray-700">
        <p><strong>Name:</strong> {customerName}</p>
        <p><strong>Phone:</strong> {customer.phone}</p>
        <p><strong>Company:</strong> {customer.company}</p>
        <p><strong>Created By:</strong> {username}</p>
      </div>

      <ScheduleVisitForm
        customerId={customerId}
        customerName={customerName}
        contact={customer.phone}
        address={customer.address}
        dashboardPrefix="user-dashboard"
      />
    </div>
  );
}
