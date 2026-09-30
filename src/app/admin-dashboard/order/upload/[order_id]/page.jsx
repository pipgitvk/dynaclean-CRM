// app/order/upload/[order_id]/page.jsx
import { getDbConnection } from "@/lib/db";
import { notFound } from "next/navigation";
import UploadForm from "../UploadForm";

export const dynamic = "force-dynamic";

async function getOrderDetails(orderId) {
  const conn = await getDbConnection();

  const [rows] = await conn.execute(
    "SELECT * FROM neworder WHERE order_id = ?",
    [orderId],
  );
  // await conn.end();

  return rows.length ? rows[0] : null;
}

export default async function Page({ params }) {
  const { order_id } = await params;
  const orderId = order_id;
  if (!orderId || isNaN(orderId)) notFound();

  const orderDetails = await getOrderDetails(orderId);
  if (!orderDetails) notFound();

  return (
    <div className="max-w-7xl mx-auto bg-white p-6 rounded-lg  my-6">
      <h1 className="text-2xl font-bold text-center mb-6">
        Upload E-way Bill & E-invoice
      </h1>
      <UploadForm orderDetails={orderDetails} />
    </div>
  );
}
