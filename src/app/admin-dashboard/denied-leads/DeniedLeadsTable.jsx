"use client";
import { useState, useTransition } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { Eye, Search, RefreshCw, Loader2 } from "lucide-react";

export default function DeniedLeadsTable({ 
  data, 
  searchParams = {},
  currentPage = 1,
  totalPages = 1,
  totalRecords = 0,
  pageSize = 50,
  userRole,
  employees = [],
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(searchParams?.search || "");
  const [filters, setFilters] = useState({
    from: searchParams?.from || "",
    to: searchParams?.to || "",
    followed_by: searchParams?.followed_by || "",
  });

  const handleSearch = (e) => {
    e.preventDefault();
    startTransition(() => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (filters.followed_by) params.set("followed_by", filters.followed_by);
      router.push(`/admin-dashboard/denied-leads?${params.toString()}`);
    });
  };

  const resetFilters = () => {
    startTransition(() => {
      setSearch("");
      setFilters({
        from: "",
        to: "",
        followed_by: "",
      });
      router.push("/admin-dashboard/denied-leads");
    });
  };

  const handlePageChange = (newPage) => {
    startTransition(() => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (filters.followed_by) params.set("followed_by", filters.followed_by);
      params.set("page", newPage.toString());
      router.push(`/admin-dashboard/denied-leads?${params.toString()}`);
    });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch}>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full mb-4">
          <input
            type="text"
            value={search}
            placeholder="Search denied leads (customer ID, name, contact, followed by)..."
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 p-2.5 sm:p-2 rounded-lg flex-1 min-w-0 text-sm"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <select
            value={filters.followed_by}
            onChange={(e) => setFilters({ ...filters, followed_by: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[150px] sm:min-w-0"
          >
            <option value="">All Employees</option>
            {employees.map((emp) => (
              <option key={emp} value={emp}>{emp}</option>
            ))}
          </select>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[120px] sm:min-w-0"
          />
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[120px] sm:min-w-0"
          />
          
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 text-sm font-medium"
          >
            {isPending ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
            {isPending ? "Searching..." : "Search"}
          </button>
          
          <button
            type="button"
            onClick={resetFilters}
            disabled={isPending}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors flex items-center gap-2 disabled:opacity-50 text-sm font-medium"
          >
            {isPending ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            Reset
          </button>
        </div>
      </form>
      
      <div className="text-sm text-gray-600 font-medium px-2 sm:px-4">
        Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} denied leads
      </div>

      <div className="md:hidden space-y-3 p-2">
        {data.map((row, i) => (
          <div
            key={i}
            className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
          >
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900 truncate">{row.name}</div>
                <div className="text-xs text-gray-500">Contact: {row.contact}</div>
                <div className="text-xs text-gray-500">Followed by: {row.followed_by}</div>
                <div className="text-xs text-gray-600 mt-1">
                  Followed on: {row.followed_date ? format(new Date(row.followed_date), "dd MMM yyyy HH:mm") : "—"}
                </div>
                <div className="text-xs text-gray-600">
                  Next follow-up: {row.next_followup_date ? format(new Date(row.next_followup_date), "dd MMM yyyy") : "—"}
                </div>
              </div>
              <button
                title="View Customer"
                onClick={() => router.push(`/admin-dashboard/view-customer/${row.customer_id}`)}
                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200"
              >
                <Eye className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="mt-2">
              <div className="text-xs text-gray-700 bg-gray-50 p-2 rounded">
                {row.notes}
              </div>
            </div>
          </div>
        ))}
        {data.length === 0 && (
          <div className="text-center py-8 text-gray-500">No results found.</div>
        )}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <div className="min-w-[900px] max-h-[500px] sm:max-h-[600px] overflow-y-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2 text-left">Customer</th>
                  <th className="px-4 py-2 text-left">Contact</th>
                  <th className="px-4 py-2 text-left">Followed By</th>
                  <th className="px-4 py-2 text-left">Followed Date</th>
                  <th className="px-4 py-2 text-left">Next Follow-up</th>
                  <th className="px-4 py-2 text-left">Customer Status</th>
                  <th className="px-4 py-2 text-left">Remarks</th>
                  <th className="px-4 py-2 text-left">Action</th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {data.map((row, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2">
                      <div className="font-medium">{row.name}</div>
                      <div className="text-xs text-gray-500">ID: {row.customer_id}</div>
                    </td>
                    <td className="px-4 py-2">{row.contact}</td>
                    <td className="px-4 py-2">{row.followed_by}</td>
                    <td className="px-4 py-2">
                      {row.followed_date ? format(new Date(row.followed_date), "dd MMM yyyy HH:mm") : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {row.next_followup_date ? format(new Date(row.next_followup_date), "dd MMM yyyy") : "—"}
                    </td>
                    <td className="px-4 py-2">{row.customer_status}</td>
                    <td className="px-4 py-2 max-w-xs truncate">{row.notes}</td>
                    <td className="px-4 py-2 flex items-center gap-2">
                      <button
                        title="View Customer"
                        onClick={() =>
                          router.push(
                            `/admin-dashboard/view-customer/${row.customer_id}`
                          )
                        }
                      >
                        <Eye className="w-5 h-5 hover:text-blue-600" />
                      </button>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-4 text-center text-gray-400"
                    >
                      No results found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 sm:px-4 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-center">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || isPending}
            className="px-2 sm:px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          <div className="flex items-center gap-1 flex-wrap justify-center">
            {currentPage > 3 && (
              <>
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={isPending}
                  className="px-2 sm:px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  1
                </button>
                {currentPage > 4 && <span className="px-2 text-gray-500">...</span>}
              </>
            )}
            
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(page => {
                return page === currentPage || 
                       page === currentPage - 1 || 
                       page === currentPage + 1 ||
                       page === currentPage - 2 ||
                       page === currentPage + 2;
              })
              .map(page => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  disabled={isPending}
                  className={`px-2 sm:px-3 py-1.5 border rounded-md text-xs sm:text-sm font-medium ${
                    page === currentPage
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
            
            {currentPage < totalPages - 2 && (
              <>
                {currentPage < totalPages - 3 && <span className="px-2 text-gray-500">...</span>}
                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={isPending}
                  className="px-2 sm:px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {totalPages}
                </button>
              </>
            )}
          </div>
          
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || isPending}
            className="px-2 sm:px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
