import { getDbConnection } from "@/lib/db";
import DemoForm from "./DemoForm";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { getSessionPayload } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DemoRegistrationPage({ params }) {
  const { customerId } = await params;

  // ✅ Connect to DB
  const conn = await getDbConnection();

  // ✅ Fetch customer details
  const [rows] = await conn.execute(
    `SELECT first_name, email, phone, company FROM customers WHERE customer_id = ?`,
    [customerId],
  );

  // await conn.end();

  if (!rows[0]) {
    return (
      <div className="text-red-600 text-center mt-20">Customer not found.</div>
    );
  }

  const customer = rows[0];

  // ✅ Get username from JWT token in cookies
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  let username = "Unknown";
  const payload = await getSessionPayload();
  if (!payload) {
    // You can handle unauthorized access here, e.g., redirect or return an error
    return null;
  }
  username = payload.username;

  // ✅ Render
  return (
    <div className="max-w-6xl mx-auto mt-1 p-6 bg-white shadow-lg rounded-xl">
      <h1 className="text-2xl font-bold text-center mb-8 text-gray-700">
        Demo Registration
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 mb-2 text-gray-700 text-lg">
        <p>
          <strong>Name:</strong> {customer.first_name}
        </p>
        <p>
          <strong>Email:</strong> {customer.email}
        </p>
        <p>
          <strong>Phone:</strong> {customer.phone}
        </p>
        <p>
          <strong>Company:</strong> {customer.company}
        </p>
        <p>
          <strong>Sales Person Name:</strong> {username}
        </p>
      </div>

      <DemoForm
        customerId={customerId}
        customerName={customer.first_name}
        username={username}
      />
    </div>
  );
}
