"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import isYesterday from "dayjs/plugin/isYesterday";
import isToday from "dayjs/plugin/isToday";
import { Pencil } from "lucide-react";
import toast from "react-hot-toast";

dayjs.extend(isYesterday);
dayjs.extend(isToday);

export default function CustomerTable({ rows, searchParams }) {
  const router = useRouter();
  const [data, setData] = useState(rows);

  useEffect(() => {
    setData(rows);
  }, [rows]);

  const [selectedId, setSelectedId] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedDemoDate, setSelectedDemoDate] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("Complete");
  const [description, setDescription] = useState("");
  const [postponeDate, setPostponeDate] = useState("");

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
      temp = temp.filter((r) =>
        Object.values(r).some((val) =>
          String(val).toLowerCase().includes(keyword)
        )
      );
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

  const handleStatusUpdate = async (
    id,
    demoDateRaw,
    status,
    description,
    postponeDate
  ) => {
    const formattedDemoDate = dayjs(demoDateRaw).format("YYYY-MM-DD HH:mm:ss");

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

      const updated = await res.json();
      const updatedItem = updated.updatedItem;

      setData((prev) =>
        prev.map((item) =>
          item.customer_id === id && item.demo_date_time === formattedDemoDate
            ? {
                ...item,
                ...updatedItem,
              }
            : item
        )
      );

      toast.success("Status updated successfully!");
      router.refresh();
      setShowConfirm(false);
      resetModalState();
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

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
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

      {/* Table */}
      <div className="overflow-x-auto border rounded shadow">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="p-3 text-left">Customer</th>
              <th className="p-3 text-left hidden sm:table-cell">Mobile</th>
              <th className="p-3 text-left hidden md:table-cell">Company</th>
              <th className="p-3 text-left hidden lg:table-cell">Address</th>
              <th className="p-3 text-left">Demo Date</th>
              <th className="p-3 text-left hidden xl:table-cell">Machine</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Description</th>
              <th className="p-3 text-left">Postponed Date</th>
              <th className="p-3 text-left">Completed On</th>
              <th className="p-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((item, index) => {
              const demoDate = dayjs(item.demo_date_time);
              const isOverdue =
                demoDate.isBefore(dayjs().startOf("day")) &&
                item.demo_status !== "Complete" &&
                item.demo_status !== "Canceled";

              let rowClass = "hover:bg-gray-50";
              if (item.demo_status === "Complete") {
                rowClass = "bg-green-50 hover:bg-green-100";
              } else if (item.demo_status === "Canceled") {
                rowClass = "bg-red-50 hover:bg-red-100";
              } else if (isOverdue) {
                rowClass = "bg-red-100 hover:bg-red-200";
              }

              return (
                <tr key={index} className={rowClass}>
                  <td className="p-3">{item.customer_name}</td>
                  <td className="p-3 hidden sm:table-cell">{item.mobile}</td>
                  <td className="p-3 hidden md:table-cell">{item.company}</td>
                  <td className="p-3 hidden lg:table-cell">
                    {item.demo_address}
                  </td>
                  <td className="p-3">
                    {dayjs(item.demo_date_time).format("DD MMM YYYY hh:mm A")}
                  </td>
                  <td className="p-3 hidden xl:table-cell">{item.machine1}</td>
                  <td className="p-3">{item.demo_status || "Pending"}</td>
                  <td className="p-3">
                    {item.completion_description ||
                      item.cancel_description ||
                      item.postponed_description ||
                      "-"}
                  </td>
                  <td className="p-3">
                    {item.postponed_date
                      ? dayjs(item.postponed_date).format("DD MMM YYYY")
                      : "-"}
                  </td>
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
                        item.demo_status === "Complete" ||
                        item.demo_status === "Canceled"
                          ? "text-gray-400 cursor-not-allowed"
                          : "text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                      }`}
                    >
                      <Pencil size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-4 text-center text-gray-500">No records found.</div>
        )}
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
                className={`px-4 py-2 rounded text-white ${
                  !description ||
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
