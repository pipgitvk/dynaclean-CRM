"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { formatAttendanceTimeForDisplay as formatTime } from "@/lib/istDateTime";

function attendanceDateYmd(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA");
}

export default function AttendanceAutoCheckoutApprovalsCard({
  fromDate,
  toDate,
  onApproved,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [actingKey, setActingKey] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ status: statusFilter });
      if (fromDate) qs.set("from", fromDate);
      if (toDate) qs.set("to", toDate);
      const res = await fetch(
        `/api/empcrm/attendance/auto-checkout-approvals?${qs.toString()}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load approvals");
      setItems(data.items || []);
    } catch (e) {
      toast.error(e.message || "Could not load automatic check-out queue");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (item, action) => {
    const dateKey = attendanceDateYmd(item.date);
    const key = `${item.username}-${dateKey}`;
    setActingKey(key);
    try {
      const res = await fetch("/api/empcrm/attendance/auto-checkout-approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: item.username,
          date: dateKey,
          action,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Action failed");

      if (action === "approve") {
        toast.success(`Approved check-out for ${item.username}`);
        onApproved?.();
      } else {
        toast.success(`Marked as rejected (still automatic in records)`);
      }
      await load();
    } catch (e) {
      toast.error(e.message || "Could not update approval");
    } finally {
      setActingKey(null);
    }
  };

  const pendingCount =
    statusFilter === "pending" ? items.length : null;

  return (
    <div
      id="auto-checkout-approvals"
      className="mb-6 rounded-xl border border-red-200 bg-red-50/60 p-4 sm:p-5 shadow-sm scroll-mt-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100">
            <AlertTriangle className="h-5 w-5 text-red-600" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-red-900">
              Automatic check-out approval
            </h2>
            <p className="mt-0.5 text-sm text-red-800/90">
              Approve to confirm the 9:00 PM system check-out in attendance
              records. Until approved, entries stay{" "}
              <span className="font-semibold">Automatic</span> in the table
              below.
            </p>
          </div>
        </div>
        <div className="flex rounded-lg border border-red-200 bg-white p-0.5 text-sm">
          {[
            { id: "pending", label: "Pending" },
            { id: "rejected", label: "Rejected" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                statusFilter === tab.id
                  ? "bg-red-600 text-white"
                  : "text-red-800 hover:bg-red-50"
              }`}
            >
              {tab.label}
              {tab.id === "pending" && pendingCount != null && !loading ? (
                <span className="ml-1.5 inline-flex min-w-[1.25rem] justify-center rounded-full bg-white/20 px-1.5 text-xs">
                  {pendingCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center justify-center gap-2 py-8 text-sm text-red-900/80">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading queue…
        </div>
      ) : items.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-red-200 bg-white/70 py-6 text-center text-sm text-red-900/70">
          {statusFilter === "pending"
            ? "No automatic check-outs waiting for approval in this date range."
            : "No rejected automatic check-outs in this date range."}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-red-100 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-red-50/80 text-xs uppercase tracking-wide text-red-900/80">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Date</th>
                <th className="px-3 py-2.5 font-semibold">Employee</th>
                <th className="px-3 py-2.5 font-semibold">Emp ID</th>
                <th className="px-3 py-2.5 font-semibold">Check-in</th>
                <th className="px-3 py-2.5 font-semibold">Check-out</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                {statusFilter === "pending" ? (
                  <th className="px-3 py-2.5 font-semibold text-right">Action</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-red-50">
              {items.map((item) => {
                const dateKey = attendanceDateYmd(item.date);
                const rowKey = `${item.username}-${dateKey}`;
                const busy = actingKey === rowKey;
                return (
                  <tr key={rowKey} className="text-gray-800">
                    <td className="whitespace-nowrap px-3 py-2.5">{dateKey}</td>
                    <td className="px-3 py-2.5 font-medium">{item.username}</td>
                    <td className="px-3 py-2.5">{item.employee_id || "—"}</td>
                    <td className="px-3 py-2.5">
                      {formatTime(item.checkin_time) || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-red-700 font-medium">
                      {formatTime(item.checkout_time) || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          item.approval_status === "rejected"
                            ? "bg-gray-100 text-gray-700"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {item.approval_status === "rejected"
                          ? "Rejected"
                          : "Pending"}
                      </span>
                    </td>
                    {statusFilter === "pending" ? (
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => runAction(item, "approve")}
                            className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                          >
                            {busy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => runAction(item, "reject")}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                          >
                            <X className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        </div>
                      </td>
                    ) : null}
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
