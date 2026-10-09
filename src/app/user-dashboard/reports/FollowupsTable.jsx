"use client";

import { useEffect, useState } from "react";
import dayjs from "dayjs";

export default function FollowupsClient({ leadSource }) {
  const [from, setFrom] = useState(dayjs().format("YYYY-MM-DD"));
  const [to, setTo] = useState("");
  const [commMode, setCommMode] = useState("");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const res = await fetch("/api/followups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, commMode, leadSource }),
    });
    const result = await res.json();
    setData(result);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    fetchData();
  };

  const reset = () => {
    setFrom(dayjs().format("YYYY-MM-DD"));
    setTo("");
    setCommMode("");
    fetchData();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <h1 className="text-2xl font-semibold">Daily Follow-Ups Report</h1>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
      >
        <div>
          <label className="text-sm block mb-1 text-gray-700">
            Lead Source
          </label>
          <input
            type="text"
            readOnly
            value={leadSource || "-"}
            className="w-full px-3 py-2 border rounded-md bg-gray-100 text-sm"
          />
        </div>

        <div>
          <label className="text-sm block mb-1 text-gray-700">
            Followed Date
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
        </div>

        <div>
          <label className="text-sm block mb-1 text-gray-700">
            Next Follow-up Date
          </label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
        </div>

        <div>
          <label className="text-sm block mb-1 text-gray-700">
            Communication Mode
          </label>
          <select
            value={commMode}
            onChange={(e) => setCommMode(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm"
          >
            <option value="">All</option>
            <option value="Call">Call</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="Visit">Visit</option>
            <option value="Email">Email</option>
          </select>
        </div>

        <div className="flex gap-2 col-span-full sm:col-span-2 lg:col-span-1">
          <button className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm w-full">
            Filter
          </button>
          <button
            type="button"
            onClick={reset}
            className="bg-gray-300 px-4 py-2 rounded-md text-sm w-full"
          >
            Reset
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-center text-gray-500">Loading...</p>
      ) : data.length > 0 ? (
        <>
          {/* Table for large screens */}
          <div className="hidden lg:block overflow-x-auto rounded-lg shadow border border-gray-200">
            <table className="min-w-full table-auto text-sm text-center">
              <thead className="bg-gray-800 text-white uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap">C. ID</th>
                  <th className="px-4 py-3 whitespace-nowrap">Customer</th>
                  <th className="px-4 py-3 whitespace-nowrap">Company</th>
                  <th className="px-4 py-3 whitespace-nowrap">On-Date Notes</th>
                  <th className="px-4 py-3 whitespace-nowrap">Latest Notes</th>
                  <th className="px-4 py-3 whitespace-nowrap">Followed</th>
                  <th className="px-4 py-3 whitespace-nowrap">
                    Next Follow-up
                  </th>
                  <th className="px-4 py-3 whitespace-nowrap">Mode</th>
                  <th className="px-4 py-3 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {data.map((r) => (
                  <tr
                    key={r.customer_id}
                    className="hover:bg-gray-50 transition duration-150"
                  >
                    <td className="px-4 py-3 font-medium text-gray-700">
                      {r.customer_id}
                    </td>
                    <td className="px-4 py-3 text-gray-800">{r.name}</td>
                    <td className="px-4 py-3 text-gray-700">{r.company}</td>
                    <td className="px-4 py-3 text-gray-700 text-left max-w-xs">
                      {r.selected_date_notes || (
                        <span className="italic text-gray-400">No notes</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-left max-w-xs">
                      {r.max_current_date_notes || (
                        <span className="italic text-gray-400">No notes</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {dayjs(r.followed_date).format("DD-MMM-YYYY")}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {dayjs(r.next_followup_date).format("DD-MMM-YYYY")}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{r.comm_mode}</td>
                    <td className="px-4 py-3">
                      <a
                        href={`/user-dashboard/view-customer/${r.customer_id}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                      >
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards for small screens */}
          <div className="lg:hidden space-y-4">
            {data.map((r) => (
              <div
                key={r.customer_id}
                className="border rounded-lg shadow px-4 py-3 bg-white space-y-2"
              >
                <div className="text-sm font-medium text-gray-800">
                  #{r.customer_id} — {r.name}
                </div>
                <div className="text-sm text-gray-600">
                  <strong>Company:</strong> {r.company}
                </div>
                <div className="text-sm text-gray-600">
                  <strong>On-Date Notes:</strong>{" "}
                  {r.selected_date_notes || (
                    <span className="italic text-gray-400">No notes</span>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  <strong>Latest Notes:</strong>{" "}
                  {r.max_current_date_notes || (
                    <span className="italic text-gray-400">No notes</span>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  <strong>Followed:</strong>{" "}
                  {dayjs(r.followed_date).format("DD-MMM-YYYY")}
                </div>
                <div className="text-sm text-gray-600">
                  <strong>Next:</strong>{" "}
                  {dayjs(r.next_followup_date).format("DD-MMM-YYYY")}
                </div>
                <div className="text-sm text-gray-600">
                  <strong>Mode:</strong> {r.comm_mode}
                </div>
                <div>
                  <a
                    href={`/customer/${r.customer_id}`}
                    className="inline-block mt-2 text-blue-600 hover:text-blue-800 hover:underline text-sm font-medium"
                  >
                    View Details
                  </a>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-center text-gray-500 italic">No records found.</p>
      )}
    </div>
  );
}
