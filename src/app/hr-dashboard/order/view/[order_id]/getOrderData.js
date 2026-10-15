import { getDbConnection } from "@/lib/db";
import { deriveOrderPipelineProgress } from "@/lib/orderPipelineStage";
import { isOrderVisibleToViewer } from "@/lib/orderApprovalVisibility";

export default async function getOrderData(orderId, viewerRole = "") {
  const pool = await getDbConnection();
  const conn = await pool.getConnection();
  
  try {
    const [orderRows] = await conn.execute("SELECT * FROM neworder WHERE order_id = ?", [orderId]);
  if (!orderRows.length) return {};

  const orderDetails = orderRows[0];
  if (!isOrderVisibleToViewer(orderDetails.approval_status, viewerRole)) return {};

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

    return {
      orderDetails,
      items: itemRows,
      currentStage,
      stages,
      progressPercent,
      stepCompleted,
    };
  } finally {
    if (conn) {
      try {
        await conn.release();
      } catch (releaseError) {
        console.error("Error releasing connection:", releaseError);
      }
    }
  }
}
