"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

export default function ServiceRecordsPage() {
  const { serial_number } = useParams(); // ✅ from dynamic route
  const [records, setRecords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!serial_number) return; // Wait for params to be ready

    setLoading(true);
    fetch(
      `/api/service-records?serial_number=${encodeURIComponent(serial_number)}`,
    )
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch records");
        return res.json();
      })
      .then((data) => {
        if (!data.records || data.records.length === 0) {
          setError(
            `No service records found for serial number ${serial_number}.`,
          );
        } else {
          setRecords(data.records);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [serial_number]);

  if (loading) return <p className="text-center mt-10">Loading...</p>;
  if (error) return <p className="text-center mt-10 text-red-600">{error}</p>;

  return (
    <div className="max-w-full p-4 bg-gray-100 min-h-screen">
      <h2 className="text-3xl font-bold mb-6 text-center text-gray-800">
        View Service Records
      </h2>

      {records && (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <thead className="bg-gray-200">
              <tr>
                <th className="p-2 border border-gray-300">Reg. Date</th>
                <th className="p-2 border border-gray-300">Serial Number</th>
                <th className="p-2 border border-gray-300">Service Type</th>
                <th className="p-2 border border-gray-300">Complaint Date</th>
                <th className="p-2 border border-gray-300">
                  Complaint Summary
                </th>
                <th className="p-2 border border-gray-300">Service ID</th>
                <th className="p-2 border border-gray-300">Observation</th>
                <th className="p-2 border border-gray-300">Action Taken</th>
                <th className="p-2 border border-gray-300">Parts Replaced</th>
                <th className="p-2 border border-gray-300">
                  Service Description
                </th>
                <th className="p-2 border border-gray-300">Status</th>
                <th className="p-2 border border-gray-300">Completed Date</th>
                <th className="p-2 border border-gray-300">Company Cost</th>
                <th className="p-2 border border-gray-300">Attachments</th>
                <th className="p-2 border border-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((row, i) => {
                const bgColorClass =
                  row.status === "PENDING FOR SPARES"
                    ? "bg-orange-300"
                    : i % 2 === 1
                      ? "bg-gray-100"
                      : "bg-white";

                const attachments = row.attachments?.split(",") || [];

                return (
                  <tr key={row.service_id} className={bgColorClass}>
                    <td className="p-2 border border-gray-300">
                      {row.reg_date}
                    </td>
                    <td className="p-2 border border-gray-300">
                      {row.serial_number}
                    </td>
                    <td className="p-2 border border-gray-300">
                      {row.service_type}
                    </td>
                    <td className="p-2 border border-gray-300">
                      {row.complaint_date}
                    </td>
                    <td className="p-2 border border-gray-300">
                      {row.complaint_summary}
                    </td>
                    <td className="p-2 border border-gray-300">
                      {row.service_id}
                    </td>
                    <td className="p-2 border border-gray-300">
                      {row.observation}
                    </td>
                    <td className="p-2 border border-gray-300">
                      {row.action_taken}
                    </td>
                    <td className="p-2 border border-gray-300">
                      {row.parts_replaced}
                    </td>
                    <td className="p-2 border border-gray-300">
                      {row.service_description}
                    </td>
                    <td className="p-2 border border-gray-300">{row.status}</td>
                    <td className="p-2 border border-gray-300">
                      {row.completed_date}
                    </td>
                    <td className="p-2 border border-gray-300">
                      {row.company_cost}
                    </td>
                    <td className="p-2 border border-gray-300 space-y-1">
                      {attachments.map((att, idx) => (
                        <a
                          key={idx}
                          href={`/attachments/${att}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline block"
                        >
                          doc{idx + 1}
                        </a>
                      ))}
                    </td>
                    <td className="p-2 border border-gray-300 space-y-1">
                      {row.status !== "COMPLETED" && (
                        <a
                          href={`/update_service?service_id=${row.service_id}`}
                          className="text-blue-700 hover:underline block"
                        >
                          Update
                        </a>
                      )}
                      <a
                        href={`/admin-dashboard/warranty/completion_report/${row.service_id}`}
                        className="text-green-700 hover:underline block"
                      >
                        View Report
                      </a>
                      {row.status === "COMPLETED" &&
                        Number(row.company_cost) === 0 && (
                          <a
                            href={`/service_cost_update?service_id=${row.service_id}`}
                            className="text-red-700 hover:underline block"
                          >
                            Update Cost
                          </a>
                        )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
