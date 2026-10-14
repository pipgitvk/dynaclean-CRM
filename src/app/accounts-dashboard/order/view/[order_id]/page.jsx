import getOrderData from "./getOrderData";
import OrderDetails from "./OrderDetails";
import { notFound, redirect } from "next/navigation";
import { hasOrderInvoiceReport } from "@/lib/orderDocumentEditRules";

export const dynamic = "force-dynamic";

export default async function ViewOrderPage({ params }) {
  const { order_id } = await params;
  const orderId = order_id;
  if (!orderId || isNaN(orderId)) return notFound();

  const data = await getOrderData(orderId);
  if (!data?.orderDetails) return notFound();

  if (!hasOrderInvoiceReport(data.orderDetails)) {
    redirect(`/accounts-dashboard/order/upload/${orderId}`);
  }

  return <OrderDetails data={data} />;
}
