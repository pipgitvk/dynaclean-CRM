// app/page.jsx
import EmpTable from "./EmpTable";
import { getDbConnection } from "@/lib/db";

async function getEmployees() {
  let connection;
  try {
    connection = await getDbConnection();
  } catch (e) {
    // DB not configured/running → show empty table instead of crashing page.
    return [];
  }
  try {
    const [rows] = await connection.execute(
      "SELECT username, email, gender, password, number, empId, userRole, reporting_manager, status FROM rep_list"
    );
    return rows;
  } catch (e) {
    // Dev/preview resilience: never crash the page due to DB/network/schema issues.
    const msg = String(e?.message || "");
    if (msg.includes("reporting_manager")) {
      try {
        const [rows] = await connection.execute(
          "SELECT username, email, gender, password, number, empId, userRole, status FROM rep_list"
        );
        return rows.map((r) => ({ ...r, reporting_manager: null }));
      } catch {
        return [];
      }
    }
    return [];
  }
}

export default async function Home() {
  const employees = await getEmployees();

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Employee Registry</h1>
      <EmpTable employees={employees} />
    </main>
  );
}
