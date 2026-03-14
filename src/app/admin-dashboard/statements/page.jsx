import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import StatementTable from "./StatementTable";

const JWT_SECRET = process.env.JWT_SECRET;

export const dynamic = "force-dynamic";

export default async function StatementsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return <p className="text-red-600 p-4">Unauthorized</p>;
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
  } catch (err) {
    return <p className="text-red-600 p-4">Invalid Token</p>;
  }

  let rows = [];
  try {
    const conn = await getDbConnection();
    const [result] = await conn.execute(
      `SELECT id, trans_id, date, txn_dated_deb, cheq_no, description, type, amount, client_expense_id, created_at
       FROM statements
       ORDER BY date DESC, id DESC`
    );
    rows = result;
  } catch (err) {
    console.error("[statements] DB error:", err?.message);
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-700">Statements</h1>
        <a
          href="/admin-dashboard/statements/add"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow"
        >
          Add New Statement
        </a>
      </div>

      <StatementTable rows={rows} />
    </div>
  );
}
