import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import EmployeeCardsClient from "./EmployeeCardsClient";

const JWT_SECRET = process.env.JWT_SECRET;

export const dynamic = "force-dynamic";

export default async function EmployeeCardsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return <p className="text-red-600 p-4">Unauthorized</p>;
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
  } catch {
    return <p className="text-red-600 p-4">Invalid Token</p>;
  }

  let employees = [];
  let error = null;
  try {
    const conn = await getDbConnection();
    // Fetch only employees who are active in rep_list AND have expenses
    const [result] = await conn.execute(
      `SELECT DISTINCT r.username 
       FROM rep_list r
       INNER JOIN expenses e ON r.username = e.username
       WHERE r.status = 1 
       ORDER BY r.username ASC`
    );
    // Map to the expected structure
    employees = result.map(emp => ({
      username: emp.username,
      name: emp.username,
      userRole: "Employee",
      email: ""
    }));
  } catch (err) {
    console.error("[employee-cards] DB error:", err?.message);
    error = err.message;
  }

  if (error) {
    return <p className="text-red-600 p-4">Error: {error}</p>;
  }

  return <EmployeeCardsClient employees={employees} />;
}
