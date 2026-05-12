// app/user-dashboard/page.jsx
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getDbConnection } from "@/lib/db";
import { DASHBOARD_MAP } from "@/components/Dashboards";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

export default async function UserDashboardPage() {
  const cookieStore = await cookies();
  // ✅ Prioritize impersonation_token over the regular token
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

    // The SQL query correctly finds the user based on the username from the token
    const [rows] = await connection.execute(
      `
      SELECT username, email, empId, userRole FROM emplist WHERE username = ?
      UNION
      SELECT username, email, empId, userRole FROM rep_list WHERE username = ?
      `,
      [username, username]
    );

    const user = rows[0];

    // Dispatch Pendings
    const [dispatchPendings] = await connection.execute(
      `
      SELECT COUNT(*) as dispatchPendings FROM dispatch WHERE serial_no IS NULL and stock_deducted = 0
      `
    );

    const dispatchPendingsCount = dispatchPendings[0].dispatchPendings;

    // warehouse in pendings spare
    const [Warehouseinspare] = await connection.execute(
      `
      SELECT COUNT(*) as Warehouseinspare FROM spare_stock_request WHERE status != 'fulfilled'
      `
    );

    const WarehouseinspareCount = Warehouseinspare[0].Warehouseinspare;

    // warehouse in pendings spare
    const [Warehouseinproducts] = await connection.execute(
      `
      SELECT COUNT(*) as Warehouseinproducts FROM product_stock_request WHERE status != 'fulfilled'
      `
    );

    const WarehouseinproductsCount = Warehouseinproducts[0].Warehouseinproducts;

    // Fetch Service Head counts
    const [serviceCounts] = await connection.execute(
      `
  SELECT
    SUM(status = 'COMPLETED') AS completed_count,
    SUM(status = 'PENDING FOR SPARES') AS pending_spares_count,
    SUM(status = 'PENDING') AS pending_count
  FROM service_records
  `,
      []
    );

    const completedCount = serviceCounts[0].completed_count;
    const pendingSparesCount = serviceCounts[0].pending_spares_count;
    const pendingCount = serviceCounts[0].pending_count;

    if (!user) {
      return <p className="text-red-600">User not found</p>;
    }

    const DashboardComponent = DASHBOARD_MAP[role] || DASHBOARD_MAP["DEFAULT"];

    const counts = {
      dispatch: dispatchPendingsCount,
      spare: WarehouseinspareCount,
      products: WarehouseinproductsCount,
      completed: completedCount,
      pending: pendingCount,
      pendingSpares: pendingSparesCount,
    };

    return <DashboardComponent user={user} counts={counts} />;
  } catch (error) {
    console.error("Dashboard error:", error.message);
    return <p className="text-red-600">Failed to load dashboard</p>;
  }
}
