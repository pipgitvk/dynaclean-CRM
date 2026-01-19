import { getDbConnection } from "@/lib/db";
import FollowupForm from "./FollowupForm";
import dayjs from "dayjs";
export const dynamic = "force-dynamic";

export default async function FollowUpPage({ params }) {
  const { customerId } = await params;
  // console.log("Customer ID:", params);

  const conn = await getDbConnection();

  const [rows] = await conn.execute(
    `SELECT name, contact, email, followed_date, notes
     FROM customers_followup
     WHERE customer_id = ?
     ORDER BY followed_date DESC LIMIT 1`,
    [customerId],
  );

  // await conn.end();

  if (!rows.length) {
    return (
      <div className="max-w-2xl mx-auto mt-20 text-center text-red-600 font-semibold">
        Customer data not found.
      </div>
    );
  }

  const customer = rows[0];

  return (
    <div className="max-w-2xl mx-auto mt-10 bg-white shadow-lg rounded-xl p-6">
      <h1 className="text-2xl font-bold mb-6 text-center text-gray-700">
        Follow-up Entry
      </h1>

      <div className="mb-6 space-y-1 text-gray-700">
        <p>
          <strong>Name:</strong> {customer.name}
        </p>
        <p>
          <strong>Contact:</strong> {customer.contact}
        </p>
        <p>
          <strong>Email:</strong> {customer.email}
        </p>
        <p>
          <strong>Last Called:</strong>{" "}
          {dayjs(customer.followed_date).format("DD MMM YYYY, hh:mm A")}
        </p>
        <p>
          <strong>Last Notes:</strong> {customer.notes}
        </p>
      </div>

      <FollowupForm customerId={customerId} />
    </div>
  );
}
