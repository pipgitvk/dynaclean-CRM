"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Check, Loader2, X } from "lucide-react";
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

function wallTimeToInput(value) {
  if (!value) return "";
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return "";
  return `${String(m[1]).padStart(2, "0")}:${m[2]}`;
}

export default function AttendanceAutoCheckoutApprovalsCard({
  fromDate,
  toDate,
  username,
  statusFilter = "pending",
  onApproved,
  onQueueCountChange,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingKey, setActingKey] = useState(null);
  const [approveModal, setApproveModal] = useState(null);
  const [approveCheckoutTime, setApproveCheckoutTime] = useState("");
  const [approveRemark, setApproveRemark] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ status: statusFilter });
      if (fromDate) qs.set("from", fromDate);
      if (toDate) qs.set("to", toDate);
      if (username) qs.set("username", username);
      const res = await fetch(
        `/api/empcrm/attendance/auto-checkout-approvals?${qs.toString()}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load approvals");
      const next = data.items || [];
      setItems(next);
      onQueueCountChange?.(
        statusFilter === "pending" ? next.length : null,
      );
    } catch (e) {
      toast.error(e.message || "Could not load automatic check-out queue");
      setItems([]);
      onQueueCountChange?.(null);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, username, statusFilter, onQueueCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  const openApproveModal = (item) => {
    const dateKey = attendanceDateYmd(item.date);
    const defaultTime =
      wallTimeToInput(item.current_checkout_time) ||
      wallTimeToInput(item.suggested_checkout_time) ||
      "21:00";
    setApproveModal({ item, dateKey });
    setApproveCheckoutTime(defaultTime);
    setApproveRemark("");
  };

  const closeApproveModal = () => {
    if (actingKey) return;
    setApproveModal(null);
    setApproveCheckoutTime("");
    setApproveRemark("");
  };

  const runAction = async (item, action, extra = {}) => {
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
          checkoutTime: extra.checkoutTime,
          note: extra.note,
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
      closeApproveModal();
      await load();
    } catch (e) {
      toast.error(e.message || "Could not update approval");
    } finally {
      setActingKey(null);
    }
  };

  const submitApprove = () => {
    if (!approveModal?.item) return;
    if (!approveCheckoutTime.trim()) {
      toast.error("Check-out time is required.");
      return;
    }
    runAction(approveModal.item, "approve", {
      checkoutTime: approveCheckoutTime.trim(),
      note: approveRemark.trim() || undefined,
    });
  };

  return (
    <div id="auto-checkout-approvals" className="scroll-mt-4">
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading queue…
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-600">
          {statusFilter === "pending"
            ? fromDate || toDate || username
              ? "No automatic check-outs waiting for approval for these filters."
              : "No automatic check-outs waiting for approval."
            : fromDate || toDate || username
              ? "No rejected automatic check-outs for these filters."
              : "No rejected automatic check-outs."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Date</th>
                <th className="px-3 py-2.5 font-semibold">Employee</th>
                <th className="px-3 py-2.5 font-semibold">Emp ID</th>
                <th className="px-3 py-2.5 font-semibold">Check-in</th>
                <th className="px-3 py-2.5 font-semibold">Auto check-out</th>
                <th className="px-3 py-2.5 font-semibold">Leave</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                {statusFilter === "rejected" ? (
                  <th className="px-3 py-2.5 font-semibold">Remark</th>
                ) : null}
                {statusFilter === "pending" ? (
                  <th className="px-3 py-2.5 font-semibold text-right">Action</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
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
                    <td className="px-3 py-2.5 font-medium text-red-700">
                      {formatTime(item.checkout_time) || "—"}
                      {item.suggested_checkout_time &&
                      wallTimeToInput(item.suggested_checkout_time) !==
                        wallTimeToInput(item.current_checkout_time) ? (
                        <div className="mt-0.5 text-[10px] font-normal text-amber-700">
                          Suggested: {formatTime(item.suggested_checkout_time)}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {item.has_active_leave ? (
                        <span className="inline-flex rounded-full bg-orange-100 px-2 py-0.5 font-medium capitalize text-orange-800">
                          {item.leave_status || "leave"}
                          {item.leave_type ? ` · ${item.leave_type}` : ""}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
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
                    {statusFilter === "rejected" ? (
                      <td
                        className="max-w-[200px] truncate px-3 py-2.5 text-xs text-gray-600"
                        title={item.note || ""}
                      >
                        {item.note || "—"}
                      </td>
                    ) : null}
                    {statusFilter === "pending" ? (
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => openApproveModal(item)}
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

      {approveModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => e.target === e.currentTarget && closeApproveModal()}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900">
              Approve automatic check-out
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              <strong>{approveModal.item.username}</strong> · {approveModal.dateKey}
            </p>
            <label className="mt-4 block text-sm font-medium text-gray-700">
              Check-out time (IST)
              <input
                type="time"
                value={approveCheckoutTime}
                onChange={(e) => setApproveCheckoutTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="mt-3 block text-sm font-medium text-gray-700">
              Remark
              <textarea
                value={approveRemark}
                onChange={(e) => setApproveRemark(e.target.value)}
                rows={3}
                placeholder="Optional approval remark…"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeApproveModal}
                disabled={Boolean(actingKey)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitApprove}
                disabled={Boolean(actingKey)}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
              >
                {actingKey ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Save &amp; approve
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
