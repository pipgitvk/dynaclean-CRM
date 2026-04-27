import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import ExpenseTable from "./ExpenseTable";
import { getSessionPayload } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return <p className="text-red-600 p-4">Unauthorized</p>;
  }

  const payload = await getSessionPayload();
  if (!payload) return null;

  const username = payload.username;
  const role = payload.role;

  let conn;
  try {
    conn = await getDbConnection();
  } catch (dbErr) {
    return <p className="text-red-600 p-4">Database connection error</p>;
  }

  let rows = [];
  try {
    const [results] = await conn.execute(
      `SELECT ID, TravelDate, FromLocation, Tolocation,
              TicketCost, HotelCost, MealsCost, OtherExpenses,
              approved_amount, payment_date, approval_status, username, linked_statement_ids
       FROM expenses 
       ORDER BY TravelDate DESC`
    );
    rows = results;
  } catch (queryErr) {
    console.error("Query failed:", queryErr);
    return <p className="text-red-600 p-4">Query error</p>;
  }

  return (
    <div className="max-w-8xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-700">Expense Entries</h1>
      </div>

      <ExpenseTable rows={rows} role={role} />
    </div>
  );
}
