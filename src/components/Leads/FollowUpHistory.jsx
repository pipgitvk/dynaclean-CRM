

// "use client";
// import dayjs from "dayjs";

// export default function FollowUpHistory({ entries, cust_analysis_external }) {
//   const uploads = cust_analysis_external?.uploads || [];

//   const combinedData = [];


//   entries.forEach((e) => {
//     combinedData.push({
//       next_followup_date: e.next_followup_date || "-",
//       followed_by: e.followed_by || "-",
//       followed_date: e.followed_date || "-",
//       mode: e.comm_mode || "-",
//       remarks: e.notes || "-",
//       datetime: "-",
//       user_name: "-",
//       summary: "-",
//       keypoints: "-",
//       sortDate: e.followed_date,
//     });
//   });

//   // Add external uploads
//   uploads.forEach((u) => {
//     combinedData.push({
//       next_followup_date: "-",
//       followed_by: "-",
//       followed_date: "-",
//       mode: "-",
//       remarks: "-",
//       datetime: u.datetime || "-",
//       user_name: u.user_name || "-",
//       summary: u.summary || "-",
//       keypoints: u.keypoints || "-",
//       sortDate: u.datetime,
//     });
//   });

//   // Sort by latest date
//   combinedData.sort(
//     (a, b) =>
//       dayjs(b.sortDate || 0).valueOf() -
//       dayjs(a.sortDate || 0).valueOf()
//   );

//   return (
//     <div className="overflow-x-auto bg-white shadow rounded w-full">
//       <table className="min-w-full divide-y divide-gray-200 text-sm">
//         <thead className="bg-gray-100 text-gray-700 uppercase text-xs tracking-wide">
//           <tr>
//             <th className="px-4 py-3">Next Follow-up</th>
//             <th className="px-4 py-3">Followed By</th>
//             <th className="px-4 py-3">Followed Date</th>
//             <th className="px-4 py-3">Mode</th>
//             <th className="px-4 py-3">Remarks</th>
//             <th className="px-4 py-3">Date & Time</th>
//             <th className="px-4 py-3">User</th>
//             <th className="px-4 py-3">Summary</th>
//             <th className="px-4 py-3">Key Points</th>
//           </tr>
//         </thead>

//         <tbody className="bg-white divide-y divide-gray-200">
//           {combinedData.map((row, i) => (
//             <tr key={i} className="hover:bg-gray-50">
//               <td className="px-4 py-2">
//                 {row.next_followup_date !== "-"
//                   ? dayjs(row.next_followup_date).format(
//                       "DD MMM, YYYY hh:mm A"
//                     )
//                   : "-"}
//               </td>

//               <td className="px-4 py-2">{row.followed_by}</td>

//               <td className="px-4 py-2">
//                 {row.followed_date !== "-"
//                   ? dayjs(row.followed_date).format(
//                       "DD MMM, YYYY hh:mm A"
//                     )
//                   : "-"}
//               </td>

//               <td className="px-4 py-2">{row.mode}</td>

//               <td className="px-4 py-2">{row.remarks}</td>

//               <td className="px-4 py-2">
//                 {row.datetime !== "-"
//                   ? dayjs(row.datetime).format(
//                       "DD MMM, YYYY hh:mm A"
//                     )
//                   : "-"}
//               </td>

//               <td className="px-4 py-2">{row.user_name}</td>

//               <td className="px-4 py-2 max-w-xs">
//                 <div className="whitespace-pre-wrap break-words">
//                   {row.summary}
//                 </div>
//               </td>

//               <td className="px-4 py-2">
//                 {Array.isArray(row.keypoints) ? (
//                   <ul className="list-disc list-inside space-y-1">
//                     {row.keypoints.map((point, index) => (
//                       <li key={index}>{point}</li>
//                     ))}
//                   </ul>
//                 ) : (
//                   row.keypoints
//                 )}
//               </td>
//             </tr>
//           ))}
//         </tbody>
//       </table>
//     </div>
//   );
// }


