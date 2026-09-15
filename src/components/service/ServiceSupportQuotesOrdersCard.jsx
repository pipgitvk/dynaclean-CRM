"use client";

import { useState } from "react";
import { ArrowRight, FileText, X } from "lucide-react";
import dayjs from "dayjs";

const formatDT = (val) =>
  val ? dayjs(val).format("DD MMM YYYY, hh:mm A") : "—";

const formatAmt = (val) => {
  if (val == null || val === "") return "—";
  const n = Number(val);
  return Number.isFinite(n) ? n.toLocaleString("en-IN") : String(val);
};

export default function ServiceSupportQuotesOrdersCard({ rows = [] }) {
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
      const res = await fetch(`/api/service-support-quotes-orders?${params}`);
      const data = await res.json();
      const list =
        type === "quote" ? data.quotations || [] : data.orders || [];
      setRecords(list);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-3 text-black h-full border-l-4 border-amber-500 min-h-[140px] flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-500 shrink-0" />
            <h2 className="text-sm font-bold text-black leading-tight">
              SS Quotes & Orders
            </h2>
          </div>
          <span className="text-[11px] text-gray-500">Today</span>
        </div>
        <div className="max-h-[180px] overflow-y-auto flex-1">
          <table className="w-full text-[11px] text-left border-collapse table-fixed">
            <thead>
              <tr className="text-gray-500">
                <th className="py-0.5 pr-1 font-semibold w-[50%]">name</th>
                <th className="py-0.5 px-1 font-semibold text-right w-[25%]">QT</th>
                <th className="py-0.5 pl-1 font-semibold text-right w-[25%]">OP</th>
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
                      {row.quotes > 0 ? (
                        <button
                          type="button"
                          onClick={() => openPopup(row.username, "quote")}
                          className="font-bold text-amber-700 hover:underline cursor-pointer"
                        >
                          {row.quotes}
                        </button>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="py-0.5 pl-1 text-right tabular-nums">
                      {row.orders > 0 ? (
                        <button
                          type="button"
                          onClick={() => openPopup(row.username, "order")}
                          className="font-bold text-amber-700 hover:underline cursor-pointer"
                        >
                          {row.orders}
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
        <div className="flex justify-end items-center gap-2 mt-2">
          <a
            href="/admin-dashboard/quotations?ss=1"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-900 transition-colors text-[10px] font-semibold"
            aria-label="Open quotations"
          >
            QT
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
          <a
            href="/admin-dashboard/order?ss=1"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-900 transition-colors text-[10px] font-semibold"
            aria-label="Open orders"
          >
            OP
            <ArrowRight className="w-3.5 h-3.5" />
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
                  Today · {popup.type === "quote" ? "Quotations" : "Order process"}
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
              ) : popup.type === "quote" ? (
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Quote #</th>
                      <th className="px-3 py-2 text-left">Customer ID</th>
                      <th className="px-3 py-2 text-left">Company</th>
                      <th className="px-3 py-2 text-left">Created</th>
                      <th className="px-3 py-2 text-right">Grand Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {records.map((row, i) => (
                      <tr key={row.quote_number ?? i}>
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">{row.quote_number || "—"}</td>
                        <td className="px-3 py-2">{row.customer_id || "—"}</td>
                        <td className="px-3 py-2">{row.company_name || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDT(row.created_at || row.quote_date)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatAmt(row.grand_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Order ID</th>
                      <th className="px-3 py-2 text-left">Quote #</th>
                      <th className="px-3 py-2 text-left">Client</th>
                      <th className="px-3 py-2 text-left">Contact</th>
                      <th className="px-3 py-2 text-left">Created</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {records.map((row, i) => (
                      <tr key={row.order_id ?? i}>
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">{row.order_id || "—"}</td>
                        <td className="px-3 py-2">{row.quote_number || "—"}</td>
                        <td className="px-3 py-2">{row.client_name || "—"}</td>
                        <td className="px-3 py-2">{row.contact || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDT(row.created_at)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatAmt(row.totalamt)}</td>
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
