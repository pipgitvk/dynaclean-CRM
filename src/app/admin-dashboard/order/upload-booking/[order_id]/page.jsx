// app/admin-dashboard/order/upload-booking/[order_id]/page.jsx
import { getDbConnection } from "@/lib/db";
import UploadBookingForm from "./form";

export default async function UploadBookingPage({ params }) {
  const { order_id } = await params;
  const orderId = order_id;

  const conn = await getDbConnection();

  const [rows] = await conn.execute(
    `SELECT order_id, client_name, contact, email, delivery_location, quote_number, client_delivery_date FROM neworder WHERE order_id = ?`,
    [orderId],
  );

  // await conn.end();

  if (rows.length === 0)
    return <div className="text-red-500 p-4">Order not found</div>;

  return <UploadBookingForm order={rows[0]} />;
}
