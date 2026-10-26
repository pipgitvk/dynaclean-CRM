// app/daily-followups/page.js
"use client";

import { useEffect, useState } from "react";

export default function DailyFollowUpsPage() {
  const [leadSources, setLeadSources] = useState([]);
  const [filters, setFilters] = useState({
    lead_source: "",
    date_from: new Date().toISOString().split("T")[0], // Default to today's date
    date_to: "",
    communication_mode: "",
  });

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch lead sources from the database on page load (for the dropdown)
  useEffect(() => {
    const fetchLeadSources = async () => {
      const res = await fetch("/api/lead-sources"); // API to fetch lead sources
      const json = await res.json();
      setLeadSources(json);
    };
    fetchLeadSources();
  }, []);

  // Function to fetch filtered data from the API
  const fetchData = async () => {
    setLoading(true);
    const query = new URLSearchParams(filters).toString();
    const res = await fetch(`/api/daily-followups?${query}`);
    const json = await res.json();
    setData(json.records);
    setLoading(false);
  };

  // Handle form change
  const handleChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Reset filters to default values
  const resetFilters = () => {
    setFilters({
      lead_source: "",
      date_from: new Date().toISOString().split("T")[0],
      date_to: "",
      communication_mode: "",
    });
  };

  // Format date into readable format (e.g., 'MM/DD/YYYY')
  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  // Fetch data on component mount and when filters change
  useEffect(() => {
    fetchData();
  }, [filters]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-center text-2xl font-semibold mb-6">
        Daily Follow-Ups Report
      </h2>

      {/* Filters Form */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <label
            htmlFor="lead_source"
            className="block text-sm font-medium text-gray-700"
          >
            Lead Source
          </label>
          <select
            id="lead_source"
            value={filters.lead_source}
            onChange={(e) => handleChange("lead_source", e.target.value)}
            className="border rounded p-2 mt-1 block w-full"
          >
            <option value="">Select Lead Source</option>
            {leadSources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="date_from"
            className="block text-sm font-medium text-gray-700"
          >
            Followed Date
          </label>
          <input
            type="date"
            id="date_from"
            value={filters.date_from}
            onChange={(e) => handleChange("date_from", e.target.value)}
            className="border rounded p-2 mt-1 block w-full"
          />
        </div>

        <div>
          <label
            htmlFor="date_to"
            className="block text-sm font-medium text-gray-700"
          >
            Next Follow-up Date
          </label>
          <input
            type="date"
            id="date_to"
            value={filters.date_to}
            onChange={(e) => handleChange("date_to", e.target.value)}
            className="border rounded p-2 mt-1 block w-full"
          />
        </div>

        <div>
          <label
            htmlFor="communication_mode"
            className="block text-sm font-medium text-gray-700"
          >
            Communication Mode
          </label>
          <select
            id="communication_mode"
            value={filters.communication_mode}
            onChange={(e) => handleChange("communication_mode", e.target.value)}
            className="border rounded p-2 mt-1 block w-full"
          >
            <option value="">Select</option>
            <option value="Call">Call</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="Visit">Visit</option>
            <option value="Email">Email</option>
          </select>
        </div>

        <div className="flex gap-4 items-end">
          <button
            onClick={fetchData}
            className="bg-blue-600 text-white px-4 py-2 rounded h-fit"
          >
            Filter
          </button>
          <button
            onClick={resetFilters}
            className="bg-gray-300 text-black px-4 py-2 rounded h-fit"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Data Table (Responsive) */}
      <h4>Total Records: {loading ? "Loading..." : data.length}</h4>
      <div className="flex justify-center">
        {" "}
        {/* Centering container */}
        <div className="w-full md:w-[900px] lg:w-[1200px] h-[500px] border border-gray-200 rounded-md overflow-auto shadow-md">
          {" "}
          {/* Fixed size container with scroll */}
          {loading ? (
            <div className="text-center py-4">Loading data...</div>
          ) : data.length === 0 ? (
            <div className="text-center py-4">No records found.</div>
          ) : (
            <>
              {/* Table for md and lg screens */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full bg-white text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left">C. ID</th>
                      <th className="px-4 py-2 text-left">Customer Name</th>
                      <th className="px-4 py-2 text-left">Company Name</th>
                      <th className="px-4 py-2 text-left">
                        Conversation on Selected Date
                      </th>
                      <th className="px-4 py-2 text-left">
                        Latest Ongoing Conversation
                      </th>
                      <th className="px-4 py-2 text-left">Followed Date</th>
                      <th className="px-4 py-2 text-left">
                        Next Follow-up Date
                      </th>
                      <th className="px-4 py-2 text-left">Comm. Mode</th>
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row) => (
                      <tr
                        key={row.customer_id}
                        className="border-t border-gray-200"
                      >
                        <td className="px-4 py-2">{row.customer_id}</td>
                        <td className="px-4 py-2">{row.name}</td>
                        <td className="px-4 py-2">{row.company}</td>
                        <td className="px-4 py-2">{row.selected_date_notes}</td>
                        <td className="px-4 py-2">
                          {row.max_current_date_notes}
                        </td>
                        <td className="px-4 py-2">
                          {formatDate(row.followed_date)}
                        </td>
                        <td className="px-4 py-2">
                          {formatDate(row.next_followup_date)}
                        </td>
                        <td className="px-4 py-2">{row.comm_mode}</td>
                        <td className="px-4 py-2">
                          <a
                            href={`/admin-dashboard/view-customer/${row.customer_id}`}
                            className="text-blue-600 hover:underline"
                          >
                            View
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Card layout for small screens */}
              <div className="md:hidden p-2">
                {data.map((row) => (
                  <div
                    key={row.customer_id}
                    className="bg-white shadow-md rounded-lg p-4 mb-4 border border-gray-200"
                  >
                    <div className="mb-2">
                      <span className="font-semibold">C. ID:</span>{" "}
                      {row.customer_id}
                    </div>
                    <div className="mb-2">
                      <span className="font-semibold">Customer Name:</span>{" "}
                      {row.name}
                    </div>
                    <div className="mb-2">
                      <span className="font-semibold">Company Name:</span>{" "}
                      {row.company}
                    </div>
                    <div className="mb-2">
                      <span className="font-semibold">
                        Conversation on Selected Date:
                      </span>{" "}
                      {row.selected_date_notes}
                    </div>
                    <div className="mb-2">
                      <span className="font-semibold">
                        Latest Ongoing Conversation:
                      </span>{" "}
                      {row.max_current_date_notes}
                    </div>
                    <div className="mb-2">
                      <span className="font-semibold">Followed Date:</span>{" "}
                      {formatDate(row.followed_date)}
                    </div>
                    <div className="mb-2">
                      <span className="font-semibold">
                        Next Follow-up Date:
                      </span>{" "}
                      {formatDate(row.next_followup_date)}
                    </div>
                    <div className="mb-2">
                      <span className="font-semibold">Comm. Mode:</span>{" "}
                      {row.comm_mode}
                    </div>
                    <div>
                      <a
                        href={`/admin-dashboard/view-customer/${row.customer_id}`}
                        className="text-blue-600 hover:underline font-semibold"
                      >
                        View Details
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
