import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import ExpenseTable from "./ExpenseTable";
import { getSessionPayload } from "@/lib/auth";

const JWT_SECRET = process.env.JWT_SECRET;

export const dynamic = "force-dynamic";

// Server Component
export default async function ExpensesPage() {
  let username = "";
  let role = "";

  const payload = await getSessionPayload();
  if (!payload) {
    // You can handle unauthorized access here, e.g., redirect or return an error
    return null;
  }

  username = payload.username;
  role = payload.role;

  const conn = await getDbConnection();

  // Direct query for all expenses (passing `username` as a parameter)
  const query = `SELECT ID, TravelDate, FromLocation, Tolocation,
            TicketCost, HotelCost, MealsCost, OtherExpenses,
            approved_amount, payment_date, approval_status
        FROM expenses
        WHERE username = ?
        ORDER BY TravelDate DESC;`;

  // Pass `username` as the second argument to `execute`
  const [rows] = await conn.execute(query, [username]);
  // await conn.end();

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-700">Expense Entries</h1>

        {/* Button container with flex properties */}
        <div className="flex gap-4">
          {/* Add Expense button */}
          <a
            href="expenses/add"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow"
          >
            Add Expense
          </a>
        </div>
      </div>

      <ExpenseTable rows={rows} role={role} />
    </div>
  );
}
