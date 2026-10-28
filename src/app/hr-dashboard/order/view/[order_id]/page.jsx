import getOrderData from "./getOrderData";
import OrderDetails from "./OrderDetails";
import { notFound } from "next/navigation";
import { getSessionPayload } from "@/lib/auth";
import { getDbConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ViewOrderPage({ params }) {
  const { order_id } = await params;
  const orderId = order_id;
  if (!orderId || isNaN(orderId)) return notFound();

  const payload = await getSessionPayload();
  let userRole = payload?.role || payload?.userRole || "";
  if (payload?.username) {
    const conn = await getDbConnection();
    const [roleRows] = await conn.execute(
      "SELECT userRole FROM rep_list WHERE username = ?",
      [payload.username],
    );
    userRole = roleRows[0]?.userRole || userRole;
  }

  const data = await getOrderData(orderId, userRole);
  if (!data?.orderDetails) return notFound();

  return <OrderDetails data={data} />;
}
