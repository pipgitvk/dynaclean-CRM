// app/page.jsx
import EmpTable from "./EmpTable";
import { getDbConnection } from "@/lib/db";

async function getEmployees() {
  const connection = await getDbConnection();
  const [rows] = await connection.execute(
    "SELECT username, email, gender, password, number, empId, userRole , status FROM rep_list"
  );
  // connection.end(); // Close the connection after fetching
  return rows;
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
