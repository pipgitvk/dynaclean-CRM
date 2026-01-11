import { getDbConnection } from "@/lib/db";
import CustomerTable from "./CustomerTable";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

export const dynamic = "force-dynamic";
const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

export default async function CustomersPage({ searchParams }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return (
      <div className="p-6 text-red-600 font-semibold text-center">
        ❌ Unauthorized. Please login.
      </div>
    );
  }

  let username = null;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );
    username = payload.username;
  } catch (err) {
    return (
      <div className="p-6 text-red-600 font-semibold text-center">
        ❌ Invalid or expired token.
      </div>
    );
  }

  const conn = await getDbConnection();

  const [rows] = await conn.execute("SELECT * FROM demoregistration ", [
    username,
  ]);

  // await conn.end();

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
          Demo Records
        </h1>
        <a href="/admin-dashboard/demo_details/view-everyone" passHref>
          <button className="px-4 py-2 bg-blue-500 text-white rounded-md cursor-pointer hover:bg-blue-600 transition">
            All Demo
          </button>
        </a>
      </div>
      <CustomerTable rows={rows} searchParams={searchParams} />
    </div>
  );
}
