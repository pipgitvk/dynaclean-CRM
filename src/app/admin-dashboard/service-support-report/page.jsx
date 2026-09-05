"use client";
import { useState, useEffect, useCallback } from "react";
import dayjs from "dayjs";

const formatDT = (val) =>
  val ? dayjs(val).format("DD MMM YYYY, hh:mm A") : "—";

export default function ServiceSupportReportPage() {
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [employees, setEmployees] = useState([]);
  const [customerFollowups, setCustomerFollowups] = useState([]);
  const [machineFollowups, setMachineFollowups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dateRange, setDateRange] = useState("today");
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const [activeTab, setActiveTab] = useState("customer"); // "customer" | "machine"

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    let startDate, endDate;

    const today = dayjs();
    switch (dateRange) {
      case "today":
        startDate = today.startOf("day").toISOString();
        endDate = today.endOf("day").toISOString();
        break;
      case "this_week":
        startDate = today.startOf("week").toISOString();
        endDate = today.endOf("week").toISOString();
        break;
      case "this_month":
        startDate = today.startOf("month").toISOString();
        endDate = today.endOf("month").toISOString();
        break;
      case "custom":
        startDate = dayjs(customFromDate).startOf("day").toISOString();
        endDate = dayjs(customToDate).endOf("day").toISOString();
        break;
      default:
        startDate = today.startOf("day").toISOString();
        endDate = today.endOf("day").toISOString();
    }

    try {
      const params = new URLSearchParams({ employee: selectedEmployee, startDate, endDate });
      const res = await fetch(`/api/service-support-report?${params}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setEmployees(data.employees || []);
      setCustomerFollowups(data.customerFollowups || []);
      setMachineFollowups(data.machineFollowups || []);
    } catch (err) {
      console.error(err);
      setCustomerFollowups([]);
      setMachineFollowups([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedEmployee, dateRange, customFromDate, customToDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const dateButtons = [
    { key: "today", label: "Today" },
    { key: "this_week", label: "This Week" },
    { key: "this_month", label: "This Month" },
  ];

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      <h1 className="text-3xl font-bold text-gray-800 border-b-2 pb-2">
        Service Support Report
      </h1>

      {/* ── Filters ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Employee */}
        <div className="flex-1">
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Employee Name
          </label>
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="w-full md:w-64 px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Employees</option>
            {employees.map((emp) => (
              <option key={emp} value={emp}>{emp}</option>
            ))}
          </select>
        </div>

        {/* Date Range */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-wrap">
          <div className="flex gap-2">
            {dateButtons.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setDateRange(key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  dateRange === key
                    ? "bg-blue-600 text-white shadow"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <input
              type="date"
              value={customFromDate}
              onChange={(e) => setCustomFromDate(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            />
            <span className="text-gray-500 hidden sm:block">to</span>
            <input
              type="date"
              value={customToDate}
              onChange={(e) => setCustomToDate(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            />
            <button
              onClick={() => { if (customFromDate && customToDate) setDateRange("custom"); }}
              disabled={isLoading}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                dateRange === "custom"
                  ? "bg-blue-600 text-white shadow"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {isLoading ? "Fetching..." : "Fetch"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div
          onClick={() => setActiveTab("customer")}
          className={`cursor-pointer rounded-xl p-6 border-2 shadow-sm transition-all ${
            activeTab === "customer"
              ? "border-blue-500 bg-blue-50"
              : "border-gray-200 bg-white hover:border-blue-300"
          }`}
        >
          <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">Customer Follow-ups</p>
          <p className="text-4xl font-bold text-blue-600 mt-2">
            {isLoading ? "..." : customerFollowups.length}
          </p>
        </div>

        <div
          onClick={() => setActiveTab("machine")}
          className={`cursor-pointer rounded-xl p-6 border-2 shadow-sm transition-all ${
            activeTab === "machine"
              ? "border-purple-500 bg-purple-50"
              : "border-gray-200 bg-white hover:border-purple-300"
          }`}
        >
          <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">Machine Follow-ups</p>
          <p className="text-4xl font-bold text-purple-600 mt-2">
            {isLoading ? "..." : machineFollowups.length}
          </p>
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* ── Tabs ── */}
      <div className="flex gap-3 border-b">
        <button
          onClick={() => setActiveTab("customer")}
          className={`pb-2 px-4 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "customer"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Customer Follow-ups ({customerFollowups.length})
        </button>
        <button
          onClick={() => setActiveTab("machine")}
          className={`pb-2 px-4 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "machine"
              ? "border-purple-600 text-purple-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Machine Follow-ups ({machineFollowups.length})
        </button>
      </div>

      {/* ── Customer Followups Table ── */}
      {activeTab === "customer" && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-x-auto">
          {isLoading ? (
            <p className="p-6 text-gray-500 text-sm">Loading...</p>
          ) : customerFollowups.length === 0 ? (
            <p className="p-6 text-gray-400 text-sm">No customer follow-ups found for this period.</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-left">Followed By</th>
                  <th className="px-4 py-3 text-left">Followed Date</th>
                  <th className="px-4 py-3 text-left">Mode</th>
                  <th className="px-4 py-3 text-left">Purpose</th>
                  <th className="px-4 py-3 text-left">Notes</th>
                  <th className="px-4 py-3 text-left">Next Service Follow-up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customerFollowups.map((row, i) => (
                  <tr key={row.s_no ?? i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2 font-medium text-gray-800">
                      {row.customer_name || "—"}
                      <span className="block text-xs text-gray-400">ID: {row.customer_id}</span>
                    </td>
                    <td className="px-4 py-2">{row.customer_phone || "—"}</td>
                    <td className="px-4 py-2">{row.followed_by || "—"}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{formatDT(row.followed_date)}</td>
                    <td className="px-4 py-2">{row.comm_mode || "—"}</td>
                    <td className="px-4 py-2">
                      {row.purpose ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {row.purpose}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2 max-w-xs whitespace-pre-wrap break-words text-gray-600">
                      {row.notes || "—"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">{formatDT(row.service_next_followup)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Machine Followups Table ── */}
      {activeTab === "machine" && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-x-auto">
          {isLoading ? (
            <p className="p-6 text-gray-500 text-sm">Loading...</p>
          ) : machineFollowups.length === 0 ? (
            <p className="p-6 text-gray-400 text-sm">No machine follow-ups found for this period.</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Serial Number</th>
                  <th className="px-4 py-3 text-left">Model</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-left">Added By</th>
                  <th className="px-4 py-3 text-left">Followed At</th>
                  <th className="px-4 py-3 text-left">Next Follow-up</th>
                  <th className="px-4 py-3 text-left">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {machineFollowups.map((row, i) => (
                  <tr key={row.id ?? i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2 font-medium text-gray-800">{row.serial_number || "—"}</td>
                    <td className="px-4 py-2">{row.product_model || "—"}</td>
                    <td className="px-4 py-2">{row.contact || "—"}</td>
                    <td className="px-4 py-2">{row.added_by || "—"}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{formatDT(row.followed_at)}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{formatDT(row.next_followup_date)}</td>
                    <td className="px-4 py-2 max-w-xs whitespace-pre-wrap break-words text-gray-600">
                      {row.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
