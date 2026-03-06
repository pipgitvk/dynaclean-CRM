import getOrderData from "./getOrderData";
import OrderDetails from "./OrderDetails";
import { notFound } from "next/navigation";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ViewOrderPage({ params }) {
  const { order_id } = await params;
  const orderId = order_id;
  if (!orderId || isNaN(orderId)) return notFound();

  let userRole = "";
  const payload = await getSessionPayload();
  if (payload?.username) {
    const conn = await getDbConnection();
    const [roleRows] = await conn.execute(
      "SELECT userRole FROM emplist WHERE username = ?",
      [payload.username]
    );
    userRole = roleRows[0]?.userRole || "";
  }

  const data = await getOrderData(orderId);
  if (!data?.orderDetails) return notFound();

  return <OrderDetails data={data} userRole={userRole} />;
}
