// app/director-dashboard/page.jsx
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getDbConnection } from "@/lib/db";
import DirectorDashboard from "@/components/Dashboards/DirectorDashboard";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

export default async function DirectorDashboardPage() {
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

    if (!user) {
      return <p className="text-red-600">User not found</p>;
    }

    let regTotal = 0;
    let regPending = 0;
    try {
      const [regTotalRows] = await connection.execute(
        `SELECT COUNT(*) AS c FROM attendance_regularization_requests`,
      );
      const [regPendingRows] = await connection.execute(
        `SELECT COUNT(*) AS c FROM attendance_regularization_requests WHERE status = 'pending'`,
      );
      regTotal = Number(regTotalRows[0]?.c ?? 0);
      regPending = Number(regPendingRows[0]?.c ?? 0);
    } catch (e) {
      console.warn("attendance regularization counts:", e.message);
    }

    return <DirectorDashboard user={user} regTotal={regTotal} regPending={regPending} />;
  } catch (error) {
    console.error("Dashboard error:", error.message);
    return <p className="text-red-600">Failed to load dashboard</p>;
  }
}
