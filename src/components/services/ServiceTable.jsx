"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Modal from "./Modal";
import ServiceAttachmentLink from "./ServiceAttachmentLink";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function ServiceTable({ serviceRecords, role }) {
  const [records, setRecords] = useState(serviceRecords || []);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [complaintDateFilter, setComplaintDateFilter] = useState("");
  const [complaintDateFrom, setComplaintDateFrom] = useState("");
  const [complaintDateTo, setComplaintDateTo] = useState("");
  const [serviceTypeFilter, setServiceTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [assignedFilter, setAssignedFilter] = useState("");
  const [assignedToFilter, setAssignedToFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Status change modal state
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusForm, setStatusForm] = useState({
    service_id: null,
    currentStatus: "",
    newStatus: "",
    description: "",
  });
  const [statusError, setStatusError] = useState("");
  const [isStatusSubmitting, setIsStatusSubmitting] = useState(false);

  // Assign modal state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignServiceId, setAssignServiceId] = useState(null);
  const [assignEngineer, setAssignEngineer] = useState("NOT ASSIGNED");
  const [engineers, setEngineers] = useState([]);
  const [isAssignSubmitting, setIsAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState("");

  useEffect(() => {
    setRecords(serviceRecords || []);
  }, [serviceRecords]);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const dashboardPath =
    role?.toLowerCase() === "superadmin" ? "admin-dashboard" : "user-dashboard";

  // Helper: format dates safely
  const formatDate = (value) => {
    if (!value) return "";
    if (value instanceof Date) return value.toDateString();
    if (!isNaN(Date.parse(value))) return new Date(value).toDateString();
    return value;
  };

  // Sort logic
  const sortedRecords = [...records].sort((a, b) => {
    if (sortConfig.key !== null) {
      const aValue = a[sortConfig.key] || "";
      const bValue = b[sortConfig.key] || "";
      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
    }
    return 0;
  });

  // Universal search across all fields including company name
  const filteredRecords = sortedRecords.filter((record) => {
    // Search filter
    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      const searchMatch =
        Object.values(record).some((value) =>
          value?.toString().toLowerCase().includes(lowerSearch),
        ) || record.customer_name?.toLowerCase().includes(lowerSearch);

      if (!searchMatch) return false;
    }

    // // Complaint Date filter
    // if (complaintDateFilter && record.complaint_date) {
    //   const recordDate = new Date(record.complaint_date)
    //     .toISOString()
    //     .split("T")[0];
    //   if (recordDate !== complaintDateFilter) return false;
    // }

    // Complaint Date Range Filter
    if ((complaintDateFrom || complaintDateTo) && record.complaint_date) {
      const recordDate = new Date(record.complaint_date)
        .toISOString()
        .split("T")[0];

      // If FROM date is given
      if (complaintDateFrom && recordDate < complaintDateFrom) {
        return false;
      }

      // If TO date is given
      if (complaintDateTo && recordDate > complaintDateTo) {
        return false;
      }
    }

    // Service Type filter
    if (serviceTypeFilter && record.service_type !== serviceTypeFilter) {
      return false;
    }

    // Status filter
    if (
      statusFilter &&
      record.status?.toUpperCase() !== statusFilter.toUpperCase()
    ) {
      return false;
    }

    // Assigned filter
    if (assignedFilter === "NOT_ASSIGNED" && record.assigned_to) {
      return false;
    }
    if (assignedFilter === "ASSIGNED" && !record.assigned_to) {
      return false;
    }

    // Assigned-to engineer filter
    if (assignedToFilter && record.assigned_to !== assignedToFilter) {
      return false;
    }

    return true;
  });

  // Deduplicate by service_id
  const uniqueRecords = Array.from(
    new Map(filteredRecords.map((r) => [r.service_id, r])).values(),
  );

  // Handlers
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === "asc" ? (
      <span className="ml-1">▲</span>
    ) : (
      <span className="ml-1">▼</span>
    );
  };

  const openDetailsModal = (record) => {
    setSelectedService(record);
    setIsModalOpen(true);
  };

  const closeDetailsModal = () => {
    setIsModalOpen(false);
    setSelectedService(null);
  };

  const handleResetSearch = () => {
    setSearchTerm("");
    setComplaintDateFilter("");
    setServiceTypeFilter("");
    setStatusFilter("");
    setAssignedFilter("");
    setAssignedToFilter("");
    setCurrentPage(1);
  };

  // Get unique values for filters
  const uniqueServiceTypes = [
    ...new Set(records.map((r) => r.service_type).filter(Boolean)),
  ];
  const uniqueStatuses = [
    ...new Set(records.map((r) => r.status).filter(Boolean)),
  ];
  const uniqueEngineers = [
    ...new Set(records.map((r) => r.assigned_to).filter(Boolean)),
  ].sort();

  // Status options for the change-status modal (ensure Pending By Customer is available)
  const statusOptions = Array.from(
    new Set([...uniqueStatuses.filter(Boolean), "PENDING BY CUSTOMER"]),
  );

  // Calculate KPIs — all from full unfiltered records so they never change with filters
  const kpiData = {
    total: records.length,
    completed: records.filter((r) => r.status?.toUpperCase() === "COMPLETED").length,
    pending: records.filter((r) => r.status?.toUpperCase() === "PENDING").length,
    pendingSpares: records.filter((r) => r.status?.toUpperCase() === "PENDING FOR SPARES").length,
    pendingByCustomer: records.filter((r) => r.status?.toUpperCase() === "PENDING BY CUSTOMER").length,
  };

  // Calculate completion percentage
  const completionPercentage =
    kpiData.total > 0
      ? Math.round((kpiData.completed / kpiData.total) * 100)
      : 0;

  // Pagination derived values
  const totalItems = uniqueRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedRecords = uniqueRecords.slice(startIndex, endIndex);

  // Status change helpers
  const openStatusModal = (record) => {
    setStatusError("");
    setStatusForm({
      service_id: record.service_id,
      currentStatus: record.status || "",
      newStatus: record.status || "",
      description: record.status_description || "",
    });
    setIsStatusModalOpen(true);
  };

  const closeStatusModal = () => {
    if (isStatusSubmitting) return;
    setIsStatusModalOpen(false);
    setStatusError("");
  };

  const handleStatusFieldChange = (field, value) => {
    setStatusForm((prev) => ({ ...prev, [field]: value }));
    if (field === "newStatus" || field === "description") {
      setStatusError("");
    }
  };

  const handleStatusSubmit = async () => {
    if (!statusForm.service_id || !statusForm.newStatus) {
      setStatusError("Please select a status.");
      return;
    }

    const newStatus = statusForm.newStatus.trim();
    const requiresDescription =
      newStatus.toUpperCase() === "PENDING BY CUSTOMER";
    const description = (statusForm.description || "").trim();

    if (requiresDescription && !description) {
      setStatusError(
        "Description is required when status is PENDING BY CUSTOMER.",
      );
      return;
    }

    try {
      setIsStatusSubmitting(true);
      setStatusError("");

      const res = await fetch("/api/service-status/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          service_id: statusForm.service_id,
          status: newStatus,
          description: requiresDescription ? description : description || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to update status.");
      }

      // Optimistically update local records so UI reflects change immediately
      setRecords((prev) =>
        prev.map((r) =>
          r.service_id === statusForm.service_id
            ? { ...r, status: newStatus, status_description: description }
            : r,
        ),
      );

      setIsStatusModalOpen(false);
    } catch (err) {
      setStatusError(err.message || "Something went wrong.");
    } finally {
      setIsStatusSubmitting(false);
    }
  };

  const openAssignModal = async (record) => {
    setAssignServiceId(record.service_id);
    setAssignEngineer(record.assigned_to || "NOT ASSIGNED");
    setAssignError("");
    setIsAssignModalOpen(true);
    try {
      const res = await fetch("/api/reps");
      const data = await res.json();
      setEngineers(data.users?.map((u) => u.username) || []);
    } catch {
      setEngineers([]);
    }
  };

  const closeAssignModal = () => {
    if (isAssignSubmitting) return;
    setIsAssignModalOpen(false);
    setAssignError("");
  };

  const handleAssignSubmit = async () => {
    if (!assignServiceId || !assignEngineer) {
      setAssignError("Please select an engineer.");
      return;
    }
    setIsAssignSubmitting(true);
    setAssignError("");
    try {
      const res = await fetch("/api/service-status/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_id: assignServiceId, assigned_to: assignEngineer }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || "Failed to assign.");
      }
      setRecords((prev) =>
        prev.map((r) =>
          r.service_id === assignServiceId ? { ...r, assigned_to: assignEngineer } : r
        )
      );
      setIsAssignModalOpen(false);
    } catch (err) {
      setAssignError(err.message || "Something went wrong.");
    } finally {
      setIsAssignSubmitting(false);
    }
  };

  // Pie chart data — always from full records, unaffected by filters
  const pieData = [
    { name: "Completed",           value: records.filter(r => r.status?.toUpperCase() === "COMPLETED").length,           fill: "#22c55e" },
    { name: "Pending",             value: records.filter(r => r.status?.toUpperCase() === "PENDING").length,             fill: "#eab308" },
    { name: "Pending Spares",      value: records.filter(r => r.status?.toUpperCase() === "PENDING FOR SPARES").length,  fill: "#f97316" },
    { name: "Pending by Customer", value: records.filter(r => r.status?.toUpperCase() === "PENDING BY CUSTOMER").length, fill: "#ef4444" },
  ].filter(d => d.value > 0);

  return (
    <div className="w-full">
      {/* KPI Section */}
      <div className="flex flex-wrap gap-4 mb-4 items-stretch">
        {/* Stats Card */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-5 py-4">
          <div className="grid grid-cols-2 gap-x-10 gap-y-3">
            {[
              { label: "Total", value: kpiData.total, color: "text-gray-900", dot: "bg-blue-500" },
              { label: "Pending Spares", value: kpiData.pendingSpares, color: "text-orange-600", dot: "bg-orange-500" },
              { label: "Completed", value: kpiData.completed, color: "text-green-600", dot: "bg-green-500" },
              { label: "Pending by Customer", value: kpiData.pendingByCustomer, color: "text-red-600", dot: "bg-red-500" },
              { label: "Pending", value: kpiData.pending, color: "text-yellow-600", dot: "bg-yellow-500" },
              { label: "Completion %", value: `${completionPercentage}%`, color: "text-indigo-600", dot: "bg-indigo-500" },
            ].map(({ label, value, color, dot }) => (
              <div key={label} className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
                <div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wide leading-tight">{label}</p>
                  <p className={`text-xl font-bold leading-tight ${color}`}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pie Chart — uses permanent (unfiltered) counts */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-4 py-3 flex items-center">
          <ResponsiveContainer width={260} height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={95}
                dataKey="value"
                labelLine={false}
                label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
                  const RADIAN = Math.PI / 180;
                  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
                  const x = cx + radius * Math.cos(-midAngle * RADIAN);
                  const y = cy + radius * Math.sin(-midAngle * RADIAN);
                  if (percent < 0.05) return null;
                  return (
                    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="#1f2937" fontSize={11} fontWeight="600">
                      <tspan x={x} dy="-6">{name}</tspan>
                      <tspan x={x} dy="14">{`${(percent * 100).toFixed(0)}%`}</tspan>
                    </text>
                  );
                }}
              >
                {pieData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} stroke="#fff" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [value, name]}
                contentStyle={{ fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 mb-4 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search records (including company name)..."
            className="p-2 w-full border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
          <button
            onClick={handleResetSearch}
            className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors text-sm whitespace-nowrap"
          >
            Reset
          </button>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Date Range</label>
            <div className="flex items-center gap-2">
              <input type="date"
                className="p-2 w-full border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={complaintDateFrom}
                onChange={(e) => { setComplaintDateFrom(e.target.value); setCurrentPage(1); }} />
              <span className="text-gray-400 text-xs shrink-0">to</span>
              <input type="date"
                className="p-2 w-full border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={complaintDateTo}
                onChange={(e) => { setComplaintDateTo(e.target.value); setCurrentPage(1); }} />
            </div>
          </div>
          <div className="flex-1 min-w-[130px]">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Service Type</label>
            <select className="p-2 w-full border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={serviceTypeFilter} onChange={(e) => { setServiceTypeFilter(e.target.value); setCurrentPage(1); }}>
              <option value="">All Types</option>
              {uniqueServiceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[130px]">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Status</label>
            <select className="p-2 w-full border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}>
              <option value="">All Statuses</option>
              {uniqueStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Assigned</label>
            <select className="p-2 w-full border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={assignedFilter} onChange={(e) => { setAssignedFilter(e.target.value); setCurrentPage(1); }}>
              <option value="">All</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="NOT_ASSIGNED">Not Assigned</option>
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Engineer</label>
            <select className="p-2 w-full border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={assignedToFilter} onChange={(e) => { setAssignedToFilter(e.target.value); setCurrentPage(1); }}>
              <option value="">All Engineers</option>
              {uniqueEngineers.map((eng) => <option key={eng} value={eng}>{eng}</option>)}
            </select>
          </div>
        </div>
      </div>
        {/* Table (visible on larger screens) */}
        <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[82vh] bg-white rounded-lg border border-gray-200 shadow-sm">
          <table className="min-w-full text-sm text-gray-700">
            <thead className="bg-blue-600 text-white sticky top-0">
              <tr>
                <th
                  onClick={() => handleSort("service_id")}
                  className="px-6 py-3 text-left cursor-pointer"
                >
                  Service ID {getSortIndicator("service_id")}
                </th>
                <th
                  onClick={() => handleSort("serial_number")}
                  className="px-6 py-3 text-left cursor-pointer"
                >
                  Serial No. {getSortIndicator("serial_number")}
                </th>
                <th
                  onClick={() => handleSort("complaint_date")}
                  className="px-6 py-3 text-left cursor-pointer"
                >
                  Complaint Date {getSortIndicator("complaint_date")}
                </th>
                <th
                  onClick={() => handleSort("customer_name")}
                  className="px-6 py-3 text-left cursor-pointer"
                >
                  Company {getSortIndicator("customer_name")}
                </th>
                <th
                  onClick={() => handleSort("model")}
                  className="px-6 py-3 text-left cursor-pointer"
                >
                  Model {getSortIndicator("model")}
                </th>
                <th
                  onClick={() => handleSort("complaint_summary")}
                  className="px-6 py-3 text-left cursor-pointer"
                >
                  Complaint Summary {getSortIndicator("complaint_summary")}
                </th>
                <th
                  onClick={() => handleSort("installed_address")}
                  className="px-6 py-3 text-left cursor-pointer"
                >
                  Installed Address {getSortIndicator("installed_address")}
                </th>
                <th
                  onClick={() => handleSort("assigned_to")}
                  className="px-6 py-3 text-left cursor-pointer"
                >
                  Assign To {getSortIndicator("assigned_to")}
                </th>
                <th
                  onClick={() => handleSort("service_type")}
                  className="px-6 py-3 text-left cursor-pointer"
                >
                  Service Type {getSortIndicator("service_type")}
                </th>
                <th
                  onClick={() => handleSort("status")}
                  className="px-6 py-3 text-left cursor-pointer"
                >
                  Status {getSortIndicator("status")}
                </th>
                <th
                  onClick={() => handleSort("completed_date")}
                  className="px-6 py-3 text-left cursor-pointer"
                >
                  Complete Date {getSortIndicator("completed_date")}
                </th>
                {role === "ADMIN" && (
                  <th className="px-6 py-3 text-left">Company Cost</th>
                )}
                <th className="px-6 py-3 text-left text-sm font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {uniqueRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan={role === "ADMIN" ? 12 : 11}
                    className="px-6 py-3 text-center text-gray-500"
                  >
                    No service records found.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((record) => {
                  const hasReport = record.attachments;
                  let rowBackgroundColor = "";
                  if (record.status?.toUpperCase() === "COMPLETED")
                    rowBackgroundColor = "bg-green-50";
                  else if (
                    record.status?.toUpperCase() === "PENDING FOR SPARES"
                  )
                    rowBackgroundColor = "bg-orange-100";

                  return (
                    <tr
                      key={record.service_id}
                      className={`hover:bg-blue-50 transition-all duration-200 ${rowBackgroundColor}`}
                    >
                      <td className="px-6 py-3">{record.service_id}</td>
                      <td className="px-6 py-3">{record.serial_number || "—"}</td>
                      <td className="px-6 py-3">
                        {formatDate(record.complaint_date)}
                      </td>
                      <td className="px-6 py-3">
                        {record.customer_name || "N/A"}
                      </td>
                      <td className="px-6 py-3 max-w-[160px] whitespace-normal break-words">
                        <div className="text-sm text-gray-700">
                          {record.model || "N/A"}
                        </div>
                      </td>
                      <td className="px-6 py-3 max-w-[300px] whitespace-normal break-words">
                        <div className="space-y-1">
                          {record.state && (
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">State:</span> {record.state}
                            </div>
                          )}
                          <div className="text-sm">
                            {record.complaint_summary}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3 max-w-[180px] whitespace-normal break-words relative group">
                        <span>{record.installed_address}</span>

                        {/* Tooltip */}
                        <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block bg-black text-white text-xs p-2 rounded shadow-lg max-w-xs z-50 whitespace-normal break-words">
                          {record.installed_address}
                        </div>
                      </td>
                      <td className="px-6 py-3">{record.assigned_to}</td>
                      <td className="px-6 py-3">{record.service_type}</td>
                      <td className="px-6 py-3">
                        <div className="flex flex-col">
                          <span>{record.status}</span>
                          {record.status?.toUpperCase() ===
                            "PENDING BY CUSTOMER" &&
                            record.status_description && (
                              <span className="text-xs text-gray-600 mt-1 break-words max-w-xs">
                                {record.status_description}
                              </span>
                            )}
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        {formatDate(record.completed_date)}
                      </td>

                      {role === "ADMIN" && (
                        <td className="px-6 py-3">
                          {record.company_cost ? (
                            record.company_cost
                          ) : (
                            <Link
                              href={`/${dashboardPath}/warranty/service-records/cost/${record.service_id}`}
                              className="inline-block px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
                            >
                              Update Cost
                            </Link>
                          )}
                        </td>
                      )}

                      <td className="px-6 py-3 text-right text-sm font-medium">
                        <div className="flex flex-col space-y-2">
                          {record.status?.toUpperCase() !== "COMPLETED" ? (
                            <>
                              {(role === "ADMIN" ||
                                role === "SERVICE HEAD" ||
                                role === "SERVICE SUPPORT") && (
                                <button
                                  onClick={() => openAssignModal(record)}
                                  className="inline-block px-3 py-1 text-sm bg-indigo-500 text-white rounded-md hover:bg-indigo-600 text-center"
                                >
                                  Assign
                                </button>
                              )}
                              <Link
                                href={`/${dashboardPath}/complete-service/${record.service_id}`}
                                className="inline-block px-3 py-1 text-sm bg-purple-500 text-white rounded-md hover:bg-purple-600 text-center"
                              >
                                Complete Service
                              </Link>
                            </>
                          ) : record.status?.toUpperCase() === "COMPLETED" &&
                            (Number(record.view_status) === 1 ||
                              record.installation_report === "uploadFO") ? (
                            <a
                              href={`/${dashboardPath}/view-service-report/${record.service_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block px-3 py-1 text-sm bg-green-700 text-white rounded-md hover:bg-green-800 text-center"
                            >
                              View Report
                            </a>
                          ) : record.final_report_path ? (
                            <a
                              href={
                                record.final_report_path.startsWith("http")
                                  ? record.final_report_path
                                  : `https://service.dynacleanindustries.com/${record.final_report_path}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block px-3 py-1 text-sm bg-green-700 text-white rounded-md hover:bg-green-800 text-center"
                            >
                              View Report
                            </a>
                          ) : record.installation_report &&
                            record.installation_report.includes(",") ? (
                            <div className="flex flex-col space-y-1">
                              {record.installation_report
                                .split(",")
                                .filter(Boolean)
                                .map((file, index) => (
                                  <ServiceAttachmentLink
                                    key={index}
                                    filePath={file.trim()}
                                    fileName={`Report ${index + 1}`}
                                    className="inline-block px-2 py-1 text-xs bg-green-700 text-white rounded-md hover:bg-green-800 text-center"
                                  />
                                ))}
                            </div>
                          ) : (
                            <Link
                              href={`/${dashboardPath}/update-service/${record.service_id}`}
                              className="inline-block px-3 py-1 text-sm bg-purple-500 text-white rounded-md hover:bg-purple-600 text-center"
                            >
                              Generate/Upload Report
                            </Link>
                          )}

                          {(role === "ADMIN" ||
                            role === "SUPERADMIN" ||
                            role === "TEAM LEADER" ||
                            role === "SERVICE HEAD" ||
                            role === "SERVICE SUPPORT") &&
                            record.status?.toUpperCase() !== "COMPLETED" && (
                              <button
                                onClick={() => openStatusModal(record)}
                                className="inline-block px-3 py-1 text-sm bg-yellow-600 text-white rounded-md hover:bg-yellow-700 text-center"
                              >
                                Change Status
                              </button>
                            )}

                          <button
                            onClick={() => openDetailsModal(record)}
                            className="inline-block px-3 py-1 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 text-center"
                          >
                            View Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {/* Pagination Controls - Desktop */}
          <div className="flex flex-col sm:flex-row items-center justify-between px-2 sm:px-4 py-3 border-t border-gray-200 gap-2">
            <div className="text-xs sm:text-sm text-gray-600">
              Showing {Math.min(totalItems, startIndex + 1)} to{" "}
              {Math.min(endIndex, totalItems)} of {totalItems}
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <select
                className="border rounded px-2 py-1 text-xs sm:text-sm"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}/page
                  </option>
                ))}
              </select>
              <button
                className="px-2 py-1 text-xs sm:text-sm bg-gray-100 rounded disabled:opacity-50"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage === 1}
              >
                Prev
              </button>
              <span className="text-xs sm:text-sm text-gray-700">
                Page {safeCurrentPage} / {totalPages}
              </span>
              <button
                className="px-2 py-1 text-xs sm:text-sm bg-gray-100 rounded disabled:opacity-50"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={safeCurrentPage === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Card view (visible on small screens) */}
        <div className="md:hidden mt-4 space-y-3">
          {paginatedRecords.length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              No service records found.
            </div>
          ) : (
            paginatedRecords.map((record) => {
              const hasReport = record.attachments;
              let cardBackgroundColor = "";
              if (record.status?.toUpperCase() === "COMPLETED")
                cardBackgroundColor = "bg-green-50";
              else if (record.status?.toUpperCase() === "PENDING FOR SPARES")
                cardBackgroundColor = "bg-orange-100";

              return (
                <div
                  key={record.service_id}
                  className={`bg-white shadow-md rounded-lg p-4 space-y-2 ${cardBackgroundColor}`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg text-blue-600">
                      Service ID: {record.service_id}
                    </span>
                    <div className="flex flex-col items-end max-w-[50%]">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          record.status?.toUpperCase() === "COMPLETED"
                            ? "bg-green-200 text-green-800"
                            : record.status?.toUpperCase() ===
                                "PENDING FOR SPARES"
                              ? "bg-orange-200 text-orange-800"
                              : "bg-gray-200 text-gray-800"
                        }`}
                      >
                        {record.status}
                      </span>
                      {record.status?.toUpperCase() === "PENDING BY CUSTOMER" &&
                        record.status_description && (
                          <span className="mt-1 text-[11px] text-gray-700 text-right break-words">
                            {record.status_description}
                          </span>
                        )}
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-500">
                      <span className="font-semibold text-gray-700">
                        Complaint Date:
                      </span>{" "}
                      {formatDate(record.complaint_date)}
                    </p>
                    <p className="text-gray-500">
                      <span className="font-semibold text-gray-700">
                        Company:
                      </span>{" "}
                      {record.customer_name || "N/A"}
                    </p>
                    <p className="text-gray-500">
                      <span className="font-semibold text-gray-700">
                        Assigned To:
                      </span>{" "}
                      {record.assigned_to}
                    </p>
                    <p className="text-gray-500">
                      <span className="font-semibold text-gray-700">
                        Service Type:
                      </span>{" "}
                      {record.service_type}
                    </p>
                  </div>
                  <div className="border-t border-gray-200 pt-2">
                    {record.model && (
                      <p className="text-gray-500">
                        <span className="font-semibold text-gray-700">
                          Model:
                        </span>{" "}
                        {record.model}
                      </p>
                    )}
                    {record.state && (
                      <p className="text-gray-500">
                        <span className="font-semibold text-gray-700">
                          State:
                        </span>{" "}
                        {record.state}
                      </p>
                    )}
                    <p className="text-gray-500">
                      <span className="font-semibold text-gray-700">
                        Issue:
                      </span>{" "}
                      {record.complaint_summary}
                    </p>
                    <p className="text-gray-500">
                      <span className="font-semibold text-gray-700">
                        Address:
                      </span>{" "}
                      {record.installed_address}
                    </p>
                  </div>
                  {role === "ADMIN" && (
                    <div className="border-t border-gray-200 pt-2">
                      <p className="text-gray-500">
                        <span className="font-semibold text-gray-700">
                          Company Cost:
                        </span>{" "}
                        {record.company_cost ? (
                          record.company_cost
                        ) : (
                          <Link
                            href={`/${dashboardPath}/warranty/service-records/cost/${record.service_id}`}
                            className="inline-block px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
                          >
                            Update Cost
                          </Link>
                        )}
                      </p>
                    </div>
                  )}
                  <div className="flex flex-col space-y-2 mt-4">
                    {record.status?.toUpperCase() !== "COMPLETED" ? (
                      <>
                        {role === "ADMIN" && (
                          <button
                            onClick={() => openAssignModal(record)}
                            className="px-3 py-2 text-sm bg-indigo-500 text-white rounded-md hover:bg-indigo-600 text-center"
                          >
                            Assign
                          </button>
                        )}
                        <Link
                          href={`/${dashboardPath}/complete-service/${record.service_id}`}
                          className="px-3 py-2 text-sm bg-purple-500 text-white rounded-md hover:bg-purple-600 text-center"
                        >
                          Complete Service
                        </Link>
                      </>
                    ) : record.status?.toUpperCase() === "COMPLETED" &&
                      (Number(record.view_status) === 1 ||
                        record.installation_report === "uploadFO") ? (
                      <a
                        href={`/${dashboardPath}/view-service-report/${record.service_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 text-sm bg-green-700 text-white rounded-md hover:bg-green-800 text-center"
                      >
                        View Report
                      </a>
                    ) : record.final_report_path ? (
                      <a
                        href={
                          record.final_report_path.startsWith("http")
                            ? record.final_report_path
                            : `https://service.dynacleanindustries.com/${record.final_report_path}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 text-sm bg-green-700 text-white rounded-md hover:bg-green-800 text-center"
                      >
                        View Report
                      </a>
                    ) : record.installation_report &&
                      record.installation_report.includes(",") ? (
                      <div className="flex flex-wrap gap-1">
                        {record.installation_report
                          .split(",")
                          .filter(Boolean)
                          .map((file, index) => (
                            <ServiceAttachmentLink
                              key={index}
                              filePath={file.trim()}
                              fileName={`Report ${index + 1}`}
                              className="px-2 py-1 text-xs bg-green-700 text-white rounded-md hover:bg-green-800 text-center"
                            />
                          ))}
                      </div>
                    ) : record.installation_report &&
                      record.installation_report !== "uploadFO" ? (
                      <ServiceAttachmentLink
                        filePath={
                          record.installation_report ||
                          record.attachments?.split(",")[0]
                        }
                        fileName="View Report"
                        className="px-3 py-2 text-sm bg-green-700 text-white rounded-md hover:bg-green-800 text-center"
                      />
                    ) : (
                      <Link
                        href={`/${dashboardPath}/update-service/${record.service_id}`}
                        className="px-3 py-2 text-sm bg-purple-500 text-white rounded-md hover:bg-purple-600 text-center"
                      >
                        Generate/Upload Report
                      </Link>
                    )}
                    {role === "ADMIN" &&
                      record.status?.toUpperCase() !== "COMPLETED" && (
                        <button
                          onClick={() => openStatusModal(record)}
                          className="px-3 py-2 text-sm bg-yellow-600 text-white rounded-md hover:bg-yellow-700 text-center"
                        >
                          Change Status
                        </button>
                      )}
                    <button
                      onClick={() => openDetailsModal(record)}
                      className="px-3 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 text-center"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              );
            })
          )}
          {/* Pagination Controls - Mobile */}
          <div className="flex items-center justify-between mt-2">
            <button
              className="px-3 py-1 text-xs bg-gray-100 rounded disabled:opacity-50"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage === 1}
            >
              Prev
            </button>
            <span className="text-xs text-gray-700">
              Page {safeCurrentPage} / {totalPages}
            </span>
            <button
              className="px-3 py-1 text-xs bg-gray-100 rounded disabled:opacity-50"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>

      {/* Details Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeDetailsModal}
        title={`Service Details (ID: ${selectedService?.service_id})`}
        selectedService={selectedService}
        baseUrl={baseUrl}
      />

      {/* Status Change Modal */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Change Status (Service ID: {statusForm.service_id})
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Status
                </label>
                <input
                  type="text"
                  value={statusForm.currentStatus || "-"}
                  readOnly
                  className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Status
                </label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  value={statusForm.newStatus || ""}
                  onChange={(e) =>
                    handleStatusFieldChange("newStatus", e.target.value)
                  }
                >
                  <option value="">Select status</option>
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description{" "}
                  {statusForm.newStatus?.toUpperCase() ===
                    "PENDING BY CUSTOMER" && (
                    <span className="text-red-500">*</span>
                  )}
                </label>
                <textarea
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="Enter description (required if status is PENDING BY CUSTOMER)"
                  value={statusForm.description || ""}
                  onChange={(e) =>
                    handleStatusFieldChange("description", e.target.value)
                  }
                />
              </div>

              {statusError && (
                <p className="text-sm text-red-600">{statusError}</p>
              )}

              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={closeStatusModal}
                  className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
                  disabled={isStatusSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStatusSubmit}
                  className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={isStatusSubmitting}
                >
                  {isStatusSubmitting ? "Updating..." : "Update Status"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 relative">
            <button
              type="button"
              onClick={closeAssignModal}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700"
              aria-label="Close"
            >
              ✕
            </button>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Assign Service (ID: {assignServiceId})
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign To
                </label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  value={assignEngineer}
                  onChange={(e) => setAssignEngineer(e.target.value)}
                >
                  <option value="NOT ASSIGNED">NOT ASSIGNED</option>
                  {engineers.length > 0 ? (
                    engineers.map((eng) => (
                      <option key={eng} value={eng}>{eng}</option>
                    ))
                  ) : (
                    <option disabled>Loading...</option>
                  )}
                </select>
              </div>
              {assignError && (
                <p className="text-sm text-red-600">{assignError}</p>
              )}
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={closeAssignModal}
                  className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
                  disabled={isAssignSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssignSubmit}
                  className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                  disabled={isAssignSubmitting}
                >
                  {isAssignSubmitting ? "Assigning..." : "Assign"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
