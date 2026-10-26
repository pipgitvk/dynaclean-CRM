"use client";
import { useState, useEffect, useCallback } from "react";
import dayjs from "dayjs";
import { X } from "lucide-react";

const formatDT = (val) =>
  val ? dayjs(val).format("DD MMM YYYY, hh:mm A") : "—";

const formatDate = (val) =>
  val ? dayjs(val).format("DD MMM YYYY") : "—";

const formatCurrency = (val) =>
  val != null && val !== "" ? `₹${Number(val).toLocaleString("en-IN")}` : "—";

const KPI_CARDS = [
  { key: "complaintsReceived", label: "Nos. Of Complaint Received", color: "text-red-600", border: "border-red-200 hover:border-red-300", bg: "bg-red-50" },
  { key: "complaintsResolved", label: "Nos. Of Complaint Resolved", color: "text-green-600", border: "border-green-200 hover:border-green-300", bg: "bg-green-50" },
  { key: "quotations", label: "Nos. Of Quotation", color: "text-amber-600", border: "border-amber-200 hover:border-amber-300", bg: "bg-amber-50" },
  { key: "ordersProcessed", label: "Nos. Of Order Process", color: "text-blue-600", border: "border-blue-200 hover:border-blue-300", bg: "bg-blue-50" },
  { key: "upcomingInstallations", label: "Nos. Of Upcoming Installation", color: "text-indigo-600", border: "border-indigo-200 hover:border-indigo-300", bg: "bg-indigo-50" },
  { key: "warrantyRegistered", label: "Nos. Of Product Registered In Warranty", color: "text-teal-600", border: "border-teal-200 hover:border-teal-300", bg: "bg-teal-50" },
  { key: "warrantyPending", label: "Nos. Of Product Pending Register", color: "text-orange-600", border: "border-orange-200 hover:border-orange-300", bg: "bg-orange-50" },
];

const KPI_DETAIL_COLUMNS = {
  complaintsReceived: [
    { key: "service_id", label: "Service ID" },
    { key: "service_type", label: "Type" },
    { key: "serial_number", label: "Serial No." },
    { key: "customer_name", label: "Customer" },
    { key: "contact", label: "Contact" },
    { key: "assigned_to", label: "Assigned To" },
    { key: "status", label: "Status" },
    { key: "complaint_date", label: "Complaint Date", format: "date" },
    { key: "complaint_summary", label: "Summary", wide: true },
  ],
  complaintsResolved: [
    { key: "service_id", label: "Service ID" },
    { key: "service_type", label: "Type" },
    { key: "serial_number", label: "Serial No." },
    { key: "customer_name", label: "Customer" },
    { key: "contact", label: "Contact" },
    { key: "assigned_to", label: "Assigned To" },
    { key: "status", label: "Status" },
    { key: "complaint_date", label: "Complaint Date", format: "date" },
    { key: "completed_date", label: "Completed Date", format: "date" },
    { key: "complaint_summary", label: "Summary", wide: true },
  ],
  quotations: [
    { key: "quote_number", label: "Quote No." },
    { key: "company_name", label: "Company" },
    { key: "customer_id", label: "Customer ID" },
    { key: "emp_name", label: "Employee" },
    { key: "grand_total", label: "Amount", format: "currency" },
    { key: "quote_date", label: "Quote Date", format: "date" },
    { key: "created_at", label: "Created At", format: "date" },
  ],
  ordersProcessed: [
    { key: "order_id", label: "Order ID" },
    { key: "quote_number", label: "Quote No." },
    { key: "client_name", label: "Client" },
    { key: "contact", label: "Contact" },
    { key: "created_by", label: "Created By" },
    { key: "totalamt", label: "Amount", format: "currency" },
    { key: "approval_status", label: "Status" },
    { key: "created_at", label: "Created At", format: "date" },
  ],
  upcomingInstallations: [
    { key: "order_id", label: "Order ID" },
    { key: "quote_number", label: "Quote No." },
    { key: "client_name", label: "Client" },
    { key: "company_name", label: "Company" },
    { key: "contact", label: "Contact" },
    { key: "created_by", label: "Created By" },
    { key: "delivery_date", label: "Delivery Date", format: "date" },
  ],
  warrantyRegistered: [
    { key: "serial_number", label: "Serial No." },
    { key: "customer_name", label: "Customer" },
    { key: "product_name", label: "Product" },
    { key: "model", label: "Model" },
    { key: "contact", label: "Contact" },
    { key: "created_by", label: "Registered By" },
    { key: "created_at", label: "Registered At", format: "date" },
  ],
  warrantyPending: [
    { key: "order_id", label: "Order ID" },
    { key: "quote_number", label: "Quote No." },
    { key: "client_name", label: "Client" },
    { key: "company_name", label: "Company" },
    { key: "contact", label: "Contact" },
    { key: "created_by", label: "Created By" },
    { key: "delivery_date", label: "Delivery Date", format: "date" },
  ],
};

function formatCellValue(value, format) {
  if (value == null || value === "") return "—";
  if (format === "datetime") return formatDT(value);
  if (format === "date") return formatDate(value);
  if (format === "currency") return formatCurrency(value);
  return value;
}

