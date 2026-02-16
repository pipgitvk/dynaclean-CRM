// components/FollowUpHistory.tsx
"use client";
import dayjs from "dayjs";

export default function FollowUpHistory({ entries,cust_analysis_external }) {
  const uploads=cust_analysis_external?.uploads || [];
 
  
  return (
    <div className="w-full flex gap-1">
 <div className="overflow-x-auto bg-white shadow rounded w-1/2">
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
    <div className="overflow-x-auto bg-white shadow rounded w-1/2">
  <table className="min-w-full divide-y divide-gray-200 text-sm">
    <thead className="bg-gray-100 text-gray-700 uppercase text-xs tracking-wide">
      <tr>
        <th className="px-4 py-3">Date & Time</th>
        <th className="px-4 py-3">User</th>
        <th className="px-4 py-3">Summary</th>
        <th className="px-4 py-3">Key Points</th>
      </tr>
    </thead>

    <tbody className="bg-white divide-y divide-gray-200">
      {uploads.length === 0 ? (
        <tr>
          <td colSpan="4" className="text-center py-4 text-gray-500">
            No Uploads Available
          </td>
        </tr>
      ) : (
        uploads.map((upload, index) => (
          <tr key={index}>
            <td className="px-4 py-2">
              {upload.datetime
                ? dayjs(upload.datetime).format("DD MMM, YYYY hh:mm A")
                : "-"}
            </td>

            <td className="px-4 py-2">
              {upload.user_name || "-"}
            </td>

            <td className="px-4 py-2 max-w-xs">
              <div className="whitespace-pre-wrap break-words">
                {upload.summary || "-"}
              </div>
            </td>

            <td className="px-4 py-2">
              {upload.keypoints?.length > 0 ? (
                <ul className="list-disc list-inside space-y-1">
                  {upload.keypoints.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              ) : (
                "-"
              )}
            </td>
          </tr>
        ))
      )}
    </tbody>
  </table>
</div>

    </div>
   
  );
}
