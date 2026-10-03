"use client";

import { useEffect, useState } from "react";
import QuotationViewModal from "@/components/Quotation/QuotationViewModal";

export default function CustomerQuotationsTable({ customerId, customerName, username, role }) {
  const isSuperAdmin = role === "SUPERADMIN";

  const [quotations, setQuotations] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalQuote, setModalQuote] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const url = `/api/quotations-show?username=${encodeURIComponent(username || "")}&customer_id=${encodeURIComponent(String(customerId))}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        setQuotations(data);
        setFiltered(data);
      } catch (error) {
        console.error("Failed to fetch quotations:", error);
        setQuotations([]);
        setFiltered([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [customerId, username]);

  useEffect(() => {
    const keyword = search.trim().toLowerCase();

    const result = quotations.filter((q) => {
      if (statusFilter === "completed" && !q.has_order) return false;
      if (statusFilter === "pending" && q.has_order) return false;

      if (!keyword) return true;

      return (
        (q.quote_number?.toString().toLowerCase() || "").includes(keyword) ||
        (q.company_name?.toLowerCase() || "").includes(keyword) ||
        (q.emp_name?.toLowerCase() || "").includes(keyword) ||
        (q.email?.toLowerCase() || "").includes(keyword) ||
        (q.phone?.toLowerCase() || "").includes(keyword)
      );
    });

    setFiltered(result);
    setCurrentPage(1);
  }, [search, statusFilter, quotations]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedRows = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const PaginationBar = () => (
    <div className="flex items-center justify-between px-2 py-3 border-t mt-2 text-sm text-gray-600">
      <span>
        Showing {filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–
        {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
      </span>
      <div className="flex items-center gap-1">
        <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-gray-100">«</button>
        <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-gray-100">‹</button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
          .reduce((acc, p, i, arr) => {
            if (i > 0 && p - arr[i - 1] > 1) acc.push("...");
            acc.push(p);
            return acc;
          }, [])
          .map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="px-2">…</span>
            ) : (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                className={`px-2.5 py-1 rounded border text-xs ${
                  p === currentPage ? "bg-blue-600 text-white border-blue-600" : "hover:bg-gray-100"
                }`}
              >
                {p}
              </button>
            )
          )}
        <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-gray-100">›</button>
        <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-gray-100">»</button>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded shadow p-4">
      <QuotationViewModal
        quoteNumber={modalQuote}
        onClose={() => setModalQuote(null)}
        showAddProspectLink
      />

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1 w-full sm:w-40"
        >
          <option value="">All Status</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
        </select>
        <input
          type="text"
          placeholder="Search by ID, client, email, phone, or employee…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1 w-full"
        />
      </div>

      {/* Table — md+ */}
      <div className="overflow-x-auto hidden md:block rounded shadow">
        <p className="text-sm text-gray-500 px-1 py-1">Rows: {filtered.length}</p>
        <table className="min-w-full w-full table-auto text-sm text-gray-800 divide-y divide-gray-200">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="px-4 py-2">Quotation ID</th>
              <th className="px-4 py-2">Client Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Created By</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" className="text-center py-6 text-gray-500">Loading…</td>
              </tr>
            ) : paginatedRows.length > 0 ? (
              paginatedRows.map((q) => (
                <tr key={q.quote_number} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">{q.quote_number}</td>
                  <td className="px-4 py-2">{q.company_name}</td>
                  <td className="px-4 py-2">{q.email || "-"}</td>
                  <td className="px-4 py-2">{q.phone || "-"}</td>
                  <td className="px-4 py-2">{new Date(q.quote_date).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-2">₹{q.grand_total}</td>
                  <td className="px-4 py-2">{q.emp_name}</td>
                  <td className="px-4 py-2">
                    {q.has_order ? (
                      <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full border border-green-300">
                        <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                        Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 text-xs font-medium px-2 py-1 rounded-full border border-gray-200">
                        <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setModalQuote(q.quote_number)}
                        className="bg-green-600 text-white px-4 py-2 rounded font-medium text-sm hover:bg-green-700 transition-colors"
                      >
                        View
                      </button>
                      {isSuperAdmin && (
                        <a
                          href={`/admin-dashboard/quotations/${encodeURIComponent(q.quote_number)}/edit`}
                          className="bg-blue-600 text-white px-4 py-2 rounded font-medium text-sm hover:bg-blue-700 transition-colors inline-block"
                        >
                          Edit
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="text-center text-gray-500 py-6 italic">No quotations found.</td>
              </tr>
            )}
          </tbody>
        </table>
        <PaginationBar />
      </div>

      {/* Cards — mobile */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {loading ? (
          <div className="text-center py-4 text-gray-500">Loading…</div>
        ) : paginatedRows.length > 0 ? (
          paginatedRows.map((q) => (
            <div key={q.quote_number} className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-lg text-gray-900">ID: {q.quote_number}</h3>
                <span className="text-sm text-gray-500">{new Date(q.quote_date).toLocaleDateString("en-IN")}</span>
              </div>
              <p className="text-gray-700"><strong>Client:</strong> {q.company_name}</p>
              <p className="text-gray-700"><strong>Email:</strong> {q.email || "-"}</p>
              <p className="text-gray-700"><strong>Phone:</strong> {q.phone || "-"}</p>
              <p className="text-gray-700"><strong>Total:</strong> ₹{q.grand_total}</p>
              <p className="text-gray-700 mb-4"><strong>Created By:</strong> {q.emp_name}</p>
              <div className="flex justify-between items-center">
                {q.has_order ? (
                  <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full border border-green-300">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                    Completed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 text-xs font-medium px-2 py-1 rounded-full border border-gray-200">
                    <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
                    Pending
                  </span>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalQuote(q.quote_number)}
                    className="bg-green-600 text-white px-4 py-2 rounded font-medium text-sm hover:bg-green-700"
                  >
                    View
                  </button>
                  {isSuperAdmin && (
                    <a
                      href={`/admin-dashboard/quotations/${encodeURIComponent(q.quote_number)}/edit`}
                      className="bg-blue-600 text-white px-4 py-2 rounded font-medium text-sm hover:bg-blue-700 text-center inline-block"
                    >
                      Edit
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-4 text-center text-gray-500">No quotations found.</div>
        )}
        <PaginationBar />
      </div>
    </div>
  );
}