export default function ServiceSupportReportPage() {
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [employees, setEmployees] = useState([]);
  const [customerFollowups, setCustomerFollowups] = useState([]);
  const [machineFollowups, setMachineFollowups] = useState([]);
  const [summary, setSummary] = useState({
    complaintsReceived: 0,
    complaintsResolved: 0,
    quotations: 0,
    ordersProcessed: 0,
    upcomingInstallations: 0,
    warrantyRegistered: 0,
    warrantyPending: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [dateRange, setDateRange] = useState("today");
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const [activeTab, setActiveTab] = useState("customer"); // "customer" | "machine"
  const [kpiPopup, setKpiPopup] = useState(null);
  const [kpiDetails, setKpiDetails] = useState([]);
  const [kpiDetailsLoading, setKpiDetailsLoading] = useState(false);

  const getDateRange = useCallback(() => {
    const today = dayjs();
    switch (dateRange) {
      case "today":
        return {
          startDate: today.startOf("day").toISOString(),
          endDate: today.endOf("day").toISOString(),
        };
      case "this_week":
        return {
          startDate: today.startOf("week").toISOString(),
          endDate: today.endOf("week").toISOString(),
        };
      case "this_month":
        return {
          startDate: today.startOf("month").toISOString(),
          endDate: today.endOf("month").toISOString(),
        };
      case "custom":
        return {
          startDate: dayjs(customFromDate).startOf("day").toISOString(),
          endDate: dayjs(customToDate).endOf("day").toISOString(),
        };
      default:
        return {
          startDate: today.startOf("day").toISOString(),
          endDate: today.endOf("day").toISOString(),
        };
    }
  }, [dateRange, customFromDate, customToDate]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const { startDate, endDate } = getDateRange();

    try {
      const params = new URLSearchParams({ employee: selectedEmployee, startDate, endDate });
      const res = await fetch(`/api/service-support-report?${params}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setEmployees(data.employees || []);
      setSummary(data.summary || {
        complaintsReceived: 0,
        complaintsResolved: 0,
        quotations: 0,
        ordersProcessed: 0,
        upcomingInstallations: 0,
        warrantyRegistered: 0,
        warrantyPending: 0,
      });
      setCustomerFollowups(data.customerFollowups || []);
      setMachineFollowups(data.machineFollowups || []);
    } catch (err) {
      console.error(err);
      setCustomerFollowups([]);
      setMachineFollowups([]);
      setSummary({
        complaintsReceived: 0,
        complaintsResolved: 0,
        quotations: 0,
        ordersProcessed: 0,
        upcomingInstallations: 0,
        warrantyRegistered: 0,
        warrantyPending: 0,
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedEmployee, getDateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openKpiPopup = async (card) => {
    setKpiPopup(card);
    setKpiDetails([]);
    setKpiDetailsLoading(true);
    const { startDate, endDate } = getDateRange();
    try {
      const params = new URLSearchParams({
        employee: selectedEmployee,
        startDate,
        endDate,
        detailType: card.key,
      });
      const res = await fetch(`/api/service-support-report?${params}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setKpiDetails(data.details || []);
    } catch (err) {
      console.error(err);
      setKpiDetails([]);
    } finally {
      setKpiDetailsLoading(false);
    }
  };

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

      {/* ── KPI Summary Cards ── */}
      <div>
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Service Support Summary</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {KPI_CARDS.map(({ key, label, color, border, bg }) => (
            <button
              key={key}
              type="button"
              onClick={() => openKpiPopup({ key, label })}
              className={`rounded-xl p-5 border-2 shadow-sm transition-all text-left cursor-pointer hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400 ${border} ${bg}`}
            >
              <p className="text-xs sm:text-sm text-gray-600 font-medium leading-snug min-h-[40px]">
                {label}
              </p>
              <p className={`text-3xl sm:text-4xl font-bold mt-2 tabular-nums ${color}`}>
                {isLoading ? "..." : (summary[key] ?? 0)}
              </p>
              <p className="text-[11px] text-gray-400 mt-2">Click to view details</p>
            </button>
          ))}
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* ── Follow-up Summary Cards ── */}
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
                  <th className="px-4 py-3 text-left">Machine ID</th>
                  <th className="px-4 py-3 text-left">Service ID</th>
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
                    <td className="px-4 py-2">{row.machine_id || "—"}</td>
                    <td className="px-4 py-2">{row.service_id || "—"}</td>
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

      {kpiPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-bold text-gray-800">{kpiPopup.label}</h3>
                <p className="text-xs text-gray-500">
                  {selectedEmployee === "all" ? "All Employees" : selectedEmployee}
                  {" · "}
                  {kpiDetails.length} record{kpiDetails.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setKpiPopup(null)}
                className="p-1 rounded-full hover:bg-gray-100"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="overflow-auto flex-1 p-4">
              {kpiDetailsLoading ? (
                <p className="text-sm text-gray-500">Loading...</p>
              ) : kpiDetails.length === 0 ? (
                <p className="text-sm text-gray-400">No records found for this period.</p>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      {(KPI_DETAIL_COLUMNS[kpiPopup.key] || []).map((col) => (
                        <th key={col.key} className="px-3 py-2 text-left whitespace-nowrap">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {kpiDetails.map((row, i) => (
                      <tr key={row.id ?? row.service_id ?? row.order_id ?? row.quote_number ?? i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        {(KPI_DETAIL_COLUMNS[kpiPopup.key] || []).map((col) => (
                          <td
                            key={col.key}
                            className={`px-3 py-2 ${col.wide ? "max-w-xs whitespace-pre-wrap break-words" : "whitespace-nowrap"}`}
                          >
                            {formatCellValue(row[col.key], col.format)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
