import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { redirect } from "next/navigation";
import { normalizeRoleKey } from "@/lib/roleKeyUtils";
import { loadOrdersListForSession } from "@/lib/loadOrdersListForSession";
import WarehouseInchargeOrdersClient from "@/components/warehouse-incharge/WarehouseInchargeOrdersClient";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

export default async function WarehouseInchargeOrdersPage() {
  const cookieStore = await cookies();
  const token =
    cookieStore.get("impersonation_token")?.value ||
    cookieStore.get("token")?.value;

  if (!token) {
    return <p className="text-red-600 p-6">Unauthorized</p>;
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET),
    );
    const roleKey = normalizeRoleKey(payload.role);
    if (roleKey !== "WAREHOUSE INCHARGE") {
      redirect("/user-dashboard/order");
    }
  } catch {
    return <p className="text-red-600 p-6">Unauthorized</p>;
  }

  const { orders, userRole } = await loadOrdersListForSession();

  return (
    <div className="mx-auto p-6">
      <h3 className="text-xl font-bold mb-4">Your Orders</h3>
      <WarehouseInchargeOrdersClient orders={orders} userRole={userRole} />
    </div>
  );
}
