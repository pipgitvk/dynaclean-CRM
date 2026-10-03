"use client";
import React, { useEffect, useState, useRef } from "react";
import { Eye, PenLine, Repeat, Search } from "lucide-react";
import {
  formatCrmDatetimeForISTDisplay,
  getCrmInstantMs,
} from "@/lib/timezone";

export default function UpcomingLeadsTable({
  leadSource,
  userRole = "",
  dashboardPrefix = "/user-dashboard",
  onCountChange = null,
}) {
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showTable, setShowTable] = useState(false);
  const rowsPerPage = 10;
  const isServiceSupport = userRole === "SERVICE SUPPORT";
  const lastFetchRef = useRef({ startDate: '', endDate: '' });

  const fetchFilteredData = async (startDate, endDate) => {
    if (!startDate && !endDate) return;
    
    setLoading(true);
    try {
      let url = `/api/upcoming-leads-table?leadSource=${leadSource}&userRole=${userRole}`;
      
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      
      const res = await fetch(url);
      const data = await res.json();
      
      let filtered = data.leads || [];
      
      // Already filtered by API, just apply some client-side processing if needed
      const invalidStatuses = isServiceSupport
        ? ["invalid", "disqualified"]
        : ["invalid", "disqualified", "denied"];
      filtered = filtered.filter((c) => {
        const statusLower = (c.status || "").trim().toLowerCase();
        return !invalidStatuses.includes(statusLower);
      });

      if (isServiceSupport) {
        filtered = filtered.filter((cust) => cust.service_next_followup);
      }

      // Already sorted by API, but ensure sorting
      filtered.sort((a, b) => {
        const dateField = isServiceSupport ? "service_next_followup" : "next_followup_date";
        const aTime = a[dateField] ? getCrmInstantMs(a[dateField]) : Infinity;
        const bTime = b[dateField] ? getCrmInstantMs(b[dateField]) : Infinity;
        return aTime - bTime;
      });

      setFilteredData(filtered);
      lastFetchRef.current = { startDate, endDate };
      
      // Notify parent about count update
      if (onCountChange) {
        onCountChange(filtered.length);
      }
      // Also emit custom event for the header
      window.dispatchEvent(new CustomEvent('tableCountUpdate', { detail: { count: filtered.length } }));
    } catch (err) {
      console.error("Failed to fetch filtered leads", err);
    } finally {
      setLoading(false);
    }
  };

  // Listen for filter changes - only once on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const startDate = localStorage.getItem('upcomingLeads_startDate') || '';
      const endDate = localStorage.getItem('upcomingLeads_endDate') || '';
      
      if (startDate || endDate) {
        setShowTable(true);
        fetchFilteredData(startDate, endDate);
      }
    }

    // Listen for filter change event from cards component
    const handleFilterChange = (event) => {
      const { startDate, endDate } = event.detail;
      if (startDate || endDate) {
        setShowTable(true);
        fetchFilteredData(startDate, endDate);
      } else {
        setShowTable(false);
        setFilteredData([]);
      }
    };

    window.addEventListener('upcomingLeadsFilterChanged', handleFilterChange);

    return () => {
      window.removeEventListener('upcomingLeadsFilterChanged', handleFilterChange);
    };
  }, []);

  // Filter by search
  const searchFilteredData = filteredData.filter((item) => {
    const keyword = search.toLowerCase();
    return (
      (item.first_name || "").toLowerCase().includes(keyword) ||
      (item.phone || "").toLowerCase().includes(keyword) ||
      (item.company || "").toLowerCase().includes(keyword) ||
      (item.status || "").toLowerCase().includes(keyword) ||
      (item.stage || "").toLowerCase().includes(keyword)
    );
  });

  const totalPages = Math.ceil(searchFilteredData.length / rowsPerPage);
  const currentData = searchFilteredData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  if (!showTable) return null;

  return (
    <div className="mt-6 border-t border-slate-200 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Showing {searchFilteredData.length} of {filteredData.length} leads
        </p>
        
        {/* Search Box */}
        <div className="flex items-center gap-2">
          <Search className="text-gray-500" size={16} />
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-violet-200"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-gray-500">
          Loading filtered data...
        </div>
      ) : (
        <>
          {/* Table for larger screens */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 bg-white text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {isServiceSupport ? "Service Next Follow-up" : "Next Follow-up"}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stage
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentData.length > 0 ? (
                  currentData.map((lead) => {
                    const dateField = isServiceSupport ? "service_next_followup" : "next_followup_date";
                    const nextFollowupDate = lead[dateField]
                      ? formatCrmDatetimeForISTDisplay(lead[dateField])
                      : "Not set";
                    return (
                      <tr
                        key={lead.customer_id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div>
                            <div className="font-medium text-gray-900">
                              {lead.first_name || "-"}
                            </div>
                            <div className="text-xs text-gray-500">
                              ID: {lead.customer_id}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {lead.company || "-"}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {lead.phone || "-"}
                        </td>
                        <td className="px-4 py-3 text-gray-700 font-medium">
                          {nextFollowupDate}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                            {lead.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {lead.stage || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-2">
                            <a
                              href={`${dashboardPrefix.replace('/sales-dashboard', '/user-dashboard')}/view-customer/${lead.customer_id}`}
                              className="text-blue-600 hover:text-blue-800 p-1 inline-flex items-center gap-1 text-xs font-medium"
                              title="View"
                            >
                              <Eye size={14} /> View
                            </a>
                            <a
                              href={`${dashboardPrefix.replace('/sales-dashboard', '/user-dashboard')}/view-customer/${lead.customer_id}/follow-up?source=upcoming`}
                              className="text-green-600 hover:text-green-800 p-1 inline-flex items-center gap-1 text-xs font-medium"
                              title="Follow Up"
                            >
                              <PenLine size={14} /> Follow
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                      No leads found for the selected date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Cards for smaller screens */}
          <div className="md:hidden space-y-3">
            {currentData.length > 0 ? (
              currentData.map((lead) => {
                const dateField = isServiceSupport ? "service_next_followup" : "next_followup_date";
                const nextFollowupDate = lead[dateField]
                  ? formatCrmDatetimeForISTDisplay(lead[dateField])
                  : "Not set";
                return (
                  <div
                    key={lead.customer_id}
                    className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {lead.first_name || "-"}
                        </h4>
                        <p className="text-xs text-gray-500">ID: {lead.customer_id}</p>
                      </div>
                      <div className="flex gap-2 mt-3">
                      <a
                        href={`${dashboardPrefix.replace('/sales-dashboard', '/user-dashboard')}/view-customer/${lead.customer_id}`}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium inline-flex items-center gap-1"
                      >
                        <Eye size={14} /> View
                      </a>
                      <a
                        href={`${dashboardPrefix.replace('/sales-dashboard', '/user-dashboard')}/view-customer/${lead.customer_id}/follow-up?source=upcoming`}
                        className="text-green-600 hover:text-green-800 text-xs font-medium inline-flex items-center gap-1"
                      >
                        <PenLine size={14} /> Follow
                      </a>
                    </div>
                    </div>
                    
                    <div className="space-y-1 text-sm text-gray-600">
                      <div><strong>Company:</strong> {lead.company || "-"}</div>
                      <div><strong>Contact:</strong> {lead.phone || "-"}</div>
                      <div>
                        <strong>{isServiceSupport ? "Service Next Follow-up" : "Next Follow-up"}:</strong>{" "}
                        {nextFollowupDate}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-3">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        {lead.status}
                      </span>
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {lead.stage || "-"}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-center text-gray-500 py-8">
                No leads found for the selected date range.
              </p>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex justify-center items-center gap-2 text-sm">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              >
                Prev
              </button>

              <span className="px-3 py-1">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}