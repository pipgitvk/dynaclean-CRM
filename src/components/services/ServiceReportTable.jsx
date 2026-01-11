// import React from 'react'
// import Modal from "@/components/models/serviceReports";
// import { useState, useEffect, useRef, useCallback, useMemo } from "react";
// const ServiceReportTable = () => {

//   const [sortColumn, setSortColumn] = useState(null);
//   const [sortDirection, setSortDirection] = useState("asc"); // 'asc' or 'desc'

//   const [showHiddenColumns, setShowHiddenColumns] = useState(false);

//   // Modal state for View Details
//   const [isModalOpen, setIsModalOpen] = useState(false);
//   const [selectedService, setSelectedService] = useState(null);

//       // Client-side sorting
//   const handleSort = (column) => {
//     const isAsc = sortColumn === column && sortDirection === "asc";
//     setSortDirection(isAsc ? "desc" : "asc");
//     setSortColumn(column);

//     // Sort the currently filtered records
//     const sortedRecords = [...filteredRecords].sort((a, b) => {
//       let valA = a[column];
//       let valB = b[column];

//       // Handle null/undefined values by treating them as empty strings
//       valA = valA === null || valA === undefined ? "" : String(valA);
//       valB = valB === null || valB === undefined ? "" : String(valB);

//       // Special handling for date columns
//       if (
//         column === "complaint_date" ||
//         column === "completed_date" ||
//         column === "reg_date"
//       ) {
//         const dateA = new Date(valA);
//         const dateB = new Date(valB);
//         return isAsc ? dateA - dateB : dateB - dateA;
//       }
//       // Numeric sort for company_cost and service_id
//       if (column === "company_cost" || column === "service_id") {
//         const numA = parseFloat(valA) || 0;
//         const numB = parseFloat(valB) || 0;
//         return isAsc ? numA - numB : numB - numA;
//       }
//       // Default string comparison
//       return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
//     });
//     setServiceRecords(sortedRecords); // Update the original serviceRecords state for consistent sorting across fetches/filters
//   };

//   const getSortIndicator = (column) => {
//     if (sortColumn === column) {
//       return sortDirection === "asc" ? " ▲" : " ▼";
//     }
//     return "";
//   };

//   // Toggle visibility of extra columns
//   const toggleHiddenColumns = () => {
//     setShowHiddenColumns(!showHiddenColumns);
//   };

//   // Open Modal
//   const openDetailsModal = (service) => {
//     setSelectedService(service);
//     setIsModalOpen(true);
//   };

//   // Close Modal
//   const closeDetailsModal = () => {
//     setIsModalOpen(false);
//     setSelectedService(null);
//   };

//   // Reset Filter
//   const handleResetFilter = () => {
//     setClientSearchTerm("");
//     // Re-fetch all records if you want to clear any applied client-side sort
//     // or just reset the sort state if you want the sort to persist
//     setSortColumn(null);
//     setSortDirection("asc");
//     fetchServiceRecords(); // Re-fetch to get original order if not sorting by default
//   };
//   return (
//     <>
//             {/* Client-side Search and Reset Form */}
//         <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4 mb-8 p-4 bg-gray-50 rounded-lg shadow-sm">
//           <div className="flex-grow min-w-[200px]">
//             <label htmlFor="client_search" className="sr-only">
//               Search all fields...
//             </label>
//             <input
//               type="text"
//               name="client_search"
//               id="client_search"
//               className="form-control w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
//               placeholder="Search all fields..."
//               value={clientSearchTerm}
//               onChange={(e) => setClientSearchTerm(e.target.value)}
//             />
//           </div>
//           <button
//             type="button" // Use type="button" to prevent form submission
//             onClick={handleResetFilter}
//             className="px-5 py-2 bg-red-600 text-white font-semibold rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200 w-full sm:w-auto"
//           >
//             Reset Filter
//           </button>
//         </div>

//         {/* Toggle Columns Button */}
//         <div className="mb-4 text-right">
//           <button
//             onClick={toggleHiddenColumns}
//             className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transition-colors duration-200"
//           >
//             {showHiddenColumns ? "Hide Details" : "Show More Details"}
//           </button>
//         </div>

