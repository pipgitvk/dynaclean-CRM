import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import ClientExpensesTable from "./ClientExpensesTable";

const JWT_SECRET = process.env.JWT_SECRET;

export const dynamic = "force-dynamic";

export default async function ClientExpensesPage() {
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
      `SELECT id, expense_name, client_name, group_name, main_head, head, supply, type_of_ledger, cgst, sgst, igst, hsn, gst_rate, amount, created_at
       FROM client_expenses
       ORDER BY id DESC`
    );
    rows = result;
  } catch (err) {
    console.error("[client-expenses] DB error:", err?.message);
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-700">Client Expenses</h1>
        <div className="flex gap-2">
          <a
            href="/admin-dashboard/client-expenses/add"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow"
          >
            Add Client Expense
          </a>
          <a
            href="/admin-dashboard/client-expenses/category"
            className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded shadow"
          >
            Category
          </a>
          <a
            href="/admin-dashboard/client-expenses/sub-category"
            className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded shadow"
          >
            Sub-category
          </a>
        </div>
      </div>

      <ClientExpensesTable rows={rows} />
    </div>
  );
}
