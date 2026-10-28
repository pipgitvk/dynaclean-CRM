// app/order/upload/[order_id]/page.jsx
import { getDbConnection } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import UploadForm from "@/app/user-dashboard/order/upload/UploadForm";
import { shouldRedirectUploadPageToView } from "@/lib/orderDocumentEditRules";

export const dynamic = "force-dynamic";

async function getOrderDetails(orderId) {
  const conn = await getDbConnection();

  const [rows] = await conn.execute(
    `SELECT no.*,
            qr.grand_total AS quotation_grand_total,
            qr.subtotal AS quotation_subtotal,
            qr.gst AS quotation_gst
     FROM neworder no
     LEFT JOIN quotations_records qr ON qr.quote_number = no.quote_number
     WHERE no.order_id = ?`,
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

  if (shouldRedirectUploadPageToView(orderDetails)) {
    redirect(`/admin-dashboard/order/view/${orderId}`);
  }

  const isEditMode = Boolean(orderDetails.report_file);

  return (
    <div className="max-w-7xl mx-auto bg-white p-6 rounded-lg  my-6">
      <h1 className="text-2xl font-bold text-center mb-6">
        {isEditMode ? "Edit Report & Tax Documents" : "Upload E-way Bill & E-invoice"}
      </h1>
      <UploadForm
        orderDetails={orderDetails}
        isEditMode={isEditMode}
        redirectPath="/admin-dashboard/order"
        nonFileFieldsReadOnly
      />
    </div>
  );
}
