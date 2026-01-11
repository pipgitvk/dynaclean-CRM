import { getDbConnection } from "@/lib/db";
import DemoForm from "./DemoForm";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export const dynamic = "force-dynamic";

export default async function DemoRegistrationPage({ params }) {
  const { customerId } = params;

  // ✅ Connect to DB
  const conn = await getDbConnection();

  // ✅ Fetch customer details
  const [rows] = await conn.execute(
    `SELECT first_name, email, phone, company FROM customers WHERE customer_id = ?`,
    [customerId]
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
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      username = decoded.username || "Unknown";
    } catch (error) {
      console.error("JWT decode failed", error);
    }
  }

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
