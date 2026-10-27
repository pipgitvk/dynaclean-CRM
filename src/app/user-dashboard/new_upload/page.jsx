"use client";

import { useState, useEffect } from "react";
import ManualLeadModal from "@/components/models/ManualLeadModal";
// Inline table for assigned customers (no external table component)

export default function LeadDistributionPage() {
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [fromDate, setFromDate] = useState(""); // YYYY-MM-DD
  const [toDate, setToDate] = useState("");   // YYYY-MM-DD
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const params = new URLSearchParams();
        if (fromDate) params.set("from", fromDate);
        if (toDate) params.set("to", toDate);
        const qs = params.toString();
        const url = qs ? `/api/assigned-customers?${qs}` : "/api/assigned-customers";
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        if (isMounted) setCustomers(data.data || []);
      } catch (e) {
        if (isMounted) setCustomers([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [fromDate, toDate]);

  return (
    <>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold text-gray-700 text-center">
          Lead Distribution
        </h1>

        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded shadow"
        >
          Manually Assign Leads
        </button>

        <ManualLeadModal show={showModal} onClose={() => setShowModal(false)} />
      </div>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold text-gray-700 text-center">My Assigned Leads</h1>
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
          <div className="flex flex-col">
            <label className="text-xs text-gray-600 mb-1">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-600 mb-1">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2"
            />
          </div>
          {/* <button
            onClick={() => {
              // Trigger useEffect by just toggling state (already bound to from/to)
              setIsLoading(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded shadow"
          >
            Apply
          </button> */}
          {(fromDate || toDate) && (
            <button
              onClick={() => { setFromDate(""); setToDate(""); setIsLoading(true); }}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded shadow"
            >
              Clear
            </button>
          )}
        </div>
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-10 bg-gray-200 rounded w-1/3 mx-auto"></div>
            <div className="h-40 bg-gray-100 rounded animate-pulse"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto text-sm bg-white rounded-lg overflow-hidden shadow-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-3 font-semibold text-center">S.No</th>
                  <th className="px-3 py-3 font-semibold text-left">Date</th>
                  <th className="px-3 py-3 font-semibold text-left">Campaign</th>
                  <th className="px-3 py-3 font-semibold text-left">Name</th>
                  <th className="px-3 py-3 font-semibold text-left">Company</th>
                  <th className="px-3 py-3 font-semibold text-left">Status</th>
                  <th className="px-3 py-3 font-semibold text-left">Assigned To</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {customers.length > 0 ? (
                  customers.map((c, i) => (
                    <tr key={c.customer_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-3 text-center">{i + 1}</td>
                      <td className="px-3 py-3">{new Date(c.date_created).toLocaleDateString()}</td>
                      <td className="px-3 py-3">{c.lead_campaign}</td>
                      <td className="px-3 py-3">{c.first_name}</td>
                      <td className="px-3 py-3 whitespace-normal break-words max-w-[240px]">{c.company}</td>
                      <td className="px-3 py-3">{c.status}</td>
                      <td className="px-3 py-3">{c.sales_representative}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-6 py-6 text-center text-gray-500">No leads assigned.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
