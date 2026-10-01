"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

const downloadFile = (filename) => {
  const link = document.createElement("a");
  link.href = `/api/serve-attachment?path=attachments/${filename}`;
  link.download = filename || "download";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Icon SVG Components
const DownloadIcon = ({ available }) => (
  <svg
    className={`w-6 h-6 ${available ? "text-blue-600 hover:text-blue-800 cursor-pointer" : "text-gray-300 opacity-50"}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const PrintIcon = ({ available }) => (
  <svg
    className={`w-6 h-6 ${available ? "text-orange-600 hover:text-orange-800 cursor-pointer" : "text-gray-300 opacity-50"}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm0 0H9m0 0V9m0 8v2" />
  </svg>
);

const EditIcon = ({ available }) => (
  <svg
    className={`w-6 h-6 ${available ? "text-blue-700 hover:text-blue-900 cursor-pointer" : "text-gray-300 opacity-50"}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const FileIcon = ({ available }) => (
  <svg
    className={`w-6 h-6 ${available ? "text-green-600 hover:text-green-800 cursor-pointer" : "text-gray-300 opacity-50"}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const CostIcon = ({ available }) => (
  <svg
    className={`w-6 h-6 ${available ? "text-red-600 hover:text-red-800 cursor-pointer" : "text-gray-300 opacity-50"}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

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
                    <td className="p-2 border border-gray-300">
                      <div className="flex gap-3 flex-wrap items-center justify-center">
                        {/* Update Icon */}
                        {row.status !== "COMPLETED" ? (
                          <a
                            href={`/update_service?service_id=${row.service_id}`}
                            title="Update Service"
                          >
                            <EditIcon available={true} />
                          </a>
                        ) : (
                          <div title="Service Completed - Cannot Update">
                            <EditIcon available={false} />
                          </div>
                        )}

                        {/* View Report Icon */}
                        <a
                          href={`/admin-dashboard/warranty/completion_report/${row.service_id}`}
                          title="View Report"
                        >
                          <FileIcon available={true} />
                        </a>

                        {/* Download File Icon */}
                        {row.attachments ? (
                          <div
                            onClick={() => downloadFile(row.attachments.split(",")[0].trim())}
                            title="Download File"
                            className="cursor-pointer"
                          >
                            <DownloadIcon available={true} />
                          </div>
                        ) : (
                          <div title="No File Attached">
                            <DownloadIcon available={false} />
                          </div>
                        )}

                        {/* Print Report Icon */}
                        {row.status === "COMPLETED" ? (
                          <div
                            onClick={() => {
                              window.open(
                                `/admin-dashboard/warranty/completion_report/${row.service_id}`,
                                "_blank"
                              );
                              setTimeout(() => window.print(), 500);
                            }}
                            title="Print Report"
                            className="cursor-pointer"
                          >
                            <PrintIcon available={true} />
                          </div>
                        ) : (
                          <div title="Service Not Completed">
                            <PrintIcon available={false} />
                          </div>
                        )}

                        {/* Update Cost Icon */}
                        {row.status === "COMPLETED" && Number(row.company_cost) === 0 ? (
                          <a
                            href={`/service_cost_update?service_id=${row.service_id}`}
                            title="Update Cost"
                          >
                            <CostIcon available={true} />
                          </a>
                        ) : (
                          <div title="Cost Already Updated">
                            <CostIcon available={false} />
                          </div>
                        )}
                      </div>
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
