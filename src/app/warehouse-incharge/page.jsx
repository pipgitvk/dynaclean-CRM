import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { redirect } from "next/navigation";
import { getDbConnection } from "@/lib/db";
import WarehouseInchargeDashboard from "@/components/Dashboards/WarehouseInchargeDashboard";
import { getReportingManagerForEmployee } from "@/lib/reportingManager";
import { countWarehouseDispatchPending } from "@/lib/warehouseDispatchPendingCount";
import { normalizeRoleKey } from "@/lib/roleKeyUtils";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

export default async function WarehouseInchargeHomePage() {
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
      new TextEncoder().encode(JWT_SECRET),
    );

    const username = payload.username;
    const role = payload.role;
    const roleKey = normalizeRoleKey(role);

    if (roleKey !== "WAREHOUSE INCHARGE") {
      redirect("/user-dashboard");
    }

    const connection = await getDbConnection();

    const [rows] = await connection.execute(
      `
      SELECT username, email, empId, userRole FROM emplist WHERE username = ?
      UNION
      SELECT username, email, empId, userRole FROM rep_list WHERE username = ?
      `,
      [username, username],
    );

    const user = rows[0];
    const reportingManager = await getReportingManagerForEmployee(username);
    const dispatchPendingsCount = await countWarehouseDispatchPending(connection);

    const [warehouseInSpare] = await connection.execute(
      `SELECT COUNT(*) as cnt FROM spare_stock_request WHERE status != 'fulfilled'`,
    );
    const [warehouseInProducts] = await connection.execute(
      `SELECT COUNT(*) as cnt FROM product_stock_request WHERE status != 'fulfilled'`,
    );

    if (!user) {
      return <p className="text-red-600">User not found</p>;
    }

    const counts = {
      dispatch: dispatchPendingsCount,
      spare: warehouseInSpare[0]?.cnt ?? 0,
      products: warehouseInProducts[0]?.cnt ?? 0,
    };

    return (
      <WarehouseInchargeDashboard
        user={user}
        reportingManager={reportingManager}
        counts={counts}
      />
    );
  } catch (error) {
    console.error("Warehouse incharge dashboard error:", error.message);
    return <p className="text-red-600">Failed to load dashboard</p>;
  }
}
