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
    try {
      await conn.execute("SELECT txn_posted_date FROM statements LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE statements ADD COLUMN txn_posted_date DATE NULL AFTER txn_dated_deb");
      } catch (__) {}
    }
    const [result] = await conn.execute(
      `SELECT id, trans_id, date, txn_dated_deb, txn_posted_date, cheq_no, description, type, amount, client_expense_id, created_at
       FROM statements
       ORDER BY date DESC, id DESC`
    );
    rows = result;
  } catch (err) {
    console.error("[statements] DB error:", err?.message);
  }

  const unsettledCount = rows.filter((r) => !r.client_expense_id).length;
  const settledCount = rows.filter((r) => r.client_expense_id).length;

  return (
    <div className="max-w-[1600px] mx-auto p-6 w-full">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-700">Statements</h1>
          <span className="text-gray-600 font-normal text-base">
            Unsettled: {unsettledCount}, Settled: {settledCount}
          </span>
        </div>
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
