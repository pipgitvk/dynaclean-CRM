import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import Link from "next/link";
import dayjs from "dayjs";
import ClientExpenseDeleteButton from "../ClientExpenseDeleteButton";

export const dynamic = "force-dynamic";

async function getClientExpenseById(id) {
  const conn = await getDbConnection();
  try {
    await conn.execute("SELECT transaction_id FROM client_expenses LIMIT 1");
  } catch (_) {
    try {
      await conn.execute("ALTER TABLE client_expenses ADD COLUMN transaction_id VARCHAR(255) NULL AFTER hsn");
    } catch (__) {}
  }
  const [rows] = await conn.execute(
    "SELECT * FROM client_expenses WHERE id = ?",
    [id]
  );
  const expense = rows[0];
  if (!expense) return null;

  const [subHeadsRows] = await conn.execute(
    "SELECT id, sub_head FROM client_expense_sub_heads WHERE client_expense_id = ? ORDER BY id",
    [id]
  );
  const sub_heads = subHeadsRows.map((r) => r.sub_head || "");
  return { ...expense, sub_heads };
}

export default async function ClientExpenseDetailPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const fromStatements = sp?.from === "statements";

  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return <p className="text-red-600 p-4">Unauthorized</p>;
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
  } catch (err) {
    return <p className="text-red-600 p-4">Invalid Token</p>;
  }

  const expense = await getClientExpenseById(id);

  if (!expense) {
    return (
      <div className="p-6 text-center text-red-600">Client expense not found</div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8">
        Client Expense Details
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm sm:text-base">
        <div className="space-y-2 bg-gray-50 p-4 rounded shadow-sm">
          <p><span className="font-medium">ID:</span> {expense.id}</p>
          <p><span className="font-medium">Expense Name:</span> {expense.expense_name}</p>
          <p><span className="font-medium">Client Name:</span> {expense.client_name}</p>
          <p><span className="font-medium">Group Name:</span> {expense.group_name || "-"}</p>
          <p><span className="font-medium">Tax applicable:</span> {expense.tax_applicable ? "Yes" : "No"}</p>
          {expense.tax_applicable && (
            <>
              {expense.gst_rate != null && (
                <p><span className="font-medium">Tax Rate:</span> {Number(expense.gst_rate)}%</p>
              )}
              {expense.tax_type && (
                <p><span className="font-medium">Tax type:</span> {expense.tax_type}</p>
              )}
              {expense.tax_type === "CGST+SGST" && (
                <>
                  <p><span className="font-medium">CGST:</span> {expense.cgst != null ? `₹${Number(expense.cgst).toFixed(2)}` : "-"}</p>
                  <p><span className="font-medium">SGST:</span> {expense.sgst != null ? `₹${Number(expense.sgst).toFixed(2)}` : "-"}</p>
                </>
              )}
              {expense.tax_type === "IGST" && (
                <p><span className="font-medium">IGST:</span> {expense.igst != null ? `₹${Number(expense.igst).toFixed(2)}` : "-"}</p>
              )}
            </>
          )}
          <p><span className="font-medium">Main Head:</span> <span className={expense.main_head === "Direct" ? "text-blue-600" : "text-amber-600"}>{expense.main_head}</span></p>
          <p><span className="font-medium">Head:</span> {expense.head || "-"}</p>
          <p><span className="font-medium">Supply:</span> {expense.supply || "-"}</p>
          {expense.sub_heads && expense.sub_heads.length > 0 && (
            <p><span className="font-medium">Sub-head:</span> {expense.sub_heads[0]}</p>
          )}
        </div>
        <div className="space-y-2 bg-gray-50 p-4 rounded shadow-sm">
          <p><span className="font-medium">Type of Ledger:</span> {expense.type_of_ledger || "-"}</p>
          <p><span className="font-medium">HSN:</span> {expense.hsn || "-"}</p>
          <p><span className="font-medium">Transaction ID:</span> {expense.transaction_id || "-"}</p>
          <p><span className="font-medium">Amount:</span> {expense.amount != null ? `₹${Number(expense.amount).toFixed(2)}` : "-"}</p>
          <p><span className="font-medium">Created:</span> {expense.created_at ? dayjs(expense.created_at).format("DD MMM YYYY HH:mm") : "-"}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between mt-10">
        <Link
          href={fromStatements ? "/admin-dashboard/statements" : "/admin-dashboard/client-expenses/cards"}
          className="inline-block px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-center"
        >
          Back
        </Link>
        <div className="flex gap-3">
          <Link
            href={`/admin-dashboard/client-expenses/edit/${id}`}
            className="inline-block px-6 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-center"
          >
            Edit
          </Link>
          <ClientExpenseDeleteButton
            id={id}
            backHref={fromStatements ? "/admin-dashboard/statements" : "/admin-dashboard/client-expenses/cards"}
          />
        </div>
      </div>
    </div>
  );
}
