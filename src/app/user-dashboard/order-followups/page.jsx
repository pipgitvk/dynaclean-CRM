// src/app/order-followups/page.jsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { Download, Search, RefreshCcw } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "react-hot-toast";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import dayjs from "dayjs";

// Skeleton component for a consistent loading experience
const SkeletonRows = () => (
  <>
    {[...Array(5)].map((_, i) => (
      <tr key={i} className="border-t border-gray-200 animate-pulse">
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
        <td className="p-4">
          <div className="h-4 bg-gray-200 rounded w-20"></div>
        </td>
      </tr>
    ))}
  </>
);

export default function OrderFollowups() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState(null); // Use null to distinguish no data vs empty array
  const [created_byList, setcreated_byList] = useState([]);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    created_by: "",
    search: "",
  });
  const [loading, setLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // Fetch data on initial load and whenever URL parameters change
  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      const urlParams = new URLSearchParams(searchParams);

      try {
        const res = await fetch(`/api/order-followups?${urlParams.toString()}`);
        const result = await res.json();

        if (res.ok) {
          if (Array.isArray(result.created_byList)) {
            setcreated_byList(result.created_byList);
          } else {
            setcreated_byList([]);
          }

          if (Array.isArray(result.data)) {
            setData(result.data);
            if (
              result.data.length === 0 &&
              (urlParams.get("startDate") ||
                urlParams.get("endDate") ||
                urlParams.get("created_by"))
            ) {
              toast.info("No data found for the selected filters.");
            } else if (result.data.length > 0) {
              //   toast.success("Data loaded successfully.");
            }
          } else {
            setData(null);
            toast.error("Invalid data format from API.");
          }
        } else {
          setData(null);
          toast.error(result.error || "Failed to fetch data.");
        }
      } catch (error) {
        console.error("Failed to fetch order data:", error);
        toast.error("Failed to fetch data.");
      } finally {
        setLoading(false);
      }
    };

    // Initialize filters from URL
    setFilters({
      startDate: searchParams.get("startDate") || "",
      endDate: searchParams.get("endDate") || "",
      created_by: searchParams.get("created_by") || "",
      search: "", // Search is not persisted in the URL
    });

    fetchOrders();
  }, [searchParams]);

  const handleFilter = () => {
    const { startDate, endDate, created_by } = filters;
    const newParams = new URLSearchParams(searchParams);

    if (startDate) newParams.set("startDate", startDate);
    else newParams.delete("startDate");
    if (endDate) newParams.set("endDate", endDate);
    else newParams.delete("endDate");
    if (created_by) newParams.set("created_by", created_by);
    else newParams.delete("created_by");

    router.push(`?${newParams.toString()}`);
  };

  const handleReset = () => {
    setFilters({
      startDate: "",
      endDate: "",
      created_by: "",
      search: "",
    });
    setData(null);
    router.push(window.location.pathname);
    // toast.success("Filters have been reset.");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleSearchChange = (e) => {
    setFilters((prev) => ({ ...prev, search: e.target.value }));
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const downloadPDF = () => {
    if (!filteredData || filteredData.length === 0) {
      toast.error("No data to download.");
      return;
    }
    const doc = new jsPDF();
    const tableData = filteredData.map((row) => [
      row.order_id,
      row.client_name,
      row.contact,
      row.subtotal ? `₹${Number(row.subtotal).toFixed(2)}` : '₹0.00',
      row.grand_total ? `₹${Number(row.grand_total).toFixed(2)}` : '₹0.00',
      row.delivery_location,
      row.created_by || '-',
      dayjs(row.created_at).format("DD-MMM-YYYY"),
      row.booking_id,
    ]);
    autoTable(doc, {
      head: [
        [
          "Order ID",
          "Client Name",
          "Contact",
          "Amount (Without Tax)",
          "Total Amount (With Tax)",
          "Delivery Location",
          "Created By",
          "Created At",
          "Booking ID",
        ],
      ],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: "#e5e7eb", textColor: 0, fontStyle: "bold" },
    });
    doc.save("orders_followups.pdf");
  };

  const filteredData = useMemo(() => {
    let currentData = data || [];
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
  }, [data, filters.search, sortConfig]);

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold text-center mb-8">
        Order Received Follow-ups
      </h1>

      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4 items-end">
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
              htmlFor="created_by"
              className="text-sm font-medium text-gray-700"
            >
              Created By
            </label>
            <select
              name="created_by"
              value={filters.created_by}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">All</option>
              {created_byList.map((creator, index) => (
                <option key={index} value={creator}>
                  {creator}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2 flex gap-2">
            <button
              onClick={handleFilter}
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? "Filtering..." : "Filter"}
            </button>
            <button
              onClick={handleReset}
              className="p-2 bg-gray-400 text-white rounded-md shadow-sm hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
            >
              <RefreshCcw className="w-5 h-5" />
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
                { key: "order_id", label: "Order ID" },
                { key: "client_name", label: "Client Name" },
                { key: "contact", label: "Contact" },
                { key: "subtotal", label: "Amount (Without Tax)" },
                { key: "grand_total", label: "Total Amount (With Tax)" },
                { key: "delivery_location", label: "Delivery Location" },
                { key: "created_by", label: "Created By" },
                { key: "created_at", label: "Created At" },
                { key: "booking_id", label: "Booking ID" },
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
            {loading ? (
              <SkeletonRows />
            ) : data && data.length > 0 ? (
              filteredData.map((row) => (
                <tr
                  key={row.order_id}
                  className="border-t border-gray-200 hover:bg-gray-50"
                >
                  <td className="p-4">{row.order_id}</td>
                  <td className="p-4">{row.client_name}</td>
                  <td className="p-4">{row.contact}</td>
                  <td className="p-4">₹{row.subtotal ? Number(row.subtotal).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0.00'}</td>
                  <td className="p-4">₹{row.grand_total ? Number(row.grand_total).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0.00'}</td>
                  <td className="p-4">{row.delivery_location}</td>
                  <td className="p-4">{row.created_by || '-'}</td>
                  <td className="p-4">
                    {dayjs(row.created_at).format("DD-MMM-YYYY")}
                  </td>
                  <td className="p-4">{row.booking_id}</td>
                  <td className="p-4 space-x-2 flex">
                    <Link
                      href={`/user-dashboard/order/${row.order_id}`}
                      className="text-blue-600 hover:underline whitespace-nowrap"
                    >
                      View
                    </Link>
                    {row.customer_id && (
                      <Link
                        href={`/user-dashboard/view-customer/${row.customer_id}`}
                        className="text-blue-600 hover:underline whitespace-nowrap"
                      >
                        Followups
                      </Link>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="10" className="p-4 text-center text-gray-500">
                  {data === null
                    ? "Please apply a filter to view data."
                    : "No data available."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
