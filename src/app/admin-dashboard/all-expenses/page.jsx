import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import ExpenseTable from "../expenses/ExpenseTable";

const JWT_SECRET = process.env.JWT_SECRET;

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  console.log("📌 ExpensesPage loaded");

  // 🔐 Read token from cookies
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  console.log("📥 Token from cookies:", token ? "[REDACTED]" : "❌ No token");

  if (!token) {
    console.error("❌ Unauthorized access - no token");
    return <p className="text-red-600 p-4">Unauthorized</p>;
  }

  let username = "";
  let role = "";

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );

    username = payload.username;
    role = payload.role;

    console.log("✅ Token verified");
    console.log("👤 Username:", username);
    console.log("🔐 Role:", role);
  } catch (err) {
    console.error("❌ Invalid token:", err);
    return <p className="text-red-600 p-4">Invalid Token</p>;
  }

  // ✅ DB connection
  let conn;
  try {
    console.log("🛠️ Connecting to DB...");
    conn = await getDbConnection();
    console.log("✅ DB connection successful");
    
    // Ensure linked_statement_ids column exists in expenses table
    try {
      await conn.execute("SELECT linked_statement_ids FROM expenses LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE expenses ADD COLUMN linked_statement_ids TEXT NULL");
      } catch (__) {}
    }
  } catch (dbErr) {
    console.error("❌ DB connection failed:", dbErr);
    return <p className="text-red-600 p-4">Database connection error</p>;
  }

  // ✅ Fetch expenses
  const query = `
    SELECT ID, TravelDate, FromLocation, Tolocation,
           TicketCost, HotelCost, MealsCost, OtherExpenses,
           approved_amount, payment_date, approval_status, username, linked_statement_ids
    FROM expenses
    ORDER BY TravelDate DESC
  `;

  // ✅ Fetch active employees
  const activeEmployeesQuery = `
    SELECT username FROM rep_list WHERE status = 1
  `;

  let rows = [];
  let activeEmployees = [];

  try {
    console.log("📦 Fetching expenses...");
    const [results] = await conn.execute(query);
    rows = results;
    console.log("✅ Expenses fetched:", rows.length);

    console.log("👥 Fetching active employees...");
    const [empResults] = await conn.execute(activeEmployeesQuery);
    activeEmployees = empResults.map(emp => emp.username);
    console.log("✅ Active employees fetched:", activeEmployees.length);
  } catch (queryErr) {
    console.error("❌ Query failed:", queryErr);
    return <p className="text-red-600 p-4">Query error</p>;
  } finally {
    // await conn.end();
    console.log("🔌 DB connection closed");
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-700">Expense Entries</h1>
      </div>

      <ExpenseTable rows={rows} role={role} activeEmployeesList={activeEmployees} />
    </div>
  );
}
