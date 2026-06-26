"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Eye } from "lucide-react";

export default function UpcomingInstallationsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("products"); // Default to "products"
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(50);

  // ========= ACTIONS ==========
  const handleAction = async (orderId, action) => {
    if (!orderId || !action) return;
    try {
      setLoading(true);
      const res = await fetch("/api/installation/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, action }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        alert(data.error || "Action failed");
      } else {
        alert(data.message || "Action completed successfully");
      }
      await fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to perform action");
    } finally {
      setLoading(false);
    }
  };

  // ========= FETCH DATA ==========
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/installation/upcoming?type=${typeFilter}`);
      const data = await res.json();

      setRecords(data.installations || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
      setCurrentPage(data.currentPage || 1);
    } catch (err) {
      console.error("Fetch error", err);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ========= UI HELPERS ==========
  const getRowClass = (status) => {
    if (status === "overdue") return "bg-red-100";
    if (status === "upcoming") return "bg-yellow-100";
    return "bg-white";
  };

  const dateColor = (status) => {
    return status === "overdue"
      ? "text-red-600 font-bold"
      : status === "upcoming"
      ? "text-orange-600 font-bold"
      : "text-gray-800";
  };

  const formatDays = (days) =>
    days < 0
      ? `${Math.abs(days)} days overdue`
      : days === 0
      ? "Today"
      : `In ${days} days`;

  // ================= UI START ===================
  return (
    <div className="w-full max-w-full p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-3xl font-bold">Upcoming Installations</h2>
        <p className="text-sm text-gray-600">Total: {total} records</p>
      </div>

      {/* Search + Legend */}
      <div className="flex flex-col gap-4 mb-6">
        <input
          type="text"
          placeholder="Search by model, company, employee..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-4 py-2 border rounded shadow-sm"
        />

        {/* Type Filter */}
        <div className="flex gap-3">
          <button
            onClick={() => setTypeFilter("all")}
            className={`px-4 py-2 rounded font-medium transition ${
              typeFilter === "all"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-800 hover:bg-gray-300"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setTypeFilter("products")}
            className={`px-4 py-2 rounded font-medium transition ${
              typeFilter === "products"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-800 hover:bg-gray-300"
            }`}
          >
            Products
          </button>
          <button
            onClick={() => setTypeFilter("spares")}
            className={`px-4 py-2 rounded font-medium transition ${
              typeFilter === "spares"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-800 hover:bg-gray-300"
            }`}
          >
            Spares
          </button>
        </div>

        <div className="flex gap-6">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-red-100 mr-2" />
            Overdue
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-yellow-100 mr-2" />
            Within 10 Days
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-white border mr-2" />
            Scheduled
          </div>
        </div>
      </div>

      {/** ================= MOBILE VIEW (CARDS) ================= */}
      <div className="md:hidden space-y-4">
        {records.map((r, i) => (
          <div
            key={i}
            className={`rounded-xl shadow p-4 border ${getRowClass(
              r.installation_status
            )}`}
          >
            <div className="text-lg font-bold mb-2">Order #{r.order_id}</div>

            <div className="space-y-1 text-sm">
              <p>
                <b>Invoice #:</b> {r.invoice_number || "N/A"}
              </p>
              <p>
                <b>Order #:</b> {r.order_id}
              </p>
              <p>
                <b>Serial #:</b> {r.serial_number || "N/A"}
              </p>
              <p>
                <b>Model:</b> {r.model}
              </p>
              <p>
                <b>Name:</b> {r.name}
              </p>
              <p>
                <b>Company:</b> {r.company_name}
              </p>
              <p>
                <b>Contact:</b> {r.contact}
              </p>
              <p>
                <b>Emp:</b> {r.emp_name}
              </p>
              <p>
                <b>Address:</b> {r.delivery_address}
              </p>
              <p className={`${dateColor(r.installation_status)} mt-1`}>
                <b>Delivery:</b> {r.delivery_date}
              </p>
              <p className={`${dateColor(r.installation_status)}`}>
                <b>Days:</b> {formatDays(r.days_until_installation)}
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 mt-3">
              <Link
                href={`/user-dashboard/order/${r.order_id}`}
                className="flex items-center justify-center px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                title="View Report"
              >
                <Eye size={14} className="mr-1" /> View
              </Link>
              <button
                onClick={() => handleAction(r.order_id, "INSTALLED")}
                className="w-full px-3 py-2 bg-green-600 text-white text-xs rounded hover:bg-green-700"
              >
                Installed
              </button>
            </div>
          </div>
        ))}
      </div>

      {/** ================= DESKTOP TABLE VIEW ================= */}
      <div className="hidden md:block overflow-x-auto shadow bg-white rounded">
        <table className="w-full text-sm table-auto border-collapse">
          <thead className="bg-gray-800 text-white">
            <tr>
              <th className="p-3">Invoice # | Order ID | Serial #</th>
              <th className="p-3">Model</th>
              <th className="p-3">Name</th>
              <th className="p-3">Delivery Address</th>
              <th className="p-3">Company</th>
              <th className="p-3">Contact</th>
              <th className="p-3">Emp</th>
              <th className="p-3">Delivery</th>
              <th className="p-3">Delivery</th>
              <th className="p-3">Days</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr key={i} className={getRowClass(r.installation_status)}>
                <td className="p-3 font-semibold">
                  <div className="space-y-1 text-xs">
                    <div><span className="text-blue-600 font-bold">Inv:</span> {r.invoice_number || "N/A"}</div>
                    <div><span className="text-green-600 font-bold">Ord:</span> {r.order_id}</div>
                    <div><span className="text-purple-600 font-bold">Ser:</span> {r.serial_number || "N/A"}</div>
                  </div>
                </td>
                <td className="p-3">{r.model}</td>
                <td className="p-3">{r.name}</td>
                <td className="p-3">{r.delivery_address}</td>
                <td className="p-3">{r.company_name}</td>
                <td className="p-3">{r.contact}</td>
                <td className="p-3">{r.emp_name}</td>
                <td className={`p-3 ${dateColor(r.installation_status)}`}>
                  {r.delivery_date}
                </td>
                <td className={`p-3 ${dateColor(r.installation_status)}`}>
                  {formatDays(r.days_until_installation)}
                </td>
                <td className="p-3">
                  <div className="flex flex-col gap-2 items-stretch">
                    <Link
                      href={`/user-dashboard/order/${r.order_id}`}
                      className="inline-flex justify-center items-center px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                      title="View Order / Report"
                    >
                      <Eye size={14} className="mr-1" /> View
                    </Link>
                    <button
                      onClick={() => handleAction(r.order_id, "INSTALLED")}
                      className="px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                    >
                      Installed
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
