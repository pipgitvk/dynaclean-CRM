import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { redirect } from "next/navigation";
import { getDbConnection } from "@/lib/db";
import QuotationSalesEditForm from "@/app/sales-dashboard/quotations/[quoteId]/edit/QuotationSalesEditForm";

export const dynamic = "force-dynamic";

export default async function UserEditQuotationPage({ params }) {
  const { quoteId } = await params;

  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) redirect("/login");

  let payload;
  try {
    ({ payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET),
    ));
  } catch {
    redirect("/login");
  }

  const pool = await getDbConnection();
  let conn;
  let rows = [];

  try {
    conn = await pool.getConnection();
    [rows] = await conn.execute(
      `SELECT qr.emp_name, qr.customer_id, IF(no.order_id IS NOT NULL, 1, 0) AS has_order
       FROM quotations_records qr
       LEFT JOIN neworder no ON no.quote_number = qr.quote_number
       WHERE qr.quote_number = ?
       LIMIT 1`,
      [quoteId],
    );
  } finally {
    try {
      if (conn) conn.release();
    } catch {
      /* ignore release errors */
    }
  }

  if (!rows.length) {
    redirect("/user-dashboard/quotations");
  }

  if (rows[0].emp_name !== payload.username) {
    redirect("/user-dashboard/quotations");
  }

  return (
    <div className="max-w-screen-xl mx-auto p-6 bg-white shadow-md rounded-lg">
      <QuotationSalesEditForm
        quoteId={quoteId}
        hasOrder={Boolean(rows[0].has_order)}
        redirectOrigin="user-dashboard"
      />
    </div>
  );
}
