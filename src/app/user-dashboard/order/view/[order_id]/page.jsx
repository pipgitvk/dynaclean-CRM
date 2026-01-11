import getOrderData from "./getOrderData";
import OrderDetails from "./OrderDetails";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ViewOrderPage({ params }) {
  const orderId = parseInt(params.order_id);
  if (!orderId || isNaN(orderId)) return notFound();

  const data = await getOrderData(orderId);
  if (!data?.orderDetails) return notFound();

  return <OrderDetails data={data} />;
}
