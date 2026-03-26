// app/page.jsx
import EmpTable from "./EmpTable";
import { getDbConnection } from "@/lib/db";
import { getMainSessionPayload } from "@/lib/auth";

async function getEmployees() {
  const connection = await getDbConnection();
  try {
    const [rows] = await connection.execute(
      "SELECT username, email, gender, password, number, empId, userRole, reporting_manager, status FROM rep_list"
    );
    return rows;
  } catch (e) {
    if (e.message?.includes("reporting_manager")) {
      const [rows] = await connection.execute(
        "SELECT username, email, gender, password, number, empId, userRole, status FROM rep_list"
      );
      return rows.map((r) => ({ ...r, reporting_manager: null }));
    }
    throw e;
  }
}

export default async function Home() {
  const employees = await getEmployees();
  const payload = await getMainSessionPayload();
  const role = payload?.role || "";
  const showEmployeeStatusToggle = role === "SUPERADMIN";

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Employee Registry</h1>
      <EmpTable employees={employees} showEmployeeStatusToggle={showEmployeeStatusToggle} />
    </main>
  );
}
