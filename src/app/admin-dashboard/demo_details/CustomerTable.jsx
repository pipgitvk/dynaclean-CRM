"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import { Pencil } from "lucide-react";
import toast from "react-hot-toast";

export default function CustomerTable({ rows, searchParams }) {
  const router = useRouter();
  const [data, setData] = useState(rows);

  useEffect(() => {
    setData(rows);
  }, [rows]);

  // Modal state
  const [selectedId, setSelectedId] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedDemoDate, setSelectedDemoDate] = useState("");

  const [filters, setFilters] = useState({
    search: searchParams.search || "",
    date_from: searchParams.date_from || "",
    date_to: searchParams.date_to || "",
    sort: searchParams.sort || "demo_date_time",
  });

  const update = (key, value) => {
    const updated = { ...filters, [key]: value };
    setFilters(updated);
    const query = new URLSearchParams(updated).toString();
    router.push(`?${query}`);
  };

  const resetFilters = () => {
    const cleared = {
      search: "",
      date_from: "",
      date_to: "",
      sort: "demo_date_time",
    };
    setFilters(cleared);
    router.push("?");
  };

  const filtered = useMemo(() => {
    let temp = [...data];

    if (filters.search) {
      const keyword = filters.search.toLowerCase();
      temp = temp.filter((r) => {
        const demoStatus = r.demo_status || "Pending";
        return (
          Object.values(r).some((val) =>
            String(val).toLowerCase().includes(keyword)
          ) || demoStatus.toLowerCase().includes(keyword)
        );
      });
    }

    if (filters.date_from) {
      temp = temp.filter((r) =>
        dayjs(r.demo_date_time).isAfter(
          dayjs(filters.date_from).subtract(1, "day")
        )
      );
    }

    if (filters.date_to) {
      temp = temp.filter((r) =>
        dayjs(r.demo_date_time).isBefore(dayjs(filters.date_to).add(1, "day"))
      );
    }

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

  const handleStatusUpdate = async (id, demoDateRaw) => {
    const formattedDemoDate = dayjs(demoDateRaw).format("YYYY-MM-DD HH:mm:ss");

    try {
      const res = await fetch("/api/demo-registration/mark-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          demo_date_time: formattedDemoDate,
        }),
      });

      if (!res.ok) throw new Error("Failed to update");

      const updated = await res.json();

      setData((prev) =>
        prev.map((item) =>
          item.customer_id === id && item.demo_date_time === formattedDemoDate
            ? {
                ...item,
                demo_status: "Complete",
                demo_completion_date: updated.demo_completion_date,
              }
            : item
        )
      );

      toast.success("Marked as complete");
      router.refresh();
    } catch (err) {
      toast.error("Failed to update status");
      console.error(err);
    }
  };

  return (
    <div className="space-y-4 p-4">
      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
        <input
          type="text"
          value={filters.search}
          onChange={(e) => update("search", e.target.value)}
          placeholder="Search"
          className="p-2 border rounded w-full text-sm"
        />
        <input
          type="date"
          value={filters.date_from}
          onChange={(e) => update("date_from", e.target.value)}
          className="p-2 border rounded w-full text-sm"
        />
        <input
          type="date"
          value={filters.date_to}
          onChange={(e) => update("date_to", e.target.value)}
          className="p-2 border rounded w-full text-sm"
        />
        <select
          value={filters.sort}
          onChange={(e) => update("sort", e.target.value)}
          className="p-2 border rounded w-full text-sm"
        >
          <option value="demo_date_time">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="customer_name">Customer Name</option>
        </select>
        <button
          onClick={resetFilters}
          className="p-2 border rounded bg-red-100 hover:bg-red-200 text-sm"
        >
          Reset
        </button>
      </div>

      {/* Table - Visible on medium screens and larger */}
      <div className="overflow-x-auto border rounded shadow hidden md:block">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="p-3 text-left">Customer</th>
              <th className="p-3 text-left">Mobile</th>
              <th className="p-3 text-left">Company</th>
              <th className="p-3 text-left">Address</th>
              <th className="p-3 text-left">Demo Date</th>
              <th className="p-3 text-left">Machine</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Created By</th>
              <th className="p-3 text-left">Completed On</th>
              <th className="p-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length > 0 ? (
              filtered.map((item, index) => (
                <tr
                  key={index}
                  className={`hover:bg-gray-50 ${
                    item.demo_status === "Complete" ? "bg-green-50" : ""
                  }`}
                >
                  <td className="p-3">{item.customer_name}</td>
                  <td className="p-3">{item.mobile}</td>
                  <td className="p-3">{item.company}</td>
                  <td className="p-3">{item.demo_address}</td>
                  <td className="p-3">
                    {dayjs(item.demo_date_time).format("DD MMM YYYY hh:mm A")}
                  </td>
                  <td className="p-3">{item.machine1}</td>
                  <td className="p-3">{item.demo_status || "Pending"}</td>
                  <td className="p-3">{item.username}</td>
                  <td className="p-3">
                    {item.demo_completion_date
                      ? dayjs(item.demo_completion_date).format("DD MMM YYYY")
                      : "-"}
                  </td>
                  <td className="p-3">
                    <button
                      disabled={item.demo_status === "Complete"}
                      onClick={() => {
                        setSelectedId(item.customer_id);
                        setSelectedCustomer(item.customer_name);
                        setSelectedDemoDate(item.demo_date_time);
                        setShowConfirm(true);
                      }}
                      className={`p-1 rounded-full transition ${
                        item.demo_status === "Complete"
                          ? "text-gray-400 cursor-not-allowed"
                          : "text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                      }`}
                    >
                      <Pencil size={16} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="10" className="p-4 text-center text-gray-500">
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Cards - Visible on small screens */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {filtered.length > 0 ? (
          filtered.map((item, index) => (
            <div
              key={index}
              className={`bg-white p-4 rounded-lg shadow-md border border-gray-200 ${
                item.demo_status === "Complete" ? "bg-green-50" : ""
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-lg text-gray-900">
                  {item.customer_name}
                </h3>
                <span className="text-sm text-gray-50">
                  {dayjs(item.demo_date_time).format("DD MMM YYYY")}
                </span>
              </div>
              <p className="text-gray-700">
                <strong className="font-medium">Mobile:</strong> {item.mobile}
              </p>
              <p className="text-gray-700">
                <strong className="font-medium">Company:</strong> {item.company}
              </p>
              <p className="text-gray-700">
                <strong className="font-medium">Address:</strong>{" "}
                {item.demo_address}
              </p>
              <p className="text-gray-700">
                <strong className="font-medium">Demo Date & Time:</strong>{" "}
                {dayjs(item.demo_date_time).format("DD MMM YYYY hh:mm A")}
              </p>
              <p className="text-gray-700">
                <strong className="font-medium">Machine:</strong>{" "}
                {item.machine1}
              </p>
              <p className="text-gray-700 mb-2">
                <strong className="font-medium">Status:</strong>{" "}
                {item.demo_status || "Pending"}
              </p>
              <p className="text-gray-700 mb-2">
                <strong className="font-medium">Created By:</strong>{" "}
                {item.username}
              </p>
              <p className="text-gray-700 mb-4">
                <strong className="font-medium">Completed On:</strong>{" "}
                {item.demo_completion_date
                  ? dayjs(item.demo_completion_date).format("DD MMM YYYY")
                  : "-"}
              </p>

              <div className="flex justify-end">
                <button
                  disabled={item.demo_status === "Complete"}
                  onClick={() => {
                    setSelectedId(item.customer_id);
                    setSelectedCustomer(item.customer_name);
                    setSelectedDemoDate(item.demo_date_time);
                    setShowConfirm(true);
                  }}
                  className={`inline-flex items-center justify-center px-3 py-1.5 rounded transition text-sm ${
                    item.demo_status === "Complete"
                      ? "text-gray-400 bg-gray-100 cursor-not-allowed"
                      : "text-blue-600 bg-blue-100 hover:bg-blue-200"
                  }`}
                >
                  <Pencil size={16} className="mr-1" /> Mark Complete
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="p-4 text-center text-gray-500">No records found.</div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-lg space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">
              Confirm Completion
            </h2>
            <p className="text-sm text-gray-600">
              Are you sure you want to mark{" "}
              <span className="font-medium text-gray-900">
                {selectedCustomer}
              </span>
              ’s demo as{" "}
              <span className="text-green-600 font-semibold">Complete</span>?
            </p>
            <div className="flex justify-end gap-2 pt-4">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded border text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleStatusUpdate(selectedId, selectedDemoDate);
                  setShowConfirm(false);
                }}
                className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
              >
                Mark Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
