import { getDbConnection } from "@/lib/db";
import CustomerTable from "./CustomerTable";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getSessionPayload } from "@/lib/auth";

export const dynamic = "force-dynamic";
const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

export default async function CustomersPage({ searchParams }) {
  const payload = await getSessionPayload();
  if (!payload) {
    // You can handle unauthorized access here, e.g., redirect or return an error
    return null;
  }
  let username = payload.username;

  const conn = await getDbConnection();

  const [rows] = await conn.execute(
    "SELECT * FROM demoregistration WHERE username = ?",
    [username]
  );

  // await conn.end();

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
        Customer Records
      </h1>
      <CustomerTable rows={rows} searchParams={searchParams} />
    </div>
  );
}
