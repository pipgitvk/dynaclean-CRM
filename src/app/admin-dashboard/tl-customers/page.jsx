import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import TLCustomersTable from "@/app/user-dashboard/tl-customers/TLCustomersTable";
import Link from "next/link";
import { fetchTLCustomersList } from "@/lib/fetchTLCustomersList";

export const dynamic = "force-dynamic";

export default async function AdminTLCustomersPage({ searchParams }) {
  const payload = await getSessionPayload();
  if (!payload) {
    return <div className="p-8 text-red-600">Unauthorized</div>;
  }

  const searchParamsResolved = await searchParams;
  const conn = await getDbConnection();

  const pageSize = 50;
  const {
    rows: customers,
    totalRecords,
    totalPages,
    page: currentPage,
    showTLOnly,
    showPreBookingOnly,
    isSuperAdmin,
  } = await fetchTLCustomersList(conn, payload, searchParamsResolved, {
    mode: "full",
    pageSize,
    paginate: true,
  });

  const { rows: allCustomersForKPI } = await fetchTLCustomersList(
    conn,
    payload,
    searchParamsResolved,
    { mode: "kpi", paginate: false },
  );

  const [employees] = await conn.execute(
    `SELECT DISTINCT username, username as name FROM rep_list WHERE userRole IN ('SALES') AND status = 1 ORDER BY username`,
  );

  const [productsList] = await conn.execute(
    `SELECT item_code, item_name FROM products_list ORDER BY item_name ASC`,
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          TL Customer Management (Admin)
        </h1>
        <div className="flex gap-4">
          <Link
            href="/admin-dashboard/tl-customers/pre-booking"
            className="inline-flex items-center px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition font-medium"
          >
            📋 View Pre-Bookings
          </Link>
          <Link
            href="/admin-dashboard/tl-customers/bulk-follow-uploads"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition font-medium"
          >
            Bulk Follow Uploads
          </Link>
        </div>
      </div>

      <TLCustomersTable
        customers={customers}
        allCustomersForKPI={allCustomersForKPI}
        employees={employees}
        productsList={productsList}
        searchParams={searchParamsResolved}
        currentPage={currentPage}
        totalPages={totalPages}
        totalRecords={totalRecords}
        pageSize={pageSize}
        isAdmin={true}
        tlOnly={showTLOnly}
        preBookingOnly={showPreBookingOnly}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  );
}