// "use client";
// import dayjs from "dayjs";

// export default function FollowUpHistory({ entries = [], cust_analysis_external }) {
//   const uploads = cust_analysis_external?.uploads || [];

//   // Normalize date (remove time for matching)
//   const normalizeDate = (date) =>
//     dayjs(date).format("YYYY-MM-DD");

//   // Create map grouped by date
//   const mergedMap = {};

//   // Add followups
//   entries.forEach((entry) => {
//     const dateKey = entry.followed_date
//       ? normalizeDate(entry.followed_date)
//       : "no-date";

//     if (!mergedMap[dateKey]) {
//       mergedMap[dateKey] = {
//         followup: null,
//         upload: null,
//       };
//     }

//     mergedMap[dateKey].followup = entry;
//   });

//   // Add uploads
//   uploads.forEach((upload) => {
//     const dateKey = upload.datetime
//       ? normalizeDate(upload.datetime)
//       : "no-date";

//     if (!mergedMap[dateKey]) {
//       mergedMap[dateKey] = {
//         followup: null,
//         upload: null,
//       };
//     }

//     mergedMap[dateKey].upload = upload;
//   });

//   const mergedData = Object.values(mergedMap);

//   return (
//     <div className="overflow-x-auto bg-white shadow rounded w-full">
//       <table className="min-w-full divide-y divide-gray-200 text-sm">
//         <thead className="bg-gray-100 text-gray-700 uppercase text-xs tracking-wide">
//           <tr>
//             <th className="px-4 py-3">Next Follow-up</th>
//             <th className="px-4 py-3">Followed By</th>
//             <th className="px-4 py-3">Followed Date</th>
//             <th className="px-4 py-3">Mode</th>
//             <th className="px-4 py-3">Remarks</th>

//             <th className="px-4 py-3">Date & Time</th>
//             <th className="px-4 py-3">User</th>
//             <th className="px-4 py-3">Summary</th>
//             <th className="px-4 py-3">Key Points</th>
//           </tr>
//         </thead>

//         <tbody className="bg-white divide-y divide-gray-200">
//           {mergedData.length === 0 ? (
//             <tr>
//               <td colSpan={9} className="text-center py-4 text-gray-500">
//                 No Data Available
//               </td>
//             </tr>
//           ) : (
//             mergedData.map((row, index) => (
//               <tr key={index}>
//                 {/* Followup Columns */}
//                 <td className="px-4 py-2">
//                   {row.followup?.next_followup_date
//                     ? dayjs(row.followup.next_followup_date).format("DD MMM, YYYY hh:mm A")
//                     : "-"}
//                 </td>

//                 <td className="px-4 py-2">
//                   {row.followup?.followed_by || "-"}
//                 </td>

//                 <td className="px-4 py-2">
//                   {row.followup?.followed_date
//                     ? dayjs(row.followup.followed_date).format("DD MMM, YYYY hh:mm A")
//                     : "-"}
//                 </td>

//                 <td className="px-4 py-2">
//                   {row.followup?.comm_mode || "-"}
//                 </td>

//                 <td className="px-4 py-2">
//                   {row.followup?.notes || "-"}
//                 </td>

//                 {/* Upload Columns */}
//                 <td className="px-4 py-2">
//                   {row.upload?.datetime
//                     ? dayjs(row.upload.datetime).format("DD MMM, YYYY hh:mm A")
//                     : "-"}
//                 </td>

//                 <td className="px-4 py-2">
//                   {row.upload?.user_name || "-"}
//                 </td>

//                 <td className="px-4 py-2 max-w-xs">
//                   <div className="whitespace-pre-wrap break-words">
//                     {row.upload?.summary || "-"}
//                   </div>
//                 </td>

//                 <td className="px-4 py-2">
//                   {row.upload?.keypoints?.length > 0 ? (
//                     <ul className="list-disc list-inside space-y-1">
//                       {row.upload.keypoints.map((point, i) => (
//                         <li key={i}>{point}</li>
//                       ))}
//                     </ul>
//                   ) : (
//                     "-"
//                   )}
//                 </td>
//               </tr>
//             ))
//           )}
//         </tbody>
//       </table>
//     </div>
//   );
// }

