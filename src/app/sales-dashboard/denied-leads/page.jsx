import DeniedLeadsTable from "@/components/Leads/DeniedLeadsTable";
import { redirect } from "next/navigation";
import { checkDeniedLeadsAccess } from "@/lib/checkDeniedLeadsAccess";
import { fetchDeniedLeads } from "@/lib/fetchDeniedLeads";

export const dynamic = "force-dynamic";

export default async function DeniedLeadsPage({ searchParams }) {
  const access = await checkDeniedLeadsAccess();
  if (!access.allowed) {
    redirect("/sales-dashboard");
  }

  const searchParamsResolved = await searchParams;
  let deniedLeads = [];
  let totalRecords = 0;
  let totalPages = 1;
  let currentPage = 1;
  let pageSize = 50;
  let employees = [];
  let error = null;

  try {
    const result = await fetchDeniedLeads(searchParamsResolved);
    deniedLeads = result.deniedLeads;
    totalRecords = result.totalRecords;
    totalPages = result.totalPages;
    currentPage = result.currentPage;
    pageSize = result.pageSize;
    employees = result.employees;
  } catch (err) {
    console.error("Database query error:", err);
    error = "Failed to fetch data from the database.";
  }

  return (
    <div className="min-h-screen bg-gray-100 p-3 sm:p-4 md:p-6 lg:p-8">
      <h2 className="text-xl sm:text-2xl md:text-3xl text-center text-gray-900 mb-2 sm:mb-0.5">Denied Leads</h2>

      <div className="max-w-7xl mx-auto bg-white shadow-xl rounded-xl p-3 sm:p-4 md:p-6 lg:p-8 overflow-hidden">
        {error ? (
          <p className="text-center text-red-600">{error}</p>
        ) : (
          <DeniedLeadsTable
            data={deniedLeads}
            searchParams={searchParamsResolved}
            currentPage={currentPage}
            totalPages={totalPages}
            totalRecords={totalRecords}
            pageSize={pageSize}
            employees={employees}
            basePath="/sales-dashboard/denied-leads"
            viewCustomerBase="/user-dashboard/view-customer"
          />
        )}
      </div>
    </div>
  );
}
