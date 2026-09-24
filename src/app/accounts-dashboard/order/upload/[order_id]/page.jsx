// app/order/upload/[order_id]/page.jsx
import { getDbConnection } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import UploadForm from "@/app/user-dashboard/order/upload/UploadForm";
import { isBeforeDispatch } from "@/lib/orderDocumentEditRules";

export const dynamic = "force-dynamic";

async function getOrderDetails(orderId) {
  const conn = await getDbConnection();

  const [rows] = await conn.execute(
    "SELECT * FROM neworder WHERE order_id = ?",
    [orderId],
  );

  return rows.length ? rows[0] : null;
}

export default async function Page({ params }) {
  const { order_id } = await params;
  const orderId = order_id;
  if (!orderId || isNaN(orderId)) notFound();

  const orderDetails = await getOrderDetails(orderId);
  if (!orderDetails) notFound();

  if (!isBeforeDispatch(orderDetails)) {
    redirect(`/accounts-dashboard/order/view/${orderId}`);
  }

  const isEditMode = Boolean(orderDetails.report_file);

  return (
    <div className="max-w-7xl mx-auto bg-white p-6 rounded-lg  my-6">
      <h1 className="text-2xl font-bold text-center mb-6">
        {isEditMode ? "Edit Invoice & Tax Documents" : "Upload E-way Bill & E-invoice"}
      </h1>
      <UploadForm
        orderDetails={orderDetails}
        isEditMode={isEditMode}
        redirectPath="/accounts-dashboard/order"
      />
    </div>
  );
}
