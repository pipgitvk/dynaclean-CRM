import { X, Eye } from "lucide-react";
import dayjs from "dayjs";
import Link from "next/link";

export default function Modal({ isOpen, onClose, title, data }) {
  if (!isOpen) return null;

  const getFilteredColumns = () => {
    if (data.length === 0) return [];
    // Get all keys from the first data object
    const allColumns = Object.keys(data[0]);
    // Filter out the machine and model columns
    return allColumns.filter(
      (col) =>
        !col.startsWith("Machine") &&
        !col.startsWith("Model") &&
        col !== "Demo Date/Time"
    );
  };

  const columns = getFilteredColumns();
  const showActionsColumn = data.length > 0;

  // Determine the base path for the "View" link
  const getBasePath = () => {
    if (title.includes("Quotations")) {
      return "/admin-dashboard/quotations";
    }
    if (title.includes("New Orders")) {
      return "/admin-dashboard/order";
    }
    if (title.includes("Demo Registrations")) {
      return "/admin-dashboard/demos";
    }
    return "#";
  };

  const basePath = getBasePath();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto">
          {data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    {columns.map((col, i) => (
                      <th
                        key={i}
                        className="px-3 py-3 font-semibold text-left whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                    {showActionsColumn && (
                      <th className="px-3 py-3 font-semibold text-center whitespace-nowrap">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.map((row, i) => (
                    <tr
                      key={i}
                      className="hover:bg-gray-50 transition-colors duration-150"
                    >
                      {columns.map((col, j) => (
                        <td
                          key={j}
                          className="px-3 py-3 text-left whitespace-nowrap"
                        >
                          {/* Conditionally render the data */}
                          {row[col]}
                        </td>
                      ))}
                      <td className="px-3 py-3 text-center">
                        {/* Conditional link generation */}
                        {title.includes("Quotations") && (
                          <Link
                            href={`${basePath}/${row["Quote #"]}`}
                            className="text-blue-600 hover:underline flex items-center gap-1 justify-center"
                          >
                            <Eye size={16} /> View
                          </Link>
                        )}
                        {title.includes("New Orders") && (
                          <Link
                            href={`${basePath}/${row["Order ID"]}`}
                            className="text-blue-600 hover:underline flex items-center gap-1 justify-center"
                          >
                            <Eye size={16} /> View
                          </Link>
                        )}
                        {title.includes("Demo Registrations") && (
                          <Link
                            href={{
                              pathname: `${basePath}/${encodeURIComponent(
                                row["Customer Name"]
                              )}`,
                              query: {
                                mobile: row.Mobile,
                                company: row.Company,
                                demoDate: row["Demo Date/Time"],
                                address: row.Address,
                                username: row.Username,
                                demoStatus: row["Demo Status"],
                                machine1: row.Machine1,
                                model1: row.Model1,
                                machine2: row.Machine2,
                                model2: row.Model2,
                                machine3: row.Machine3,
                                model3: row.Model3,
                              },
                            }}
                            className="text-blue-600 hover:underline flex items-center gap-1 justify-center"
                          >
                            <Eye size={16} /> View
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500">
              No records found for this category.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
