import OrderTable from "./OrderTable";
import { loadOrdersListForSession } from "@/lib/loadOrdersListForSession";

export default async function OrdersPage() {
  const { error, orders: ordersWithBatches, userRole } =
    await loadOrdersListForSession();

  if (error === "unauthorized") {
    return (
      <div className="text-center mt-20 text-red-600 font-semibold">
        Unauthorized access
      </div>
    );
  }

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


      <OrderTable orders={ordersWithBatches} userRole={userRole} />
    </div>
  );
}
