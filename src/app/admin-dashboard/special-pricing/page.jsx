import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

import Link from "next/link";
import AdminSpecialPriceTable from "@/components/specialPrice/adminSpecialPriceTable";

export const dynamic = "force-dynamic";

export default async function SpecialPricingPage({ searchParams }) {
  const payload = await getSessionPayload();
  if (!payload) return null;

  const { role, username } = payload;
  const { page = "1" } = searchParams || {};

  const currentPage = parseInt(page);
  const pageSize = 50;
  const offset = (currentPage - 1) * pageSize;

  const conn = await getDbConnection();

  const [rows] = await conn.execute(
    `
    SELECT 
      sp.*,
      c.first_name,
      p.item_name
    FROM special_price sp
    LEFT JOIN customers c ON sp.customer_id = c.customer_id
    LEFT JOIN products_list p ON sp.product_id = p.id
    ORDER BY sp.set_date DESC
    LIMIT ? OFFSET ?
    `,
    [pageSize, offset]
  );

  return (
    <div className="p-6">
      
      {/* Header with Add Button */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Special Pricing</h1>

        {(role === "SUPERADMIN" ) && (
          <Link
            href="/admin-dashboard/special-pricing/new"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            + Add Special Price
          </Link>
        )}
      </div>

      <AdminSpecialPriceTable
        rows={rows}
        currentPage={currentPage}
        totalPages={1}
        userRole={role}
      />
    </div>
  );
}


