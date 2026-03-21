"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QuotationViewModal from "@/components/Quotation/QuotationViewModal";

export default function QuotationTableClient({ username, customerId }) {
  const [quotations, setQuotations] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [modalQuote, setModalQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchData = async () => {
    console.log("Fetching quotations for user:", username);
    setLoading(true);
    let url = `/api/quotations-show?username=${encodeURIComponent(username || "")}`;

    // Append filters to the API request URL
    if (fromDate) url += `&from_date=${fromDate}`;
    if (toDate) url += `&to_date=${toDate}`;
    if (customerId)
      url += `&customer_id=${encodeURIComponent(String(customerId))}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      setQuotations(data);
      setFiltered(data); // set filtered too
    } catch (error) {
      console.error("Failed to fetch quotations:", error);
      setQuotations([]);
      setFiltered([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(); // Load data initially
  }, [username, fromDate, toDate, customerId]);

  useEffect(() => {
    if (!search) {
      setFiltered(quotations);
    } else {
      const keyword = search.toLowerCase();

      const filteredData = quotations.filter((q) => {
        const quoteNumber = q.quote_number?.toString().toLowerCase() || "";
        const companyName = q.company_name?.toLowerCase() || "";
        const empName = q.emp_name?.toLowerCase() || "";
        const email = q.email?.toLowerCase() || "";
        const phone = q.phone?.toLowerCase() || "";

        return (
          quoteNumber.includes(keyword) ||
          companyName.includes(keyword) ||
          empName.includes(keyword) ||
          email.includes(keyword) ||
          phone.includes(keyword)
        );
      });

      setFiltered(filteredData);
    }
  }, [search, quotations]);

  const handleReset = () => {
    setFromDate("");
    setToDate("");
    setSearch(""); // Also clear search on reset
  };

  return (
    <div className="bg-white rounded shadow p-4">
      <QuotationViewModal
        quoteNumber={modalQuote}
        onClose={() => setModalQuote(null)}
        showAddProspectLink
      />

      {/* Filters */}
      <div className="flex flex-col md:flex-row justify-between gap-2 mb-4">
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <button
            onClick={handleReset}
            className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700 w-full sm:w-auto"
          >
            Reset
          </button>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1 w-full"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1 w-full"
          />
        </div>
        <input
          type="text"
          placeholder="Search by ID, client, email, phone, or employee..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1 w-full md:w-64"
        />
      </div>

      {/* Table - Visible on medium screens and larger */}
      <div className="overflow-x-auto hidden md:block border rounded shadow">
        <span>
          <h2>Rows : {filtered.length}</h2>
        </span>
        <table className="min-w-full table-auto text-sm text-gray-800 divide-y divide-gray-200">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="px-4 py-2">Quotation ID</th>
              <th className="px-4 py-2">Client Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Created By</th>
              <th className="px-4 py-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className="text-center py-4 text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : filtered.length > 0 ? (
              filtered.map((q) => (
                <tr key={q.quote_number} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">{q.quote_number}</td>
                  <td className="px-4 py-2">{q.company_name}</td>
                  <td className="px-4 py-2">{q.email || "-"}</td>
                  <td className="px-4 py-2">{q.phone || "-"}</td>
                  <td className="px-4 py-2">
                    {new Date(q.quote_date).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-2">₹{q.grand_total}</td>
                  <td className="px-4 py-2">{q.emp_name}</td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex flex-wrap gap-1 justify-center items-center">
                      <button
                        type="button"
                        onClick={() => setModalQuote(q.quote_number)}
                        className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 inline-block"
                      >
                        View
                      </button>
                      <Link
                        href={`/admin-dashboard/quotations/${encodeURIComponent(q.quote_number)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm border border-gray-400 text-gray-700 px-2 py-1 rounded hover:bg-gray-50 inline-block"
                      >
                        Full page
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="8"
                  className="text-center text-gray-500 py-6 italic"
                >
                  No quotations found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Cards - Visible on small screens */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {loading ? (
          <div className="text-center py-4 text-gray-500">Loading...</div>
        ) : filtered.length > 0 ? (
          filtered.map((q) => (
            <div
              key={q.quote_number}
              className="bg-white p-4 rounded-lg shadow-md border border-gray-200"
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-lg text-gray-900">
                  Quotation ID: {q.quote_number}
                </h3>
                <span className="text-sm text-gray-500">
                  {new Date(q.quote_date).toLocaleDateString("en-IN")}
                </span>
              </div>
              <p className="text-gray-700">
                <strong className="font-medium">Client Name:</strong>{" "}
                {q.company_name}
              </p>
              <p className="text-gray-700">
                <strong className="font-medium">Email:</strong> {q.email || "-"}
              </p>
              <p className="text-gray-700">
                <strong className="font-medium">Phone:</strong> {q.phone || "-"}
              </p>
              <p className="text-gray-700">
                <strong className="font-medium">Total:</strong> ₹{q.grand_total}
              </p>
              <p className="text-gray-700 mb-4">
                <strong className="font-medium">Created By:</strong>{" "}
                {q.emp_name}
              </p>
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setModalQuote(q.quote_number)}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm"
                >
                  View
                </button>
                <Link
                  href={`/admin-dashboard/quotations/${encodeURIComponent(q.quote_number)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border border-gray-400 text-gray-700 px-4 py-2 rounded hover:bg-gray-50 text-sm text-center"
                >
                  Full page
                </Link>
              </div>
            </div>
          ))
        ) : (
          <div className="p-4 text-center text-gray-500">
            No quotations found.
          </div>
        )}
      </div>
    </div>
  );
}
