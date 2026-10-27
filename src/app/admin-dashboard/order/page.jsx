import OrderTable from "./OrderTable";
import { getSessionPayload } from "@/lib/auth";
import { getDbConnection } from "@/lib/db";
import {
  ensureAdminOrderListSchema,
  getAdminOrderListUserRole,
} from "@/lib/adminOrderListFetch";

export default async function OrdersPage({ searchParams }) {
  const payload = await getSessionPayload();
  if (!payload) {
    return null;
  }

  const sp = await searchParams;
  const serviceSupportOnly = String(sp?.ss || "") === "1";

  const username = payload.username;
  if (!username) {
    return (
      <div className="text-center mt-20 text-red-600 font-semibold">
        Unauthorized access
      </div>
    );
  }

  const conn = await getDbConnection();
  await ensureAdminOrderListSchema(conn);
  const userRole = await getAdminOrderListUserRole(conn, username);

  return (
    <div className="mx-auto p-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4">
        <h3 className="text-xl font-bold">
          {serviceSupportOnly ? "Service Support Orders" : "Your Orders"}
        </h3>

        <div className="flex flex-wrap gap-2">
          <a
            href="/admin-dashboard/order/delivery-status"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            📦 Delivery Status
          </a>

          <a
            href="/admin-dashboard/order/estimate-delivery"
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
          >
            ⏱ Estimate Delivery
          </a>

          <a
            href="/admin-dashboard/order/new"
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
          >
            + New Order
          </a>
        </div>
      </div>

      <OrderTable userRole={userRole} serviceSupportOnly={serviceSupportOnly} />
    </div>
  );
}