//         <div className="w-full h-[60vh] flex items-center justify-center px-4">
//           <div className="w-full max-w-[1600px] h-full overflow-auto rounded-lg shadow-md bg-white">
//             {filteredRecords.length === 0 ? (
//               <p className="text-center text-gray-600 text-lg py-10">
//                 No service records found.
//               </p>
//             ) : (
//               <>
//                 {/* ✅ Desktop Table */}
//                 <div className="hidden md:block min-w-full">
//                   <table className="min-w-full divide-y divide-gray-200">
//                     <thead className="bg-gray-50">
//                       <tr>
//                         <th
//                           onClick={() => handleSort("serial_number")}
//                           className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
//                         >
//                           Serial Number {getSortIndicator("serial_number")}
//                         </th>
//                         <th
//                           onClick={() => handleSort("service_type")}
//                           className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
//                         >
//                           Service Type {getSortIndicator("service_type")}
//                         </th>
//                         <th
//                           onClick={() => handleSort("complaint_date")}
//                           className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
//                         >
//                           Complaint Date {getSortIndicator("complaint_date")}
//                         </th>
//                         <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                           Complaint Summary
//                         </th>
//                         <th
//                           onClick={() => handleSort("assigned_to")}
//                           className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
//                         >
//                           Assigned To {getSortIndicator("assigned_to")}
//                         </th>
//                         <th
//                           onClick={() => handleSort("service_id")}
//                           className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
//                         >
//                           Service ID {getSortIndicator("service_id")}
//                         </th>
//                         <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                           Installation Address
//                         </th>
//                         <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                           Company Name
//                         </th>
//                         <th
//                           className={`${
//                             showHiddenColumns ? "" : "hidden"
//                           } px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}
//                         >
//                           Observation
//                         </th>
//                         <th
//                           className={`${
//                             showHiddenColumns ? "" : "hidden"
//                           } px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}
//                         >
//                           Action Taken
//                         </th>
//                         <th
//                           className={`${
//                             showHiddenColumns ? "" : "hidden"
//                           } px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}
//                         >
//                           Parts Replaced
//                         </th>
//                         <th
//                           className={`${
//                             showHiddenColumns ? "" : "hidden"
//                           } px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}
//                         >
//                           Service Description
//                         </th>
//                         <th
//                           onClick={() => handleSort("status")}
//                           className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
//                         >
//                           Status {getSortIndicator("status")}
//                         </th>
//                         <th
//                           onClick={() => handleSort("completed_date")}
//                           className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
//                         >
//                           Completed Date {getSortIndicator("completed_date")}
//                         </th>
//                         <th
//                           onClick={() => handleSort("company_cost")}
//                           className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
//                         >
//                           Company Cost {getSortIndicator("company_cost")}
//                         </th>
//                         <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                           Actions
//                         </th>
//                       </tr>
//                     </thead>
//                     <tbody className="bg-white divide-y divide-gray-200">
//                       {filteredRecords.map((record) => {
//                         const hasReport =
//                           record.installation_report || record.attachments;
//                         let rowBackgroundColor = "";
//                         if (record.status?.toUpperCase() === "COMPLETED")
//                           rowBackgroundColor = "bg-green-50";
//                         else if (
//                           record.status?.toUpperCase() === "PENDING FOR SPARES"
//                         )
//                           rowBackgroundColor = "bg-orange-100";

//                         return (
//                           <tr
//                             key={record.service_id}
//                             className={rowBackgroundColor}
//                           >
//                             <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
//                               {record.serial_number}
//                             </td>
//                             <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
//                               {record.service_type}
//                             </td>
//                             <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
//                               {record.complaint_date}
//                             </td>
//                             <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate">
//                               {record.complaint_summary}
//                             </td>
//                             <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
//                               {record.assigned_to || "Not Assigned"}
//                             </td>
//                             <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
//                               {record.service_id}
//                             </td>
//                             <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate">
//                               {record.installed_address}
//                             </td>
//                             <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate">
//                               {record.customer_name}
//                             </td>
//                             <td
//                               className={`${
//                                 showHiddenColumns ? "" : "hidden"
//                               } px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate`}
//                             >
//                               {record.observation}
//                             </td>
//                             <td
//                               className={`${
//                                 showHiddenColumns ? "" : "hidden"
//                               } px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate`}
//                             >
//                               {record.action_taken}
//                             </td>
//                             <td
//                               className={`${
//                                 showHiddenColumns ? "" : "hidden"
//                               } px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate`}
//                             >
//                               {record.parts_replaced}
//                             </td>
//                             <td
//                               className={`${
//                                 showHiddenColumns ? "" : "hidden"
//                               } px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate`}
//                             >
//                               {record.service_description}
//                             </td>
//                             <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-green-700">
//                               {record.status}
//                             </td>
//                             <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
//                               {record.completed_date}
//                             </td>
//                             <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
//                               {record.company_cost ? (
//                                 record.company_cost
//                               ) : (
//                                 <Link
//                                   href={`/user-dashboard/warranty/service-records/cost/${record.service_id}`}
//                                   className="inline-block px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-200"
//                                 >
//                                   Update Cost
//                                 </Link>
//                               )}
//                             </td>
//                             <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
//                               <div className="flex flex-col space-y-2">
//                                 {record.status?.toUpperCase() !==
//                                 "COMPLETED" ? (
//                                   <>
//                                     <Link
//                                       href={`/user-dashboard/assign-service/${record.service_id}`}
//                                       className="inline-block px-3 py-1 text-sm bg-indigo-500 text-white rounded-md hover:bg-indigo-600 transition-colors duration-200 text-center"
//                                     >
//                                       Assign
//                                     </Link>
//                                     <Link
//                                       href={`/user-dashboard/update-service/${record.service_id}`}
//                                       className="inline-block px-3 py-1 text-sm bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors duration-200 text-center"
//                                     >
//                                       Generate/Upload Report
//                                     </Link>
//                                   </>
//                                 ) : hasReport ? (
//                                   <a
//                                     href={`${baseUrl}/service_reports/${
//                                       record.installation_report ||
//                                       record.attachments?.split(",")[0]
//                                     }`}
//                                     target="_blank"
//                                     rel="noopener noreferrer"
//                                     className="inline-block px-3 py-1 text-sm bg-green-700 text-white rounded-md hover:bg-green-800 transition-colors duration-200 text-center"
//                                   >
//                                     View Report
//                                   </a>
//                                 ) : (
//                                   <Link
//                                     href={`/user-dashboard/update-service/${record.service_id}`}
//                                     className="inline-block px-3 py-1 text-sm bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors duration-200 text-center"
//                                   >
//                                     Generate/Upload Report
//                                   </Link>
//                                 )}
//                                 <button
//                                   onClick={() => openDetailsModal(record)}
//                                   className="inline-block px-3 py-1 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors duration-200 text-center"
//                                 >
//                                   View Details
//                                 </button>
//                               </div>
//                             </td>
//                           </tr>
//                         );
//                       })}
//                     </tbody>
//                   </table>
//                 </div>

//               </>
//             )}
//           </div>
//         </div>
//       </div>

//       {/* Service Details Modal */}

//   )
// }

// export default ServiceReportTable
