"use client";

import { useState } from "react";

function AssignmentsTable({ assignments }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "asset_id",
    direction: "asc", // default to ascending order
  });

  const handleSort = (key) => {
    // Toggle the sort direction if the same column is clicked
    setSortConfig((prevConfig) => {
      if (prevConfig.key === key) {
        return {
          ...prevConfig,
          direction: prevConfig.direction === "asc" ? "desc" : "asc",
        };
      } else {
        return { key, direction: "asc" }; // default to ascending for new column
      }
    });
  };

  // Filter assignments by search query
  const filteredAssignments = assignments.filter((assignment) => {
    return (
      assignment.asset_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      assignment.Assigned_to.toLowerCase().includes(
        searchQuery.toLowerCase()
      ) ||
      assignment.Assigned_by.toLowerCase().includes(
        searchQuery.toLowerCase()
      ) ||
      assignment.asset_id.toString().includes(searchQuery)
    );
  });

  // Sort the filtered assignments based on the selected column and direction
  const sortedAssignments = [...filteredAssignments].sort((a, b) => {
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];

    // Handle comparison for numeric and string data types
    if (aValue < bValue) {
      return sortConfig.direction === "asc" ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortConfig.direction === "asc" ? 1 : -1;
    }
    return 0;
  });

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden max-h-[80vh] overflow-y-auto">
      {/* Search Bar */}
      <div className="p-4">
        <input
          type="text"
          placeholder="Search by Asset, Assigned To, or Assigned By"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="p-2 border rounded-lg w-full"
        />
      </div>

      <div className="hidden lg:block">
        <table className="min-w-full leading-normal">
          <thead>
            <tr className="bg-gray-100 text-gray-600 uppercase text-sm">
              <th
                className="py-3 px-6 text-left cursor-pointer"
                onClick={() => handleSort("asset_id")}
              >
                ID
                {sortConfig.key === "asset_id" && (
                  <span>{sortConfig.direction === "asc" ? " ▲" : " ▼"}</span>
                )}
              </th>
              <th
                className="py-3 px-6 text-left cursor-pointer"
                onClick={() => handleSort("asset_name")}
              >
                Asset Name
                {sortConfig.key === "asset_name" && (
                  <span>{sortConfig.direction === "asc" ? " ▲" : " ▼"}</span>
                )}
              </th>
              <th
                className="py-3 px-6 text-left cursor-pointer"
                onClick={() => handleSort("Assigned_to")}
              >
                Assigned To
                {sortConfig.key === "Assigned_to" && (
                  <span>{sortConfig.direction === "asc" ? " ▲" : " ▼"}</span>
                )}
              </th>
              <th
                className="py-3 px-6 text-left cursor-pointer"
                onClick={() => handleSort("Assigned_by")}
              >
                Assigned By
                {sortConfig.key === "Assigned_by" && (
                  <span>{sortConfig.direction === "asc" ? " ▲" : " ▼"}</span>
                )}
              </th>
              <th
                className="py-3 px-6 text-left cursor-pointer"
                onClick={() => handleSort("Assigned_Date")}
              >
                Assigned Date
                {sortConfig.key === "Assigned_Date" && (
                  <span>{sortConfig.direction === "asc" ? " ▲" : " ▼"}</span>
                )}
              </th>
              <th
                className="py-3 px-6 text-left cursor-pointer"
                onClick={() => handleSort("is_submit")}
              >
                Status
                {sortConfig.key === "is_submit" && (
                  <span>{sortConfig.direction === "asc" ? " ▲" : " ▼"}</span>
                )}
              </th>
              <th
                className="py-3 px-6 text-left cursor-pointer"
                onClick={() => handleSort("submit_date")}
              >
                Submitted Date
                {sortConfig.key === "submit_date" && (
                  <span>{sortConfig.direction === "asc" ? " ▲" : " ▼"}</span>
                )}
              </th>
              <th
                className="py-3 px-6 text-left cursor-pointer"
                onClick={() => handleSort("receipt_path")}
              >
                Assignment Receipt
                {sortConfig.key === "receipt_path" && (
                  <span>{sortConfig.direction === "asc" ? " ▲" : " ▼"}</span>
                )}
              </th>
              <th
                className="py-3 px-6 text-left cursor-pointer"
                onClick={() => handleSort("submit_report_path")}
              >
                Submit Report
                {sortConfig.key === "submit_report_path" && (
                  <span>{sortConfig.direction === "asc" ? " ▲" : " ▼"}</span>
                )}
              </th>
            </tr>
          </thead>
          <tbody className="text-gray-700 text-sm">
            {sortedAssignments.length > 0 ? (
              sortedAssignments.map((assignment) => (
                <tr
                  key={assignment.assignment_id}
                  className="border-b border-gray-200 hover:bg-gray-50"
                >
                  <td className="py-3 px-6 whitespace-nowrap">
                    {assignment.asset_id}
                  </td>
                  <td className="py-3 px-6 whitespace-nowrap">
                    {assignment.asset_name}
                  </td>
                  <td className="py-3 px-6 whitespace-nowrap">
                    {assignment.Assigned_to}
                  </td>
                  <td className="py-3 px-6 whitespace-nowrap">
                    {assignment.Assigned_by}
                  </td>
                  <td className="py-3 px-6 whitespace-nowrap">
                    {assignment.Assigned_Date
                      ? new Date(assignment.Assigned_Date).toLocaleDateString()
                      : "N/A"}
                  </td>
                  <td className="py-3 px-6 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        assignment.is_submit
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {assignment.is_submit ? "Submitted" : "Assigned"}
                    </span>
                  </td>
                  <td className="py-3 px-6 whitespace-nowrap">
                    {assignment.submit_date
                      ? new Date(assignment.submit_date).toLocaleDateString()
                      : "N/A"}
                  </td>
                  <td className="py-3 px-6 whitespace-nowrap">
                    {assignment.receipt_path ? (
                      <a
                        href={assignment.receipt_path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        View Receipt
                      </a>
                    ) : (
                      "--"
                    )}
                  </td>

                  <td className="py-3 px-6 whitespace-nowrap">
                    {assignment.submit_report_path ? (
                      <a
                        href={assignment.submit_report_path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        View Report
                      </a>
                    ) : (
                      "--"
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="py-6 text-center text-gray-500">
                  No assignment history found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="block lg:hidden space-y-4 p-4">
        {sortedAssignments.length > 0 ? (
          sortedAssignments.map((assignment) => (
            <div
              key={assignment.assignment_id}
              className="bg-white border rounded-lg shadow p-4"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-lg text-gray-900">
                  {assignment.asset_name} ({assignment.asset_id})
                </span>
                <span
                  className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    assignment.is_submit
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {assignment.is_submit ? "Submitted" : "Assigned"}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-600">
                  <strong>Assigned To:</strong> {assignment.Assigned_to}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Assigned By:</strong> {assignment.Assigned_by}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Assigned Date:</strong>{" "}
                  {assignment.Assigned_Date
                    ? new Date(assignment.Assigned_Date).toLocaleDateString()
                    : "N/A"}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Submitted Date:</strong>{" "}
                  {assignment.submit_date
                    ? new Date(assignment.submit_date).toLocaleDateString()
                    : "N/A"}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Receipt:</strong>{" "}
                  {assignment.receipt_path ? (
                    <a
                      href={assignment.receipt_path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      View Receipt
                    </a>
                  ) : (
                    "--"
                  )}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="py-6 text-center text-gray-500">
            No assignment history found.
          </div>
        )}
      </div>
    </div>
  );
}

export default AssignmentsTable;
