// app/sales-dashboard/page.jsx
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { redirect } from "next/navigation";
import { getDbConnection } from "@/lib/db";
import SalesDashboard from "@/components/Dashboards/SalesDashboard";
import { getReportingManagerForEmployee } from "@/lib/reportingManager";
import { isSalesRole } from "@/lib/isSalesRole";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

export default async function SalesDashboardPage() {
  const cookieStore = await cookies();
  const token =
    cookieStore.get("impersonation_token")?.value ||
    cookieStore.get("token")?.value;

  if (!token) {
    return <p className="text-red-600">Unauthorized</p>;
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );

    const username = payload.username;
    const role = payload.role;

    if (!isSalesRole(role)) {
      redirect("/user-dashboard");
    }

    const connection = await getDbConnection();

    const [rows] = await connection.execute(
      `
      SELECT username, email, empId, userRole FROM emplist WHERE username = ?
      UNION
      SELECT username, email, empId, userRole FROM rep_list WHERE username = ?
      `,
      [username, username]
    );

    const user = rows[0];
    const reportingManager = await getReportingManagerForEmployee(username);

    if (!user) {
      return <p className="text-red-600">User not found</p>;
    }

    return <SalesDashboard user={user} reportingManager={reportingManager} />;
  } catch (error) {
    console.error("Sales dashboard error:", error.message);
    return <p className="text-red-600">Failed to load dashboard</p>;
  }
}
