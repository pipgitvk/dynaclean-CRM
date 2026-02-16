

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
import dayjs from "dayjs";

export default function FollowUpHistory({
  entries = [],
  cust_analysis_external,
}) {
  const uploads = cust_analysis_external?.uploads || [];

  const normalizeDate = (date) => dayjs(date).format("YYYY-MM-DD");

  const mergedMap = {};

  // 🔥 FIX 1: followups must be array
  entries.forEach((entry) => {
    const dateKey = entry.followed_date
      ? normalizeDate(entry.followed_date)
      : "no-date";

    if (!mergedMap[dateKey]) {
      mergedMap[dateKey] = {
        followups: [],
        uploads: [],
      };
    }

    mergedMap[dateKey].followups.push(entry);
  });

  // 🔥 FIX 2: uploads already array (correct)
  uploads.forEach((upload) => {
    const dateKey = upload.datetime
      ? normalizeDate(upload.datetime)
      : "no-date";

    if (!mergedMap[dateKey]) {
      mergedMap[dateKey] = {
        followups: [],
        uploads: [],
      };
    }

    mergedMap[dateKey].uploads.push(upload);
  });

  const mergedData = Object.values(mergedMap);

  return (
    <div className="overflow-x-auto bg-white shadow rounded w-full">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-100 text-gray-700 uppercase text-xs tracking-wide">
          <tr>
            <th className="px-4 py-3">Next Follow-up</th>
            <th className="px-4 py-3">Followed By</th>
            <th className="px-4 py-3">Followed Date</th>
            <th className="px-4 py-3">Mode</th>
            <th className="px-4 py-3">Remarks</th>

            <th className="px-4 py-3">Date & Time</th>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Summary</th>
            <th className="px-4 py-3">Key Points</th>
          </tr>
        </thead>

        <tbody className="bg-white divide-y divide-gray-200">
          {mergedData.length === 0 ? (
            <tr>
              <td colSpan={9} className="text-center py-4 text-gray-500">
                No Data Available
              </td>
            </tr>
          ) : (
            mergedData.map((row, index) => (
              <tr key={index}>
                {/* FOLLOWUPS */}
                <td className="px-4 py-2">
                  {row.followups.length > 0
                    ? row.followups.map((f, i) => (
                        <div key={i} className="mb-3">
                          {f.next_followup_date
                            ? dayjs(f.next_followup_date).format(
                                "DD MMM, YYYY hh:mm A"
                              )
                            : "-"}
                        </div>
                      ))
                    : "-"}
                </td>

                <td className="px-4 py-2">
                  {row.followups.length > 0
                    ? row.followups.map((f, i) => (
                        <div key={i} className="mb-3">
                          {f.followed_by || "-"}
                        </div>
                      ))
                    : "-"}
                </td>

                <td className="px-4 py-2">
                  {row.followups.length > 0
                    ? row.followups.map((f, i) => (
                        <div key={i} className="mb-3">
                          {f.followed_date
                            ? dayjs(f.followed_date).format(
                                "DD MMM, YYYY hh:mm A"
                              )
                            : "-"}
                        </div>
                      ))
                    : "-"}
                </td>

                <td className="px-4 py-2">
                  {row.followups.length > 0
                    ? row.followups.map((f, i) => (
                        <div key={i} className="mb-3">
                          {f.comm_mode || "-"}
                        </div>
                      ))
                    : "-"}
                </td>

                <td className="px-4 py-2">
                  {row.followups.length > 0
                    ? row.followups.map((f, i) => (
                        <div key={i} className="mb-3">
                          {f.notes || "-"}
                        </div>
                      ))
                    : "-"}
                </td>

                {/* UPLOADS */}
                <td className="px-4 py-2">
                  {row.uploads.length > 0
                    ? row.uploads.map((u, i) => (
                        <div key={i} className="mb-3">
                          {u.datetime
                            ? dayjs(u.datetime).format(
                                "DD MMM, YYYY hh:mm A"
                              )
                            : "-"}
                        </div>
                      ))
                    : "-"}
                </td>

                <td className="px-4 py-2">
                  {row.uploads.length > 0
                    ? row.uploads.map((u, i) => (
                        <div key={i} className="mb-3">
                          {u.user_name || "-"}
                        </div>
                      ))
                    : "-"}
                </td>

                <td className="px-4 py-2 max-w-xs">
                  {row.uploads.length > 0
                    ? row.uploads.map((u, i) => (
                        <div
                          key={i}
                          className="mb-3 whitespace-pre-wrap break-words"
                        >
                          {u.summary || "-"}
                        </div>
                      ))
                    : "-"}
                </td>

                <td className="px-4 py-2">
                  {row.uploads.length > 0
                    ? row.uploads.map((u, i) => (
                        <div key={i} className="mb-3">
                          {u.keypoints?.length > 0 ? (
                            <ul className="list-disc list-inside space-y-1">
                              {u.keypoints.map((point, kIndex) => (
                                <li key={kIndex}>{point}</li>
                              ))}
                            </ul>
                          ) : (
                            "-"
                          )}
                        </div>
                      ))
                    : "-"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
