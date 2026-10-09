// app/demo-registrations/page.jsx
"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import { Pencil, RefreshCcw, Download } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
        <td className="p-4">
          <div className="h-4 bg-gray-200 rounded w-20"></div>
        </td>
        <td className="p-4">
          <div className="h-4 bg-gray-200 rounded w-20"></div>
        </td>
      </tr>
    ))}
  </>
);

// Custom Status Badge Component
const StatusBadge = ({ status }) => {
  const styles = {
    Complete: "bg-green-100 text-green-700 border-green-200",
    Canceled: "bg-red-100 text-red-700 border-red-200",
    Postponed: "bg-orange-100 text-orange-700 border-orange-200",
    Pending: "bg-blue-50 text-blue-600 border-blue-100",
  };

  const current = status || "Pending";

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${styles[current] || styles.Pending}`}>
      {current}
    </span>
  );
};

export default function DemoRegistrationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedDemoDate, setSelectedDemoDate] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("Complete");
  const [description, setDescription] = useState("");
  const [postponeDate, setPostponeDate] = useState("");

  const [filters, setFilters] = useState({
    search: searchParams.get("search") || "",
    date_from: searchParams.get("date_from") || "",
    date_to: searchParams.get("date_to") || "",
    employeeName: searchParams.get("employeeName") || "",
    demo_status: searchParams.get("demo_status") || "", // New
    sort: searchParams.get("sort") || "demo_date_time",
  });

  const [refreshKey, setRefreshKey] = useState(0); // Add this line

  // Fetch data on initial load and when URL parameters change
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const urlParams = new URLSearchParams(searchParams);
        const res = await fetch(
          `/api/demo-registrations?${urlParams.toString()}`
        );
        const result = await res.json();

        if (res.ok) {
          setData(result.data || []);
          setEmployees(result.employees || []);
        } else {
          toast.error(result.error || "Failed to fetch data.");
          setData([]);
          setEmployees([]);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        toast.error("Failed to fetch data.");
        setData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [searchParams, refreshKey],
  );

  // Handle URL updates for filters
  const handleFilterUpdate = (key, value) => {
    const updatedFilters = { ...filters, [key]: value };
    setFilters(updatedFilters);

    const newParams = new URLSearchParams();
    Object.keys(updatedFilters).forEach((paramKey) => {
      if (updatedFilters[paramKey] && updatedFilters[paramKey] !== "all") {
        newParams.set(paramKey, updatedFilters[paramKey]);
      }
    });
    router.push(`?${newParams.toString()}`);
  };

  const handleResetFilters = () => {
    setFilters({
      search: "",
      date_from: "",
      date_to: "",
      employeeName: "",
      demo_status: "",
      sort: "demo_date_time",
    });
    router.push("/user-dashboard/demo-registrations");
    toast.success("Filters reset");
  };


  const filteredData = useMemo(() => {
    let temp = [...(data || [])];

    if (filters.search) {
      const keyword = filters.search.toLowerCase();
      temp = temp.filter((r) =>
        Object.values(r).some((val) =>
          String(val).toLowerCase().includes(keyword)
        )
      );
    }

    // Sort logic
    if (filters.sort === "demo_date_time") {
      temp.sort(
        (a, b) => new Date(b.demo_date_time) - new Date(a.demo_date_time)
      );
    } else if (filters.sort === "oldest") {
      temp.sort(
        (a, b) => new Date(a.demo_date_time) - new Date(b.demo_date_time)
      );
    } else if (filters.sort === "customer_name") {
      temp.sort((a, b) => a.customer_name.localeCompare(b.customer_name));
    }

    return temp;
  }, [filters, data]);

  const handleStatusUpdate = async (
    id,
    demoDateRaw,
    status,
    description,
    postponeDate
  ) => {
    const formattedDemoDate = dayjs(demoDateRaw).format("YYYY-MM-DD HH:mm:ss");

    // Check if description is not empty
    if (!description || description.trim() === "") {
      toast.error("Description is required.");
      return;
    }

    try {
      const res = await fetch("/api/demo-registration/mark-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          demo_date_time: formattedDemoDate,
          status,
          description,
          postpone_date: status === "Postponed" ? postponeDate : null,
        }),
      });

      if (!res.ok) throw new Error("Failed to update");

      toast.success("Status updated successfully!");
      setShowConfirm(false);
      resetModalState();
      setRefreshKey(prev => prev + 1); // Replace router.refresh() with this
    } catch (err) {
      toast.error("Failed to update status");
      console.error(err);
    }
  };

  const resetModalState = () => {
    setSelectedId(null);
    setSelectedCustomer("");
    setSelectedDemoDate("");
    setSelectedStatus("Complete");
    setDescription("");
    setPostponeDate("");
  };

  const downloadPDF = () => {
    if (!filteredData || filteredData.length === 0) {
      toast.error("No data to download.");
      return;
    }
    const doc = new jsPDF({ orientation: "landscape" });
    const tableData = filteredData.map((item) => [
      item.customer_name,
      item.mobile,
      item.company,
      item.username,
      item.demo_address,
      dayjs(item.demo_date_time).format("DD MMM YYYY hh:mm A"),
      item.machine1,
      item.demo_status || "Pending",
      item.completion_description ||
      item.cancel_description ||
      item.postponed_description ||
      "-",
      item.postponed_date
        ? dayjs(item.postponed_date).format("DD MMM YYYY")
        : "-",
      item.demo_completion_date
        ? dayjs(item.demo_completion_date).format("DD MMM YYYY")
        : "-",
    ]);
    autoTable(doc, {
      head: [
        [
          "Customer",
          "Mobile",
          "Company",
          "Username",
          "Address",
          "Demo Date",
          "Machine",
          "Status",
          "Description",
          "Postponed Date",
          "Completed On",
        ],
      ],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: "#e5e7eb", textColor: 0, fontStyle: "bold" },
    });
    doc.save("demo_registrations.pdf");
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Demo Registrations</h1>
          <div className="flex items-center gap-2">
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              Total: {filteredData.length}
            </span>
          </div>
        </div>

        {/* Advanced Filter Grid */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 items-end">

            {/* Search */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterUpdate("search", e.target.value)}
                placeholder="Name, Mobile..."
                className="p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
              />
            </div>

            {/* Date From */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">From</label>
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) => handleFilterUpdate("date_from", e.target.value)}
                className="p-2.5 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            {/* Date To */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">To</label>
              <input
                type="date"
                value={filters.date_to}
                onChange={(e) => handleFilterUpdate("date_to", e.target.value)}
                className="p-2.5 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            {/* Employee Filter */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Employee</label>
              <select
                value={filters.employeeName}
                onChange={(e) => handleFilterUpdate("employeeName", e.target.value)}
                className="p-2.5 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Staff</option>
                {employees.map((emp) => (
                  <option key={emp.username} value={emp.username}>{emp.username}</option>
                ))}
              </select>
            </div>

            {/* NEW: Demo Status Filter */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Demo Status</label>
              <select
                value={filters.demo_status || ""}
                onChange={(e) => handleFilterUpdate("demo_status", e.target.value)}
                className="p-2.5 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Complete">Complete</option>
                <option value="Postponed">Postponed</option>
                <option value="Canceled">Canceled</option>
              </select>
            </div>

            {/* Sort */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Sort</label>
              <select
                value={filters.sort}
                onChange={(e) => handleFilterUpdate("sort", e.target.value)}
                className="p-2.5 border border-gray-300 rounded-lg text-sm"
              >
                <option value="demo_date_time">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="customer_name">Name A-Z</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={downloadPDF}
                className="flex-1 p-2.5 border border-blue-200 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition flex items-center justify-center gap-2 text-sm font-semibold"
              >
                <Download size={18} /> <span className="xl:hidden">PDF</span>
              </button>
              <button
                onClick={handleResetFilters}
                className="flex-1 p-2.5 border border-red-200 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition flex items-center justify-center"
              >
                <RefreshCcw size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile-Optimized Table/Card View */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 hidden lg:table-header-group">
                <tr>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase">Schedule</th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase">Details</th>
                  <th className="px-4 py-4 text-right text-xs font-bold text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100 block lg:table-row-group">
                {isLoading ? (
                  <SkeletonRows />
                ) : filteredData.length > 0 ? (
                  filteredData.map((item) => {
                    // 1. Define dynamic row colors based on status
                    const getRowStyle = (status, date) => {
                      // Overdue check: If date is in the past and status is not final
                      const isOverdue = dayjs(date).isBefore(dayjs().startOf("day")) &&
                        status !== "Complete" && status !== "Canceled";

                      if (status === "Complete") return "bg-green-100 border-l-4 border-l-green-500";
                      if (status === "Canceled") return "bg-red-100 border-l-4 border-l-red-500";
                      if (status === "Postponed") return "bg-orange-100 border-l-4 border-l-orange-400";
                      if (isOverdue) return "bg-yellow-100 border-l-4 border-l-yellow-500"; // Alert for missed demos
                      return "hover:bg-gray-50";
                    };

                    return (
                      <tr
                        key={item.customer_id + item.demo_date_time}
                        className={`block lg:table-row transition-colors mb-3 lg:mb-0 shadow-sm lg:shadow-none rounded-lg lg:rounded-none border lg:border-none ${getRowStyle(item.demo_status, item.demo_date_time)}`}
                      >
                        {/* Customer Card Header (Mobile) */}
                        <td className="px-4 py-4 block lg:table-cell">
                          <div className="flex justify-between items-start lg:block">
                            <div>
                              <div className="font-bold text-gray-900 text-base lg:text-sm">{item.customer_name}</div>
                              <div className="text-xs text-gray-500">{item.company}</div>
                              <div className="text-xs text-blue-500 font-medium lg:hidden mt-1">{item.mobile}</div>
                            </div>
                            {/* Status Badge (Mobile Only) */}
                            <div className="lg:hidden">
                              <StatusBadge status={item.demo_status} />
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-1 lg:py-4 block lg:table-cell">
                          <div className="text-sm font-semibold text-gray-700">
                            <span className="lg:hidden text-gray-400 font-normal mr-2 italic">Scheduled:</span>
                            {dayjs(item.demo_date_time).format("DD MMM, hh:mm A")}
                          </div>
                          {item.postponed_date && (
                            <div className="text-[10px] text-orange-700 font-bold mt-1 bg-orange-100 inline-block px-1 rounded">
                              POSTPONED TO: {dayjs(item.postponed_date).format("DD MMM")}
                            </div>
                          )}
                        </td>

                        {/* Status Badge (Desktop) */}
                        <td className="px-4 py-1 lg:py-4 hidden lg:table-cell">
                          <StatusBadge status={item.demo_status} />
                        </td>

                        <td className="px-4 py-1 lg:py-4 block lg:table-cell">
                          <div className="text-xs text-gray-600 truncate max-w-[280px] lg:max-w-none italic">
                            <span className="lg:hidden text-gray-400 font-normal not-italic mr-2 font-bold uppercase">Note:</span>
                            {item.completion_description || item.postponed_description || item.cancel_description || "No notes"}
                          </div>
                        </td>

                        <td className="px-4 py-4 block lg:table-cell text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              disabled={item.demo_status === "Complete" || item.demo_status === "Canceled"}
                              onClick={() => {
                                setSelectedId(item.customer_id);
                                setSelectedCustomer(item.customer_name);
                                setSelectedDemoDate(item.demo_date_time);
                                setShowConfirm(true);
                              }}
                              className={`p-2 rounded-lg transition ${item.demo_status === "Complete" || item.demo_status === "Canceled"
                                ? "text-gray-300 bg-gray-50/50 cursor-not-allowed"
                                : "text-blue-600 bg-white shadow-sm border border-blue-100 hover:bg-blue-50"
                                }`}
                            >
                              <Pencil size={18} />
                            </button>
                            <Link
                              href={`/user-dashboard/view-customer/${item.customer_id}`}
                              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 shadow-sm"
                            >
                              View
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="5" className="p-10 text-center text-gray-400 font-medium">
                      No matching demo records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-lg space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">
              Update Demo Status
            </h2>
            <p className="text-sm text-gray-600">
              Select a status for{" "}
              <span className="font-medium text-gray-900">
                {selectedCustomer}
              </span>
              's demo.
            </p>

            <div className="space-y-2">
              <label
                htmlFor="status"
                className="block text-sm font-medium text-gray-700"
              >
                Status
              </label>
              <select
                id="status"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="p-2 border rounded w-full text-sm"
              >
                <option value="Complete">Complete</option>
                <option value="Postponed">Postponed</option>
                <option value="Canceled">Canceled</option>
              </select>
            </div>

            {selectedStatus === "Postponed" && (
              <div className="space-y-2">
                <label
                  htmlFor="postpone-date"
                  className="block text-sm font-medium text-gray-700"
                >
                  Postpone Date
                </label>
                <input
                  id="postpone-date"
                  type="date"
                  value={postponeDate}
                  onChange={(e) => setPostponeDate(e.target.value)}
                  className="p-2 border rounded w-full text-sm"
                />
              </div>
            )}

            <div className="space-y-2">
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700"
              >
                Description (required)
              </label>
              <textarea
                id="description"
                rows="3"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="p-2 border rounded w-full text-sm"
                placeholder="Enter a brief description"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                onClick={() => {
                  setShowConfirm(false);
                  resetModalState();
                }}
                className="px-4 py-2 rounded border text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleStatusUpdate(
                    selectedId,
                    selectedDemoDate,
                    selectedStatus,
                    description,
                    postponeDate
                  );
                }}
                disabled={
                  !description ||
                  (selectedStatus === "Postponed" && !postponeDate)
                }
                className={`px-4 py-2 rounded text-white ${!description ||
                  (selectedStatus === "Postponed" && !postponeDate)
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700"
                  }`}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
