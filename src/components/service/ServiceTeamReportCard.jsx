"use client";

import { useState } from "react";
import { ArrowRight, Wrench, X } from "lucide-react";
import dayjs from "dayjs";

const formatDT = (val) =>
  val ? dayjs(val).format("DD MMM YYYY, hh:mm A") : "—";

export default function ServiceTeamReportCard({ rows = [] }) {
  const [popup, setPopup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);

  const openPopup = async (employee, type) => {
    setPopup({ employee, type });
    setLoading(true);
    setRecords([]);
    try {
      const today = dayjs();
      const params = new URLSearchParams({
        employee,
        startDate: today.startOf("day").toISOString(),
        endDate: today.endOf("day").toISOString(),
      });
      const res = await fetch(`/api/service-support-report?${params}`);
      const data = await res.json();
      const list =
        type === "machine"
          ? data.machineFollowups || []
          : data.customerFollowups || [];
      setRecords(list);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-3 text-black h-full border-l-4 border-teal-500 min-h-[140px] flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-teal-500 shrink-0" />
            <h2 className="text-sm font-bold text-black leading-tight">
              Service Team Report
            </h2>
          </div>
          <span className="text-[11px] text-gray-500">Today</span>
        </div>
        <div className="max-h-[180px] overflow-y-auto flex-1">
          <table className="w-full text-[11px] text-left border-collapse table-fixed">
            <thead>
              <tr className="text-gray-500">
                <th className="py-0.5 pr-1 font-semibold w-[50%]">name</th>
                <th className="py-0.5 px-1 font-semibold text-right w-[25%]">MF</th>
                <th className="py-0.5 pl-1 font-semibold text-right w-[25%]">CF</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-2 text-gray-400">No Service Support employees</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.username} className="border-t border-gray-100">
                    <td className="py-0.5 pr-1 text-gray-800 font-medium truncate">{row.username}</td>
                    <td className="py-0.5 px-1 text-right tabular-nums">
                      {row.machine > 0 ? (
                        <button
                          type="button"
                          onClick={() => openPopup(row.username, "machine")}
                          className="font-bold text-teal-700 hover:underline cursor-pointer"
                        >
                          {row.machine}
                        </button>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="py-0.5 pl-1 text-right tabular-nums">
                      {row.customer > 0 ? (
                        <button
                          type="button"
                          onClick={() => openPopup(row.username, "customer")}
                          className="font-bold text-teal-700 hover:underline cursor-pointer"
                        >
                          {row.customer}
                        </button>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end mt-2">
          <a
            href="/admin-dashboard/service-support-report"
            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-teal-50 text-teal-600 hover:bg-teal-100 hover:text-teal-800 transition-colors"
            aria-label="Open service team report"
          >
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>

      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  {popup.employee}
                </h3>
                <p className="text-xs text-gray-500">
                  Today · {popup.type === "machine" ? "Machine follow-ups" : "Customer follow-ups"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPopup(null)}
                className="p-1 rounded-full hover:bg-gray-100"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="overflow-auto flex-1 p-4">
              {loading ? (
                <p className="text-sm text-gray-500">Loading...</p>
              ) : records.length === 0 ? (
                <p className="text-sm text-gray-400">No records found.</p>
              ) : popup.type === "machine" ? (
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Machine ID</th>
                      <th className="px-3 py-2 text-left">Service ID</th>
                      <th className="px-3 py-2 text-left">Serial</th>
                      <th className="px-3 py-2 text-left">Model</th>
                      <th className="px-3 py-2 text-left">Followed At</th>
                      <th className="px-3 py-2 text-left">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {records.map((row, i) => (
                      <tr key={row.id ?? i}>
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2">{row.machine_id || "—"}</td>
                        <td className="px-3 py-2">{row.service_id || "—"}</td>
                        <td className="px-3 py-2 font-medium">{row.serial_number || "—"}</td>
                        <td className="px-3 py-2">{row.product_model || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDT(row.followed_at)}</td>
                        <td className="px-3 py-2 max-w-xs break-words">{row.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Customer</th>
                      <th className="px-3 py-2 text-left">Phone</th>
                      <th className="px-3 py-2 text-left">Followed Date</th>
                      <th className="px-3 py-2 text-left">Mode</th>
                      <th className="px-3 py-2 text-left">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {records.map((row, i) => (
                      <tr key={row.s_no ?? i}>
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2">{row.customer_name || "—"}</td>
                        <td className="px-3 py-2">{row.customer_phone || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDT(row.followed_date)}</td>
                        <td className="px-3 py-2">{row.comm_mode || "—"}</td>
                        <td className="px-3 py-2 max-w-xs break-words">{row.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
