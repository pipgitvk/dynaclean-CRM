"use client";

import { useState, useMemo, useTransition } from "react";
import { useEffect } from "react";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import { Eye, Pencil, ArrowRightCircle, Loader2 } from "lucide-react";

export default function CustomerTable({ 
  rows, 
  searchParams,
  currentPage = 1,
  totalPages = 1,
  totalRecords = 0,
  pageSize = 50,
  userRole,
  employees = [],
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [filters, setFilters] = useState({
    search: searchParams.search ?? "",
    date_from: searchParams.date_from ?? "",
    date_to: searchParams.date_to ?? "",
    sort: searchParams.sort ?? "", // ✅ empty unless explicitly set
    status: searchParams.status ?? "",
    stage: searchParams.stage ?? "",
    lead_campaign: searchParams.lead_campaign ?? "",
    next_follow_date: searchParams.next_follow_date ?? "",
    employee: searchParams.employee ?? "",
  });
  const [isInputVisible, setIsInputVisible] = useState(false);

  useEffect(() => {
    console.log("ROWS:", rows);
    console.log("SearchParams:", searchParams);
  }, [rows, searchParams]);

  const resetFilters = () => {
    const cleared = {
      search: "",
      date_from: "",
      date_to: "",
      sort: "date_created", // ✅ fallback sort on reset
      status: "",
      stage: "",
      lead_campaign: "",
      next_follow_date: "",
      employee: "",
    };
    setFilters(cleared);
    router.push("?");
  };

  const update = (key, value) => {
    const updated = { ...filters, [key]: value };
    setFilters(updated);

    startTransition(() => {
      const query = new URLSearchParams();
      Object.entries(updated).forEach(([k, v]) => {
        if (v !== "") {
          query.set(k, v);
        }
      });

      router.push(`?${query.toString()}`);
    });
  };

  const handlePageChange = (newPage) => {
    startTransition(() => {
      const query = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== "") {
          query.set(k, v);
        }
      });
      query.set("page", newPage.toString());
      router.push(`?${query.toString()}`);
    });
  };

  // Server-side filtering and sorting, so we just use the rows directly
  const filtered = useMemo(() => {
    return rows;
  }, [rows]);

  const handleLabelClick = () => {
    setIsInputVisible((prev) => !prev); // Toggle visibility
  };

  const handleBlur = (e) => {
    // Hide the input if it's blurred and no date is selected
    if (!e.target.value) {
      setIsInputVisible(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-2">
        <input
          type="text"
          placeholder="Search"
          value={filters.search}
          onChange={(e) => update("search", e.target.value)}
          className="p-2 border rounded w-full"
        />
        <input
          type="date"
          value={filters.date_from}
          onChange={(e) => update("date_from", e.target.value)}
          className="p-2 border rounded w-full"
        />
        <input
          type="date"
          value={filters.date_to}
          onChange={(e) => update("date_to", e.target.value)}
          className="p-2 border rounded w-full"
        />
        <select
          value={filters.sort}
          onChange={(e) => update("sort", e.target.value)}
          className="p-2 border rounded w-full"
        >
          <option value="">Sort By</option>
          <option value="date_created">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="first_name">Name</option>
        </select>
        <select
          value={filters.status}
          onChange={(e) => update("status", e.target.value)}
          className="p-2 border rounded w-full"
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
          onChange={(e) => update("stage", e.target.value)}
          className="p-2 border rounded w-full"
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
        <select
          value={filters.lead_campaign}
          onChange={(e) => update("lead_campaign", e.target.value)}
          className="p-2 border rounded w-full"
        >
          <option value="">All Campaigns</option>
          <option value="india_mart">India Mart</option>
          <option value="social_media">Social Media</option>
          <option value="google_ads">Google Ads</option>
          <option value="visit">Visit</option>
          <option value="reference">Reference</option>
        </select>
        <div className="relative">
          {/* Label */}
          <label
            htmlFor="next_follow_date"
            className="cursor-pointer text-gray-600 text-sm border-b pb-1"
            onClick={handleLabelClick}
          >
            Select Next Follow-up
          </label>

          {/* Input (conditionally rendered) */}
          {isInputVisible && (
            <input
              id="next_follow_date"
              type="date"
              value={filters.next_follow_date}
              onChange={(e) => update("next_follow_date", e.target.value)}
              onBlur={handleBlur}
              className="p-2 border rounded w-full text-gray-700 mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
              placeholder="Next Follow-up"
            />
          )}
        </div>

        {/* Employee filter - only for ADMIN, SUPERADMIN, TEAM LEADER */}
        {(userRole === "ADMIN" || userRole === "SUPERADMIN" || userRole === "TEAM LEADER") && (
          <select
            value={filters.employee}
            onChange={(e) => update("employee", e.target.value)}
            className="p-2 border rounded w-full"
          >
            <option value="">All Employees</option>
            {employees.map((emp) => (
              <option key={emp} value={emp}>
                {emp}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={resetFilters}
          className="p-2 border rounded bg-red-100 hover:bg-red-200 w-full"
        >
          Reset
        </button>
      </div>

      {/* Row count */}
      <div className="text-sm text-gray-600">
        Showing {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
      </div>

      {/* Responsive Table (Desktop) */}
      <div className="border rounded">
        <div className="hidden lg:block overflow-auto max-h-[60vh]">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 sticky top-0 z-10">
              <tr>
                {[
                  "ID",
                  "Customer",
                  "Status",
                  "Stage",
                  "Notes",
                  "Created",
                  "Products Interest",
                ].map((h) => (
                  <th key={h} className="px-4 py-2 text-left whitespace-nowrap">
                    {h}
                  </th>
                ))}
                <th className="px-4 py-2 text-center whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.customer_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">{r.customer_id}</td>
                  <td className="px-4 py-2">
                    <div className="font-medium">{r.first_name}</div>
                    <div className="text-xs text-gray-500">{r.email}</div>
                    <div className="text-xs text-gray-500">{r.phone}</div>
                  </td>
                  <td className="px-4 py-2">{r.status}</td>
                  <td className="px-4 py-2">{r.stage}</td>
                  <td className="px-4 py-2">{r.notes}</td>
                  <td className="px-4 py-2">
                    {dayjs(r.date_created).format("DD MMM YYYY")}
                  </td>
                  <td className="px-4 py-2">{r.products_interest}</td>
                  <td className="px-4 py-2 flex items-center gap-2 justify-center text-gray-600">
                    <button
                      title="View"
                      onClick={() =>
                        router.push(
                          `/user-dashboard/view-customer/${r.customer_id}`
                        )
                      }
                    >
                      <Eye className="w-5 h-5 hover:text-blue-600" />
                    </button>
                    <button
                      title="Edit"
                      onClick={() =>
                        router.push(
                          `/user-dashboard/view-customer/${r.customer_id}/edit`
                        )
                      }
                    >
                      <Pencil className="w-5 h-5 hover:text-green-600" />
                    </button>
                    <button
                      title="Follow-up"
                      onClick={() =>
                        router.push(
                          `/user-dashboard/view-customer/${r.customer_id}/follow-up`
                        )
                      }
                    >
                      <ArrowRightCircle className="w-5 h-5 hover:text-orange-600" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center p-4">
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card Layout */}
        <div className="lg:hidden flex flex-col divide-y">
          {filtered.length === 0 && (
            <div className="text-center p-4 text-gray-500">
              No customers found.
            </div>
          )}
          {filtered.map((r) => (
            <div key={r.customer_id} className="p-4 space-y-1">
              <div>
                <span className="font-semibold">ID:</span> {r.customer_id}
              </div>
              <div>
                <span className="font-semibold">Name:</span> {r.first_name}
              </div>
              <div>
                <span className="font-semibold">Email:</span> {r.email}
              </div>
              <div>
                <span className="font-semibold">Phone:</span> {r.phone}
              </div>
              <div>
                <span className="font-semibold">Status:</span> {r.status}
              </div>
              <div>
                <span className="font-semibold">Stage:</span> {r.stage}
              </div>
              <div>
                <span className="font-semibold">Notes:</span> {r.notes}
              </div>
              <div>
                <span className="font-semibold">Created:</span>{" "}
                {dayjs(r.date_created).format("DD MMM YYYY")}
              </div>
              <div>
                <span className="font-semibold">Products Interest:</span> {r.products_interest}
              </div>
              <div className="flex items-center gap-4 pt-2 cursor-pointer">
                <button
                  title="View"
                  onClick={() =>
                    router.push(
                      `/user-dashboard/view-customer/${r.customer_id}`
                    )
                  }
                >
                  <Eye className="w-5 h-5 hover:text-blue-600" />
                </button>
                <button
                  title="Edit"
                  onClick={() =>
                    router.push(
                      `/user-dashboard/view-customer/${r.customer_id}/edit`
                    )
                  }
                >
                  <Pencil className="w-5 h-5 hover:text-green-600" />
                </button>
                <button
                  title="Follow-up"
                  onClick={() =>
                    router.push(
                      `/user-dashboard/view-customer/${r.customer_id}/follow-up`
                    )
                  }
                >
                  <ArrowRightCircle className="w-5 h-5 hover:text-orange-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between px-4 py-4 bg-gray-50 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} customers
        </div>
        
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
