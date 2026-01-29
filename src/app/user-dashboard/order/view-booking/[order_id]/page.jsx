// app/admin-dashboard/order/view/[order_id]/page.jsx
import { getDbConnection } from "@/lib/db";
import ViewOrderDetails from "./ViewOrderDetails";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

async function getOrderData(order_id) {
  const connection = await getDbConnection();

  const [orderRows] = await connection.execute(
    "SELECT * FROM neworder WHERE order_id = ?",
    [order_id],
  );

  if (orderRows.length === 0) return null;

  const orderDetails = orderRows[0];
  const [itemsRows] = await connection.execute(
    "SELECT * FROM quotation_items WHERE quote_number = ?",
    [orderDetails.quote_number],
  );

  const stages = [
    "Sales",
    "Account",
    "Admin",
    "Dispatch",
    "Delivered",
    "Installation Report",
    "Complete",
  ];
  const statuses = [
    orderDetails.sales_status,
    orderDetails.account_status,
    orderDetails.admin_status,
    orderDetails.dispatch_status,
    orderDetails.delivery_status,
    orderDetails.installation_status,
  ];
  let currentStage = "Sales";
  if (!statuses.includes(0)) {
    currentStage = "Complete";
  } else {
    const firstIncompleteIndex = statuses.indexOf(0);
    // Show the last completed stage, not the next pending one
    if (firstIncompleteIndex === 0) {
      currentStage = "Sales";
    } else {
      currentStage = stages[firstIncompleteIndex - 1];
    }
  }

  const currentIndex = stages.indexOf(currentStage);
  const progressPercent = (currentIndex / (stages.length - 1)) * 100;

  // await connection.end();

  return {
    orderDetails,
    items: itemsRows,
    stages,
    currentStage,
    currentIndex,
    progressPercent,
  };
}

export default async function Page({ params }) {
  const { order_id } = await params;
  const data = await getOrderData(order_id);
  if (!data) return notFound();
  return <ViewOrderDetails data={data} />;
}
