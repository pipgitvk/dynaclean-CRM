import { getDbConnection } from "@/lib/db";
import { deriveOrderPipelineProgress } from "@/lib/orderPipelineStage";
import { isOrderVisibleToViewer } from "@/lib/orderApprovalVisibility";
import { fetchOrderViewQuotationBundle } from "@/lib/orderViewData";

export default async function getOrderData(orderId, viewerRole = "") {
  const conn = await getDbConnection();

  const [orderRows] = await conn.execute(
    "SELECT * FROM neworder WHERE order_id = ?",
    [orderId],
  );
  if (!orderRows.length) return {};

  const orderRow = orderRows[0];
  if (!isOrderVisibleToViewer(orderRow.approval_status, viewerRole)) return {};

  const { orderDetails, items: itemRows } = await fetchOrderViewQuotationBundle(
    conn,
    orderRow,
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

  return {
    orderDetails,
    items: itemRows,
    currentStage,
    stages,
    progressPercent,
    stepCompleted,
  };
}
