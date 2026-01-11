// components/FollowUpHistory.tsx
"use client";
import dayjs from "dayjs";

export default function FollowUpHistory({ entries }) {
  return (
    <div className="overflow-x-auto bg-white shadow rounded">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-100 text-gray-700 uppercase text-xs tracking-wide">
          <tr>
            <th className="px-4 py-3">Next Follow-up</th>
            <th className="px-4 py-3">Followed By</th>
            <th className="px-4 py-3">Followed Date</th>
            <th className="px-4 py-3">Mode</th>
            <th className="px-4 py-3">Remarks</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {entries.map((e, i) => (
            <tr key={i}>
              <td className="px-4 py-2">
                {e.next_followup_date
                  ? dayjs(e.next_followup_date).format("DD MMM, YYYY hh:mm A")
                  : "-"}
              </td>
              <td className="px-4 py-2">{e.followed_by || "-"}</td>
              <td className="px-4 py-2">
                {e.followed_date
                  ? dayjs(e.followed_date).format("DD MMM, YYYY hh:mm A")
                  : "-"}
              </td>
              <td className="px-4 py-2">{e.comm_mode || "-"}</td>
              <td className="px-4 py-2">{e.notes || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
