import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { redirect } from "next/navigation";
import { getDbConnection } from "@/lib/db";
import QuotationSalesEditForm from "./QuotationSalesEditForm";

export const dynamic = "force-dynamic";

function isSalesRole(role) {
  return String(role || "").toUpperCase().includes("SALES");
}

export default async function SalesEditQuotationPage({ params }) {
  const { quoteId } = await params;

  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) redirect("/login");

  const { payload } = await jwtVerify(
    token,
    new TextEncoder().encode(process.env.JWT_SECRET),
  );

  if (!isSalesRole(payload.role)) {
    redirect("/sales-dashboard/quotations");
  }

  const conn = await getDbConnection();
  const [rows] = await conn.execute(
    `SELECT qr.emp_name, IF(no.order_id IS NOT NULL, 1, 0) AS has_order
     FROM quotations_records qr
     LEFT JOIN neworder no ON no.quote_number = qr.quote_number
     WHERE qr.quote_number = ?
     LIMIT 1`,
    [quoteId],
  );

  if (!rows.length) {
    redirect("/sales-dashboard/quotations");
  }

  if (rows[0].emp_name !== payload.username) {
    redirect("/sales-dashboard/quotations");
  }

  return (
    <div className="max-w-screen-xl mx-auto p-6 bg-white shadow-md rounded-lg">
      <QuotationSalesEditForm quoteId={quoteId} hasOrder={Boolean(rows[0].has_order)} />
    </div>
  );
}
