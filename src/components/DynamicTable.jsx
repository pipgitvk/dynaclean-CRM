"use client";

import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const DynamicTable = ({ data, columns }) => {
  const [sortedData, setSortedData] = React.useState(data);
  const [sortConfig, setSortConfig] = React.useState({
    key: null,
    direction: "ascending",
  });

  React.useEffect(() => {
    setSortedData(data);
  }, [data]);

  const handleSort = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });

    const sortedArray = [...data].sort((a, b) => {
      if (a[key] < b[key]) {
        return direction === "ascending" ? -1 : 1;
      }
      if (a[key] > b[key]) {
        return direction === "ascending" ? 1 : -1;
      }
      return 0;
    });
    setSortedData(sortedArray);
  };

  if (!data || data.length === 0) {
    return (
      <div className="text-center text-gray-500 p-4">No data to display.</div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg shadow-md border border-gray-200">
      {/* Table View (Visible on large screens) */}
      <div className="hidden lg:block">
        <table className="min-w-full divide-y divide-gray-200 table-auto">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  onClick={() => column.sortable && handleSort(column.key)}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    column.sortable ? "cursor-pointer hover:bg-gray-100" : ""
                  }`}
                >
                  <div className="flex items-center">
                    {column.header}
                    {column.sortable && sortConfig.key === column.key && (
                      <span className="ml-2">
                        {sortConfig.direction === "ascending" ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedData.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50">
                {columns.map((column, colIndex) => (
                  <td
                    key={colIndex}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                  >
                    {row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile View: Convert table rows to card view */}
      <div className="lg:hidden">
        {sortedData.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="my-4 p-4 bg-white shadow-md rounded-lg"
          >
            {columns.map((column, colIndex) => (
              <div key={colIndex} className="mb-2">
                <strong className="text-sm text-gray-500">
                  {column.header}:
                </strong>
                <p className="text-sm text-gray-900">{row[column.key]}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DynamicTable;
