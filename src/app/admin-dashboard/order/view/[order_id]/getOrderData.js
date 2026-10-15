import { getDbConnection } from "@/lib/db";
import { deriveOrderPipelineProgress } from "@/lib/orderPipelineStage";

export default async function getOrderData(orderId) {
  const conn =await getDbConnection();

  const [orderRows] = await conn.execute("SELECT * FROM neworder WHERE order_id = ?", [orderId]);
  if (!orderRows.length) return {};

  const orderDetails = orderRows[0];

  const [itemRows] = await conn.execute(
    "SELECT * FROM quotation_items WHERE quote_number = ?",
    [orderDetails.quote_number]
  );

  const statusRow = {
    sales_status: orderDetails.sales_status,
    account_status: orderDetails.account_status,
    admin_status: orderDetails.admin_status,
    dispatch_status: orderDetails.dispatch_status,
    delivery_status: orderDetails.delivery_status,
    installation_status: orderDetails.installation_status,
  };

  const {
    stages,
    currentStage,
    progressPercent,
    stepCompleted,
  } = deriveOrderPipelineProgress(orderDetails, statusRow);

      // await conn.end();

  return {
    orderDetails,
    items: itemRows,
    currentStage,
    stages,
    progressPercent,
    stepCompleted,
  };
}
