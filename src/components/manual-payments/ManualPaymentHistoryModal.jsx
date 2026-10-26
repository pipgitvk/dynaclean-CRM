"use client";

import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Loader2, X } from "lucide-react";

function formatDateTime(value) {
  if (!value) return "-";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("DD MMM, YYYY hh:mm A") : "-";
}

function getFollowedByRowColors(followups) {
  const colors = ["bg-white", "bg-slate-50"];
  let paletteIndex = 0;
  let prevFollowedBy = null;

  return followups.map((row) => {
    const followedBy = String(row.created_by || "Unknown").trim();
    if (prevFollowedBy !== null && followedBy !== prevFollowedBy) {
      paletteIndex = (paletteIndex + 1) % colors.length;
    }
    prevFollowedBy = followedBy;
    return colors[paletteIndex];
  });
}

export default function ManualPaymentHistoryModal({ open, onClose, payment }) {
  const [loading, setLoading] = useState(false);
  const [followups, setFollowups] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !payment?.id) return;
    let cancelled = false;

    async function run() {
      try {
        setError("");
        setLoading(true);
        const res = await fetch(
          `/api/manual-payment-pending/followups?payment_id=${encodeURIComponent(payment.id)}`,
        );
        const data = await res.json();
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || "Failed to fetch history");
        }
        if (cancelled) return;
        setFollowups(data.followups || []);
      } catch (e) {
        if (cancelled) return;
        setError(e?.message || "Failed to fetch history");
        setFollowups([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [open, payment?.id]);

  const rowColors = useMemo(
    () => getFollowedByRowColors(followups),
    [followups],
  );

  if (!open || !payment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-7xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
          <div>
            <div className="text-lg font-bold text-gray-900">Follow-up History</div>
            <div className="text-xs text-gray-600">
              Payment #{payment.id}
              {payment.customer_name ? ` | ${payment.customer_name}` : ""}
              {payment.customer_phone ? ` | ${payment.customer_phone}` : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-700">
              <Loader2 size={18} className="animate-spin" />
              Loading...
            </div>
          ) : error ? (
            <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : followups.length === 0 ? (
            <div className="rounded-md bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
              No followups yet
            </div>
          ) : (
            <div className="overflow-x-auto rounded border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left">Next Follow-up</th>
                    <th className="px-4 py-3 text-left">Followed By</th>
                    <th className="px-4 py-3 text-left">Followed Date</th>
                    <th className="px-4 py-3 text-left">Mode</th>
                    <th className="px-4 py-3 text-left">Remarks</th>
                    <th className="px-4 py-3 text-left">Date &amp; Time</th>
                    <th className="px-4 py-3 text-left">User</th>
                    <th className="px-4 py-3 text-left">Summary</th>
                    <th className="px-4 py-3 text-left">Key Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {followups.map((row, index) => (
                    <tr
                      key={row.id}
                      className={`${rowColors[index]} transition-colors hover:brightness-[0.98]`}
                    >
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        {formatDateTime(row.next_followup_date)}
                      </td>
                      <td className="px-4 py-3 align-top font-medium text-gray-900">
                        {row.created_by || "-"}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        {formatDateTime(row.followed_date)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {row.communication_mode || "-"}
                      </td>
                      <td className="max-w-md px-4 py-3 align-top">
                        <div className="whitespace-pre-wrap break-words text-gray-800">
                          {row.notes || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">-</td>
                      <td className="px-4 py-3 align-top">-</td>
                      <td className="px-4 py-3 align-top">-</td>
                      <td className="px-4 py-3 align-top">-</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end border-t px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
