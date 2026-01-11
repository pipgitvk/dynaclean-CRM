import { getDbConnection } from "@/lib/db";

export default async function getOrderData(orderId) {
  const conn =await getDbConnection();

  const [orderRows] = await conn.execute("SELECT * FROM neworder WHERE order_id = ?", [orderId]);
  if (!orderRows.length) return {};

  const orderDetails = orderRows[0];

  const [itemRows] = await conn.execute(
    "SELECT * FROM quotation_items WHERE quote_number = ?",
    [orderDetails.quote_number]
  );

  const statuses = [
    orderDetails.sales_status,
    orderDetails.account_status,
    orderDetails.admin_status,
    orderDetails.dispatch_status,
    orderDetails.delivery_status,
    orderDetails.installation_status,
  ];

  const stages = ['Sales', 'Account', 'Admin', 'Dispatch', 'Delivery', 'Installation Report', 'Complete'];
  let currentStage = 'Sales';

  if (!statuses.includes(0)) {
    currentStage = 'Complete';
  } else {
    const firstIncomplete = statuses.findIndex((s) => s === 0);
    // Show the last completed stage, not the next pending one
    if (firstIncomplete === 0) {
      currentStage = 'Sales';
    } else {
      currentStage = stages[firstIncomplete - 1];
    }
  }

  const currentIndex = stages.indexOf(currentStage);
  const progressPercent = (currentIndex / (stages.length - 1)) * 100;

      // await conn.end();

  return {
    orderDetails,
    items: itemRows,
    currentStage,
    stages,
    progressPercent,
    currentIndex,
  };
}