"use client";
import {
  formatCrmDatetimeForISTDisplay,
  getCrmDateKeyIST,
  getCrmInstantMs,
} from "@/lib/timezone";
import { isGemRole } from "@/lib/isGemRole";

function pickNextFollowupField(entry, userRole) {
  if (userRole === "SERVICE SUPPORT") return entry.service_next_followup;
  if (isGemRole(userRole)) return entry.gem_next_followup;
  return entry.next_followup_date;
}

export default function FollowUpHistory({
  entries = [],
  cust_analysis_external,
  userRole = "",
}) {
  const isServiceSupport = userRole === "SERVICE SUPPORT";
  const isGEM = isGemRole(userRole);
  const nextFollowupLabel = isServiceSupport
    ? "Service Next Follow-up"
    : isGEM
      ? "GEM Next Follow-up"
      : "Next Follow-up";
  const uploads = isServiceSupport ? [] : (cust_analysis_external?.uploads || []);
  const hasUploads = uploads.length > 0;

  const uploadsByDate = {};
  uploads.forEach((upload) => {
    const dateKey = upload.datetime
      ? getCrmDateKeyIST(upload.datetime)
      : "no-date";
    if (!uploadsByDate[dateKey]) uploadsByDate[dateKey] = [];
    uploadsByDate[dateKey].push(upload);
  });

  const followupDateKeys = new Set(
    entries
      .map((entry) =>
        entry.followed_date ? getCrmDateKeyIST(entry.followed_date) : null,
      )
      .filter(Boolean),
  );

  const followupRows = [...entries].sort(
    (a, b) =>
      getCrmInstantMs(b.time_stamp || b.followed_date) -
      getCrmInstantMs(a.time_stamp || a.followed_date),
  );

  const uploadOnlyRows = uploads
    .filter((upload) => {
      const dateKey = upload.datetime
        ? getCrmDateKeyIST(upload.datetime)
        : "no-date";
      return !followupDateKeys.has(dateKey);
    })
    .sort(
      (a, b) => getCrmInstantMs(b.datetime) - getCrmInstantMs(a.datetime),
    );

  const totalColumns = hasUploads ? 9 : 5;

  const getRowUploads = (entry) => {
    if (!hasUploads || !entry?.followed_date) return [];
    const dateKey = getCrmDateKeyIST(entry.followed_date);
    return uploadsByDate[dateKey] || [];
  };

  return (
    <div className="overflow-x-auto bg-white shadow rounded w-full">
      <table className="w-full table-fixed divide-y divide-gray-200 text-sm">
        <colgroup>
          <col className={hasUploads ? "w-[11%]" : "w-[14%]"} />
          <col className={hasUploads ? "w-[9%]" : "w-[12%]"} />
          <col className={hasUploads ? "w-[11%]" : "w-[14%]"} />
          <col className={hasUploads ? "w-[7%]" : "w-[10%]"} />
          <col className={hasUploads ? "w-[38%]" : "w-[50%]"} />
          {hasUploads && (
            <>
              <col className="w-[8%]" />
              <col className="w-[6%]" />
              <col className="w-[5%]" />
              <col className="w-[5%]" />
            </>
          )}
        </colgroup>
        <thead className="bg-gray-100 text-gray-700 uppercase text-xs tracking-wide">
          <tr>
            <th className="px-4 py-3 text-left">{nextFollowupLabel}</th>
            <th className="px-4 py-3 text-left">Followed By</th>
            <th className="px-4 py-3 text-left">Followed Date</th>
            <th className="px-4 py-3 text-left">Mode</th>
            <th className="px-4 py-3 text-left">Remarks</th>
            {hasUploads && (
              <>
                <th className="px-4 py-3 text-left">Date & Time</th>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Summary</th>
                <th className="px-4 py-3 text-left">Key Points</th>
              </>
            )}
          </tr>
        </thead>

        <tbody className="bg-white divide-y divide-gray-200">
          {followupRows.length === 0 && uploadOnlyRows.length === 0 ? (
            <tr>
              <td colSpan={totalColumns} className="text-center py-4 text-gray-500">
                No Data Available
              </td>
            </tr>
          ) : (
            <>
              {followupRows.map((entry, index) => {
                const rowUploads = getRowUploads(entry);
                const nextFollowup = pickNextFollowupField(entry, userRole);
                const rowKey = `${entry.time_stamp || entry.followed_date || "f"}-${index}`;

                return (
                  <tr key={rowKey} className="align-top">
                    <td className="px-4 py-3">
                      {nextFollowup
                        ? formatCrmDatetimeForISTDisplay(nextFollowup)
                        : "-"}
                    </td>
                    <td className="px-4 py-3">{entry.followed_by || "-"}</td>
                    <td className="px-4 py-3">
                      {entry.followed_date
                        ? formatCrmDatetimeForISTDisplay(entry.followed_date)
                        : "-"}
                    </td>
                    <td className="px-4 py-3">{entry.comm_mode || "-"}</td>
                    <td className="px-4 py-3 min-w-0">
                      <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed text-gray-800">
                        {entry.notes || "-"}
                      </div>
                    </td>
                    {hasUploads && (
                      <>
                        <td className="px-4 py-3">
                          {rowUploads.length > 0
                            ? rowUploads.map((upload, uploadIndex) => (
                                <div key={uploadIndex} className="mb-2 last:mb-0">
                                  {upload.datetime
                                    ? formatCrmDatetimeForISTDisplay(upload.datetime)
                                    : "-"}
                                </div>
                              ))
                            : "-"}
                        </td>
                        <td className="px-4 py-3">
                          {rowUploads.length > 0
                            ? rowUploads.map((upload, uploadIndex) => (
                                <div key={uploadIndex} className="mb-2 last:mb-0">
                                  {upload.user_name || "-"}
                                </div>
                              ))
                            : "-"}
                        </td>
                        <td className="px-4 py-3 min-w-0">
                          {rowUploads.length > 0
                            ? rowUploads.map((upload, uploadIndex) => (
                                <div
                                  key={uploadIndex}
                                  className="mb-2 last:mb-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
                                >
                                  {upload.summary || "-"}
                                </div>
                              ))
                            : "-"}
                        </td>
                        <td className="px-4 py-3">
                          {rowUploads.length > 0
                            ? rowUploads.map((upload, uploadIndex) => (
                                <div key={uploadIndex} className="mb-2 last:mb-0">
                                  {upload.keypoints?.length > 0 ? (
                                    <ul className="list-disc list-inside space-y-1">
                                      {upload.keypoints.map((point, pointIndex) => (
                                        <li key={pointIndex}>{point}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    "-"
                                  )}
                                </div>
                              ))
                            : "-"}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}

              {uploadOnlyRows.map((upload, index) => (
                <tr key={`upload-${upload.datetime || index}`} className="align-top">
                  <td className="px-4 py-3">-</td>
                  <td className="px-4 py-3">-</td>
                  <td className="px-4 py-3">-</td>
                  <td className="px-4 py-3">-</td>
                  <td className="px-4 py-3">-</td>
                  <td className="px-4 py-3">
                    {upload.datetime
                      ? formatCrmDatetimeForISTDisplay(upload.datetime)
                      : "-"}
                  </td>
                  <td className="px-4 py-3">{upload.user_name || "-"}</td>
                  <td className="px-4 py-3 min-w-0">
                    <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                      {upload.summary || "-"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {upload.keypoints?.length > 0 ? (
                      <ul className="list-disc list-inside space-y-1">
                        {upload.keypoints.map((point, pointIndex) => (
                          <li key={pointIndex}>{point}</li>
                        ))}
                      </ul>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
