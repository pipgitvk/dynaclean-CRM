"use client";
import { useState, useTransition } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Search, RefreshCw, Loader2 } from "lucide-react";
import Link from "next/link";

export default function CustomerTable({ 
  data, 
  leadSources = [],
  searchParams = {},
  currentPage = 1,
  totalPages = 1,
  totalRecords = 0,
  pageSize = 50,
  userRole,
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(searchParams?.search || "");
  const [filters, setFilters] = useState({
    lead_source: searchParams?.lead_source || "",
    lead_campaign: searchParams?.lead_campaign || "",
    status: searchParams?.status || "",
    stage: searchParams?.stage || "",
    from: searchParams?.from || "",
    to: searchParams?.to || "",
  });

  const handleSearch = (e) => {
    e.preventDefault();
    startTransition(() => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filters.lead_source) params.set("lead_source", filters.lead_source);
      if (filters.lead_campaign) params.set("lead_campaign", filters.lead_campaign);
      if (filters.status) params.set("status", filters.status);
      if (filters.stage) params.set("stage", filters.stage);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      router.push(`/admin-dashboard/customers?${params.toString()}`);
    });
  };

  const resetFilters = () => {
    startTransition(() => {
      setSearch("");
      setFilters({
        lead_source: "",
        lead_campaign: "",
        status: "",
        stage: "",
        from: "",
        to: "",
      });
      router.push("/admin-dashboard/customers");
    });
  };

  const handlePageChange = (newPage) => {
    startTransition(() => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filters.lead_source) params.set("lead_source", filters.lead_source);
      if (filters.lead_campaign) params.set("lead_campaign", filters.lead_campaign);
      if (filters.status) params.set("status", filters.status);
      if (filters.stage) params.set("stage", filters.stage);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      params.set("page", newPage.toString());
      router.push(`/admin-dashboard/customers?${params.toString()}`);
    });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch}>
        <div className="flex justify-between items-center space-x-2 w-full mb-4">
          <input
            type="text"
            value={search}
            placeholder="Search customers (ID, phone, name, email)..."
            onChange={(e) => setSearch(e.target.value)}
            className="border p-2 rounded flex-1"
          />
          <Link
            href={`/admin-dashboard/customers/followups`}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Daily Follow-Ups
          </Link>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          {(userRole === "ADMIN" || userRole === "SUPERADMIN" || userRole === "TEAM LEADER") && (
            <select
              value={filters.lead_source}
              onChange={(e) =>
                setFilters({ ...filters, lead_source: e.target.value })
              }
              className="border rounded px-3 py-2"
            >
              <option value="">All Employees</option>
              {leadSources.map((src) => (
                <option key={src} value={src}>
                  {src}
                </option>
              ))}
            </select>
          )}
          <select
            value={filters.lead_campaign}
            onChange={(e) =>
              setFilters({ ...filters, lead_campaign: e.target.value })
            }
            className="border rounded px-3 py-2"
          >
            <option value="">All Lead Campaigns</option>
            <option value="india_mart">India Mart</option>
            <option value="social_media">Social Media</option>
            <option value="google_ads">Google Ads</option>
            <option value="visit">Visit</option>
            <option value="reference">Reference</option>
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="border rounded px-3 py-2"
          >
            <option value="">All Status</option>
            <option value="New">New</option>
            <option value="verygud">Very Good</option>
            <option value="average">Average</option>
            <option value="poor">Poor</option>
            <option value="denied">Denied</option>
          </select>

          <select
            value={filters.stage}
            onChange={(e) => setFilters({ ...filters, stage: e.target.value })}
            className="border rounded px-3 py-2"
          >
            <option value="">All Stages</option>
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="Interested">Interested</option>
            <option value="Demo Scheduled">Demo Scheduled</option>
            <option value="Demo Completed">Demo Completed</option>
            <option value="Qualified">Qualified</option>
            <option value="Quotation Sent">Quotation Sent</option>
            <option value="Quotation Revised">Quotation Revised</option>
            <option value="Negotiation / Follow-up">Negotiation / Follow-up</option>
            <option value="Decision Pending">Decision Pending</option>
            <option value="Won (Order Received)">Won (Order Received)</option>
            <option value="Lost">Lost</option>
            <option value="Disqualified / Invalid Lead">Disqualified / Invalid Lead</option>
          </select>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            className="border rounded px-3 py-2"
          />
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            className="border rounded px-3 py-2"
          />
          
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isPending ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
            {isPending ? "Searching..." : "Search"}
          </button>
          
          <button
            type="button"
            onClick={resetFilters}
            disabled={isPending}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isPending ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            Reset
          </button>
        </div>
      </form>
      
      <div className="text-sm text-gray-600 font-medium px-4">
        Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} customers
      </div>

      {/* 🧾 Table */}
      <div className="hidden md:flex justify-center px-4">
        <div className="w-full max-w-full overflow-x-auto">
          <div className="bg-white shadow-lg rounded-lg border border-gray-200 inline-block min-w-[1000px] max-h-[600px] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2 text-left">Customer</th>
                  <th className="px-4 py-2 text-left">Lead Source</th>
                  <th className="px-4 py-2 text-left">Tags</th>
                  <th className="px-4 py-2 text-left">notes</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Stage</th>
                  <th className="px-4 py-2 text-left">Products Interest</th>
                  <th className="px-4 py-2 text-left">Date Created</th>
                  <th className="px-4 py-2 text-left">Action</th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {data.map((row, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2">
                      <div className="font-medium">{row.first_name}</div>
                      <div className="text-xs text-gray-500">{row.email ? row.email : "---"}</div>
                      <div className="text-xs text-gray-500">{row.phone}</div>
                    </td>
                    <td className="px-4 py-2">{row.lead_source}</td>
                    <td className="px-4 py-2">{row.tags}</td>
                    <td className="px-4 py-2">
                      {row.latest_note ? row.latest_note : "---"}
                    </td>
                    <td className="px-4 py-2">{row.status}</td>
                    <td className="px-4 py-2">{row.stage}</td>
                    <td className="px-4 py-2">{row.products_interest}</td>
                    <td className="px-4 py-2">
                      {format(new Date(row.date_created), "dd MMM yyyy")}
                    </td>
                    <td className="px-4 py-2 flex items-center gap-2">
                      <button
                        title="View"
                        onClick={() =>
                          router.push(
                            `/admin-dashboard/view-customer/${row.customer_id}`
                          )
                        }
                      >
                        <Eye className="w-5 h-5 hover:text-blue-600" />
                      </button>
                      <button
                        title="Edit"
                        onClick={() =>
                          router.push(
                            `/admin-dashboard/view-customer/${row.customer_id}/edit`
                          )
                        }
                      >
                        <Pencil className="w-5 h-5 hover:text-green-600" />
                      </button>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
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
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || isPending}
            className="px-3 py-1 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          <div className="flex items-center gap-1">
            {/* First page */}
            {currentPage > 3 && (
              <>
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={isPending}
                  className="px-3 py-1 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  1
                </button>
                {currentPage > 4 && <span className="px-2 text-gray-500">...</span>}
              </>
            )}
            
            {/* Page numbers around current page */}
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
                  className={`px-3 py-1 border rounded-md text-sm font-medium ${
                    page === currentPage
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
            
            {/* Last page */}
            {currentPage < totalPages - 2 && (
              <>
                {currentPage < totalPages - 3 && <span className="px-2 text-gray-500">...</span>}
                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={isPending}
                  className="px-3 py-1 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {totalPages}
                </button>
              </>
            )}
          </div>
          
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || isPending}
            className="px-3 py-1 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
