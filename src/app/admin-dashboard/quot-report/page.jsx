// src/app/quotation-followup/page.jsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { Download, Search, RefreshCcw } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "react-hot-toast";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation"; // Import router and searchParams

export default function QuotationFollowup() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState([]);
  const [employees, setEmployees] = useState(null); // Set to null to handle initial employee fetch
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    empName: "",
    search: "",
    status: "",
  });
  const [loading, setLoading] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  useEffect(() => {
    // Read initial filters from URL and fetch data if parameters exist
    const initialStartDate = searchParams.get("startDate") || "";
    const initialEndDate = searchParams.get("endDate") || "";
    const initialEmpName = searchParams.get("empName") || "";
    const initialStatus = searchParams.get("status") || "";

    setFilters({
      startDate: initialStartDate,
      endDate: initialEndDate,
      empName: initialEmpName,
      status: initialStatus,
      search: "", // Search filter is not persisted in URL
    });

    const hasInitialFilters =
      initialStartDate || initialEndDate || initialEmpName;

    const fetchData = async (fetchParams) => {
      setLoading(true);
      setShowSkeleton(true);
      try {
        const queryParams = new URLSearchParams(fetchParams);
        const res = await fetch(
          `/api/quotation-followup?${queryParams.toString()}`
        );
        const result = await res.json();

        if (res.ok) {
          if (Array.isArray(result.employees)) {
            setEmployees(result.employees);
          } else {
            setEmployees([]);
          }

          if (Array.isArray(result.data)) {
            setData(result.data);
            if (hasInitialFilters && result.data.length > 0) {
              //   toast.success("Data loaded from previous session.");
            } else if (hasInitialFilters && result.data.length === 0) {
              //   toast.info("No data found for the selected filters.");
            }
          } else {
            setData([]);
          }
        } else {
          toast.error(result.error || "Failed to fetch data.");
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        toast.error("Error fetching data.");
      } finally {
        setLoading(false);
        setShowSkeleton(false);
      }
    };

    // Fetch data if initial filters are present, otherwise just fetch employees
    const params = {
      startDate: initialStartDate,
      endDate: initialEndDate,
      empName: initialEmpName,
    };
    fetchData(params);
  }, [searchParams]);

  const handleFilter = async () => {
    const { startDate, endDate, empName, status } = filters;
    const newParams = new URLSearchParams(searchParams);

    // Set or delete URL parameters based on filter values
    if (startDate) newParams.set("startDate", startDate);
    else newParams.delete("startDate");
    if (endDate) newParams.set("endDate", endDate);
    else newParams.delete("endDate");
    if (empName) newParams.set("empName", empName);
    else newParams.delete("empName");
    if (status) newParams.set("status", status);
    else newParams.delete("status");

    router.push(`?${newParams.toString()}`);
    // The useEffect hook will now trigger and refetch the data
  };

  const handleReset = () => {
    setFilters({
      startDate: "",
      endDate: "",
      empName: "",
      status: "",
      search: "",
    });
    setData([]);
    router.push(window.location.pathname); // Navigates to the base URL, clearing all parameters
    // toast.success("Filters have been reset.");
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleSearchChange = (e) => {
    setFilters((prev) => ({ ...prev, search: e.target.value }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const downloadPDF = () => {
    if (filteredData.length === 0) {
      toast.error("No data to download.");
      return;
    }
    const doc = new jsPDF();
    autoTable(doc, {
      head: [
        [
          "Quote Number",
          "Quote Date",
          "Company Name",
          "Grand Total",
          "Employee Name",
        ],
      ],
      body: filteredData.map((row) => [
        row.quote_number,
        new Date(row.quote_date).toLocaleDateString(),
        row.company_name,
        row.grand_total,
        row.emp_name,
      ]),
      styles: {
        fontSize: 8,
      },
      headStyles: {
        fillColor: "#e5e7eb",
        textColor: 0,
        fontStyle: "bold",
      },
    });
    doc.save("quotation_followup.pdf");
  };

  const filteredData = useMemo(() => {
    let currentData = data;
    // Filter by Status (Open/Closed)
    if (filters.status) {
      currentData = currentData.filter((item) => {
        // If status is 'open', we check if item.status is NOT 'closed'
        if (filters.status === "open") return item.status !== "closed";
        // If status is 'closed', we check if item.status IS 'closed'
        return item.status === "closed";
      });
    }

    if (filters.search) {
      currentData = currentData.filter((item) =>
        Object.values(item).some((val) =>
          String(val).toLowerCase().includes(filters.search.toLowerCase())
        )
      );
    }

    if (sortConfig.key) {
      currentData.sort((a, b) => {
        const aVal = a[sortConfig.key] ?? "";
        const bVal = b[sortConfig.key] ?? "";
        return sortConfig.direction === "asc"
          ? aVal > bVal
            ? 1
            : -1
          : aVal < bVal
            ? 1
            : -1;
      });
    }
    return currentData;
  }, [data, filters.search, filters.status, sortConfig]);

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold text-center mb-8">
        Quotation Follow-up
      </h1>

      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="flex flex-col">
            <label
              htmlFor="startDate"
              className="text-sm font-medium text-gray-700"
            >
              From Date
            </label>
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col">
            <label
              htmlFor="endDate"
              className="text-sm font-medium text-gray-700"
            >
              To Date
            </label>
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col">
            <label
              htmlFor="empName"
              className="text-sm font-medium text-gray-700"
            >
              Employee
            </label>
            <select
              name="empName"
              value={filters.empName}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">All Employees</option>
              {employees &&
                employees.map((emp, index) => (
                  <option key={index} value={emp.username}>
                    {emp.username}
                  </option>
                ))}
            </select>
          </div>
          {/* Add this inside your grid div (next to the Employee select) */}
          <div className="flex flex-col">
            <label htmlFor="status" className="text-sm font-medium text-gray-700">
              Status
            </label>
            <select
              name="status"
              value={filters.status}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleFilter}
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? "Filtering..." : "Filter"}
            </button>
            <button
              onClick={handleReset}
              className="flex-1 bg-gray-400 text-white py-2 px-4 rounded-md shadow-sm hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
            >
              <RefreshCcw className="w-4 h-4 mx-auto" />
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-between items-center gap-4">
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search..."
              value={filters.search}
              onChange={handleSearchChange}
              className="pl-10 pr-4 py-2 border rounded-md w-full focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-700">
              Row Count: {filteredData.length}
            </span>
            <button
              onClick={downloadPDF}
              className="flex items-center gap-2 bg-gray-200 text-gray-800 py-2 px-4 rounded-md shadow-sm hover:bg-gray-300 disabled:opacity-50"
              disabled={filteredData.length === 0}
            >
              <Download className="w-4 h-4" /> Download PDF
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow-md">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              {[
                { key: "quote_number", label: "Quote Number" },
                { key: "quote_date", label: "Quote Date" },
                { key: "company_name", label: "Company Name" },
                { key: "grand_total", label: "Grand Total" },
                { key: "emp_name", label: "Employee Name" },
                { key: "actions", label: "Actions" },
              ].map((column) => (
                <th
                  key={column.key}
                  onClick={() => handleSort(column.key)}
                  className="p-4 text-left font-semibold cursor-pointer hover:bg-gray-200"
                >
                  {column.label}
                  {column.key !== "actions" &&
                    sortConfig.key === column.key && (
                      <span>
                        {sortConfig.direction === "asc" ? " ▲" : " ▼"}
                      </span>
                    )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {showSkeleton ? (
              [...Array(5)].map((_, index) => (
                <tr
                  key={index}
                  className="border-t border-gray-200 animate-pulse"
                >
                  <td className="p-4">
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                  </td>
                  <td className="p-4">
                    <div className="h-4 bg-gray-200 rounded w-20"></div>
                  </td>
                  <td className="p-4">
                    <div className="h-4 bg-gray-200 rounded w-32"></div>
                  </td>
                  <td className="p-4">
                    <div className="h-4 bg-gray-200 rounded w-16"></div>
                  </td>
                  <td className="p-4">
                    <div className="h-4 bg-gray-200 rounded w-20"></div>
                  </td>
                  <td className="p-4">
                    <div className="h-4 bg-gray-200 rounded w-32"></div>
                  </td>
                </tr>
              ))
            ) : data.length > 0 ? (
              filteredData.map((row, index) => (
                <tr
                  key={index}
                  className="border-t border-gray-200 hover:bg-gray-50"
                >
                  <td className="p-4">{row.quote_number}</td>
                  <td className="p-4">
                    {new Date(row.quote_date).toLocaleDateString()}
                  </td>
                  <td className="p-4">{row.company_name}</td>
                  <td className="p-4">{row.grand_total}</td>
                  <td className="p-4">{row.emp_name}</td>
                  <td className="p-4 space-x-2">
                    <Link
                      href={`/admin-dashboard/quotations/${row.quote_number}`}
                      className="text-blue-600 hover:underline"
                    >
                      View
                    </Link>
                    <Link
                      href={`/admin-dashboard/view-customer/${row.customer_id}`}
                      className="text-blue-600 hover:underline"
                    >
                      Followups
                    </Link>
                    {row.status === "closed" ? (
                      <Link
                        href={`/admin-dashboard/order/${row.order_id}`}
                        className="text-green-600 hover:underline"
                      >
                        Closed
                      </Link>
                    ) : (
                      <span className="text-gray-500">Open</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="p-4 text-center text-gray-500">
                  Please apply a filter to view data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
