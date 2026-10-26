import OrderTable from "./OrderTable";
import { getSessionPayload } from "@/lib/auth";
import { getDbConnection } from "@/lib/db";
import {
  ensureAccountsOrderListSchema,
  getAccountsOrderListUserRole,
} from "@/lib/accountsOrderListFetch";

export default async function OrdersPage() {
  const payload = await getSessionPayload();
  if (!payload) {
    return null;
  }

  const username = payload.username;
  if (!username) {
    return (
      <div className="text-center mt-20 text-red-600 font-semibold">
        Unauthorized access
      </div>
    );
  }

  const conn = await getDbConnection();
  await ensureAccountsOrderListSchema(conn);
  const userRole = await getAccountsOrderListUserRole(
    conn,
    username,
    payload.role ?? payload.userRole,
  );

  return (
    <div className=" mx-auto p-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4">
        <h3 className="text-xl font-bold">Your Orders</h3>

        <div className="flex flex-wrap gap-2">
          <a
            href="/user-dashboard/order/delivery-status"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            📦 Delivery Status
          </a>

          <a
            href="/user-dashboard/estimate-delivery"
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
          >
            ⏱ Estimate Delivery
          </a>

          <a
            href="/user-dashboard/order/new"
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
          >
            + New Order
          </a>
        </div>
      </div>

      <OrderTable userRole={userRole} />
    </div>
  );
}
