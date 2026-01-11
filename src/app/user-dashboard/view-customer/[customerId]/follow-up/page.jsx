import { getDbConnection } from "@/lib/db";
import FollowupForm from "./FollowupForm";
import dayjs from "dayjs";
export const dynamic = "force-dynamic";

export default async function FollowUpPage({ params }) {
  const customerId = params.customerId;

  const conn = await getDbConnection();

  // const [rows] = await conn.execute(
  //   `SELECT name, contact, email, followed_date, notes
  //    FROM customers_followup
  //    WHERE customer_id = ?
  //    ORDER BY followed_date DESC LIMIT 1`,
  //   [customerId]
  // );
const [rows] = await conn.execute(
  `SELECT 
     cf.name AS followup_name, 
     cf.contact AS followup_contact, 
     cf.email AS followup_email, 
     cf.followed_date, 
     cf.notes,
     c.status
   FROM customers_followup cf
   JOIN customers c ON c.customer_id = cf.customer_id
   WHERE cf.customer_id = ?
   ORDER BY cf.followed_date DESC 
   LIMIT 1`,
  [customerId]
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
          <strong>Name:</strong> {customer.followup_name}
        </p>
        <p>
          <strong>Contact:</strong> {customer.followup_contact}
        </p>
        <p>
          <strong>Email:</strong> {customer.followup_email}
        </p>
        <p>
          <strong>Status:</strong> {customer.status || "N/A"}
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
