import { getDbConnection } from "@/lib/db";
import {
  filterQuotationItemsForBatch,
  getBookingBatchForView,
  syntheticBatchFromNeworder,
} from "@/lib/orderBookingBatches";

function buildStageProgress(orderDetails) {
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
    if (firstIncompleteIndex === 0) {
      currentStage = "Sales";
    } else {
      currentStage = stages[firstIncompleteIndex - 1];
    }
  }
  const currentIndex = stages.indexOf(currentStage);
  const progressPercent = (currentIndex / (stages.length - 1)) * 100;
  return { stages, currentStage, currentIndex, progressPercent };
}

/** @param {string} [seq] query: 1 | remain | latest */
export async function getViewBookingPageData(orderId, seq) {
  const connection = await getDbConnection();

  const [orderRows] = await connection.execute(
    "SELECT * FROM neworder WHERE order_id = ?",
    [orderId],
  );
  if (orderRows.length === 0) return null;

  let orderDetails = orderRows[0];
  const [itemsRows] = await connection.execute(
    "SELECT * FROM quotation_items WHERE quote_number = ?",
    [orderDetails.quote_number],
  );

  let bookingViewLabel = null;
  let items = itemsRows;

  if (seq) {
    let batch = await getBookingBatchForView(connection, orderId, seq);
    if (!batch && seq === "1") {
      batch = syntheticBatchFromNeworder(orderDetails);
    }
    if (batch) {
      orderDetails = {
        ...orderDetails,
        booking_id: batch.booking_id,
        booking_url: batch.booking_url,
        booking_date: batch.booking_date,
        delivery_date: batch.delivery_date,
        admin_remark: batch.admin_remark,
        booking_by: batch.booking_by,
      };
      items = filterQuotationItemsForBatch(itemsRows, batch);
      if (seq === "remain" || seq === "latest") {
        bookingViewLabel = `Remaining booking (batch ${batch.sequence_no})`;
      } else if (Number(seq) > 1) {
        bookingViewLabel = `Booking batch ${batch.sequence_no}`;
      } else {
        bookingViewLabel = "First booking";
      }
    }
  }

  const { stages, currentStage, currentIndex, progressPercent } =
    buildStageProgress(orderDetails);

  return {
    orderDetails,
    items,
    stages,
    currentStage,
    currentIndex,
    progressPercent,
    bookingViewLabel,
  };
}
