"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Modal from "./Modal";
import ServiceAttachmentLink from "./ServiceAttachmentLink";
import ServiceReportPrintButton from "./ServiceReportPrintButton";
import ServiceCompletionDateCell from "./ServiceCompletionDateCell";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import {
  Eye,
  ExternalLink,
  FilePlus,
  RefreshCw,
  Upload,
  UserPlus,
} from "lucide-react";
import { useWarrantyProductFollowup } from "@/components/warranty/WarrantyProductFollowupControls";
import ServiceRecordFollowupActions from "@/components/services/ServiceRecordFollowupActions";

const actionIconClass =
  "inline-flex items-center justify-center p-1.5 rounded-md text-white transition-colors";

/** warranty_products JOIN can return multiple rows per service_id — keep one row per service. */
function dedupeServiceRecords(rows) {
  return Array.from(
    new Map((rows || []).map((row) => [row.service_id, row])).values(),
  );
}

export default function ServiceTable({ serviceRecords, role }) {
  const [records, setRecords] = useState(() => dedupeServiceRecords(serviceRecords));
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
    plannedDate: "",
  });
  const [statusError, setStatusError] = useState("");
  const [isStatusSubmitting, setIsStatusSubmitting] = useState(false);
  const [plannedDatePopup, setPlannedDatePopup] = useState(null);
  const [plannedPopupError, setPlannedPopupError] = useState("");
  const [plannedPopupSaving, setPlannedPopupSaving] = useState(false);
  const [inlinePlannedDateSavingId, setInlinePlannedDateSavingId] = useState(null);

  // Assign modal state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignServiceId, setAssignServiceId] = useState(null);
  const [assignEngineer, setAssignEngineer] = useState("NOT ASSIGNED");
  const [engineers, setEngineers] = useState([]);
  const [isAssignSubmitting, setIsAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState("");

  const { ProductFollowupIcons, followupModals } = useWarrantyProductFollowup();

  useEffect(() => {
    setRecords(dedupeServiceRecords(serviceRecords));
  }, [serviceRecords]);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const pathname = usePathname();
  const dashboardPath = (() => {
    const seg = pathname?.split("/").filter(Boolean)[0];
    if (seg?.endsWith("-dashboard")) return seg;
    return role?.toLowerCase() === "superadmin" ? "admin-dashboard" : "user-dashboard";
  })();

  const parseReportIds = (reportIds) =>
    String(reportIds || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

  const getReportDateById = (record, reportId) => {
    const ids = parseReportIds(record.report_ids);
    const dates = String(record.report_dates || "")
      .split(",")
      .map((date) => date.trim());
    const index = ids.indexOf(String(reportId));
    return index >= 0 ? dates[index] || "" : "";
  };

  const handleFollowupUpdated = (serviceId, patch) => {
    setRecords((prev) =>
      prev.map((record) =>
        record.service_id === serviceId ? { ...record, ...patch } : record
      )
    );
  };

  const handleRecordImagesUpdated = (serviceId, preCompletion, afterCompletion) => {
    setRecords((prev) =>
      prev.map((record) =>
        record.service_id === serviceId
          ? {
              ...record,
              pre_completion: preCompletion,
              after_completion: afterCompletion,
            }
          : record
      )
    );
    setSelectedService((prev) =>
      prev?.service_id === serviceId
        ? {
            ...prev,
            pre_completion: preCompletion,
            after_completion: afterCompletion,
          }
        : prev
    );
  };

  const renderReportLinks = (record) => {
    const ids = parseReportIds(record.report_ids);
    if (!ids.length) {
      return <span className="text-gray-400">—</span>;
    }
    return (
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        {ids.map((id, index) => (
          <span key={id}>
            <ServiceReportPrintButton
              serviceId={record.service_id}
              reportId={id}
              reportDate={getReportDateById(record, id)}
              dashboardPath={dashboardPath}
              preCompletion={record.pre_completion}
              afterCompletion={record.after_completion}
              onRecordImagesUpdated={(pre, after) =>
                handleRecordImagesUpdated(record.service_id, pre, after)
              }
              label={id}
              variant="link"
            />
            {index < ids.length - 1 ? "," : ""}
          </span>
        ))}
      </div>
    );
  };

  const renderRowActionIcons = (record) => (
    <>
      {record.status?.toUpperCase() !== "COMPLETED" &&
        (role === "ADMIN" ||
          role === "SERVICE HEAD" ||
          role === "SERVICE SUPPORT") && (
          <button
            type="button"
            onClick={() => openAssignModal(record)}
            title="Assign"
            className={`${actionIconClass} bg-indigo-500 hover:bg-indigo-600`}
          >
            <UserPlus className="w-4 h-4" />
          </button>
        )}
      <Link
        href={
          String(record.service_type || "").trim().toUpperCase() === "COMPLAINT" &&
          (dashboardPath === "admin-dashboard" || dashboardPath === "user-dashboard" || dashboardPath === "accounts-dashboard")
            ? `/${dashboardPath}/service-report-steps/${record.service_id}`
            : String(record.service_type || "").trim().toUpperCase() === "INSTALLATION"
              ? `/${dashboardPath}/installation-completion-video/${record.service_id}`
              : `/${dashboardPath}/complete-service/${record.service_id}`
        }
        title="+ Make Report"
        className={`${actionIconClass} bg-purple-500 hover:bg-purple-600`}
      >
        <FilePlus className="w-4 h-4" />
      </Link>
      {record.status?.toUpperCase() === "COMPLETED" &&
        (record.final_report_path ? (
          <a
            href={
              record.final_report_path.startsWith("http")
                ? record.final_report_path
                : `https://service.dynacleanindustries.com/${record.final_report_path}`
            }
            target="_blank"
            rel="noopener noreferrer"
            title="View Report"
            className={`${actionIconClass} bg-green-700 hover:bg-green-800`}
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        ) : record.installation_report &&
          record.installation_report.includes(",") ? (
          record.installation_report
            .split(",")
            .filter(Boolean)
            .map((file, index) => (
              <ServiceAttachmentLink
                key={index}
                filePath={file.trim()}
                fileName={`Report ${index + 1}`}
                iconOnly
              />
            ))
        ) : record.installation_report &&
          record.installation_report !== "uploadFO" ? (
          <ServiceAttachmentLink
            filePath={
              record.installation_report || record.attachments?.split(",")[0]
            }
            fileName="View Report"
            iconOnly
          />
        ) : (
          <Link
            href={`/${dashboardPath}/update-service/${record.service_id}`}
            title="Generate/Upload Report"
            className={`${actionIconClass} bg-purple-500 hover:bg-purple-600`}
          >
            <Upload className="w-4 h-4" />
          </Link>
        ))}
      {(role === "ADMIN" ||
        role === "SUPERADMIN" ||
        role === "TEAM LEADER" ||
        role === "SERVICE HEAD" ||
        role === "SERVICE SUPPORT") &&
        record.status?.toUpperCase() !== "COMPLETED" && (
          <button
            type="button"
            onClick={() => openStatusModal(record)}
            title="Change Status"
            className={`${actionIconClass} bg-yellow-600 hover:bg-yellow-700`}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      <button
        type="button"
        onClick={() => openDetailsModal(record)}
        title="View Details"
        className={`${actionIconClass} bg-gray-600 hover:bg-gray-700`}
      >
        <Eye className="w-4 h-4" />
      </button>
    </>
  );

  const STEP_VIDEOS = [
    { key: "video_360", label: "360°" },
    { key: "video_problem", label: "Problem" },
    { key: "video_damaged", label: "Damaged" },
    { key: "video_completion", label: "Completion" },
  ];

  const showStepVideos =
    dashboardPath === "admin-dashboard" || dashboardPath === "user-dashboard";

  const renderStepVideos = (record) => {
    const serviceType = String(record.service_type || "").trim().toUpperCase();
    
    if (serviceType === "COMPLAINT") {
      // Show complaint step videos
      const videos = STEP_VIDEOS.filter((step) => record[step.key]);
      if (!videos.length) {
        return <span className="text-gray-400">No videos</span>;
      }
      return (
        <div className="flex flex-col gap-1 min-w-[110px]">
          {videos.map((step) => (
            <a
              key={step.key}
              href={record[step.key]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {step.label}
            </a>
          ))}
        </div>
      );
    } else if (serviceType === "INSTALLATION") {
      // Show installation completion video
      if (record.video_completion) {
        return (
          <div className="flex flex-col gap-1 min-w-[110px]">
            <a
              href={record.video_completion}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Installation Video
            </a>
          </div>
        );
      } else {
        return <span className="text-gray-400">No video</span>;
      }
    }
    
    return <span className="text-gray-400">—</span>;
  };

  const renderReportCell = (record) => (
    <div className="min-w-[80px]">
      {renderReportLinks(record)}
      <div
        className="flex flex-wrap items-center gap-1 mt-1 md:opacity-0 md:invisible md:group-hover:opacity-100 md:group-hover:visible transition-all duration-150"
      >
        {renderRowActionIcons(record)}
      </div>
    </div>
  );

  const showAdminServiceFollowup = dashboardPath === "admin-dashboard";
  const tableColSpan =
    (role === "ADMIN" ? 12 : 11) +
    (showStepVideos ? 1 : 0) +
    (showAdminServiceFollowup ? 1 : 0);

  // Helper: format dates safely
  const formatDate = (value) => {
    if (!value) return "";
    if (value instanceof Date) return value.toDateString();
    if (!isNaN(Date.parse(value))) return new Date(value).toDateString();
    return value;
  };

  const plannedDateForInput = (value) => {
    if (!value) return "";
    const s = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
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
    new Set([
      ...uniqueStatuses.filter(Boolean),
      "PENDING BY CUSTOMER",
      "PLANNED",
    ]),
  );

  const statusFilterOptions = Array.from(
    new Set([...uniqueStatuses.filter(Boolean), "PLANNED"]),
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
      plannedDate: plannedDateForInput(record.planned_date),
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
    if (field === "newStatus" || field === "description" || field === "plannedDate") {
      setStatusError("");
    }
  };

  const canChangeServiceStatus = (record) =>
    record.status?.toUpperCase() !== "COMPLETED" &&
    (role === "ADMIN" ||
      role === "SUPERADMIN" ||
      role === "TEAM LEADER" ||
      role === "SERVICE HEAD" ||
      role === "SERVICE SUPPORT");

  const pendingInlineStatusOptions = Array.from(
    new Set(["PENDING", "PLANNED", ...statusOptions.filter(Boolean)]),
  );

  const applyStatusUpdate = async ({
    service_id,
    status,
    description = "",
    planned_date = null,
  }) => {
    const newStatus = String(status || "").trim();
    const requiresDescription = newStatus.toUpperCase() === "PENDING BY CUSTOMER";
    const desc = (description || "").trim();
    const isPlanned = newStatus.toUpperCase() === "PLANNED";
    const plannedDate = isPlanned ? (planned_date || "").trim() : null;

    if (!service_id || !newStatus) {
      throw new Error("Please select a status.");
    }
    if (requiresDescription && !desc) {
      throw new Error("Description is required when status is PENDING BY CUSTOMER.");
    }
    if (isPlanned && !plannedDate) {
      throw new Error("Please select a planned date.");
    }

    const res = await fetch("/api/service-status/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id,
        status: newStatus,
        description: requiresDescription ? desc : desc || null,
        planned_date: isPlanned ? plannedDate : null,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Failed to update status.");
    }

    setRecords((prev) =>
      prev.map((r) =>
        r.service_id === service_id
          ? {
              ...r,
              status: newStatus,
              status_description: desc,
              planned_date: isPlanned ? plannedDate : null,
            }
          : r,
      ),
    );
  };

  const handleInlinePlannedDateChange = async (record, dateYmd) => {
    const next = (dateYmd || "").trim();
    if (!next) return;
    if (next === plannedDateForInput(record.planned_date)) return;
    try {
      setInlinePlannedDateSavingId(record.service_id);
      await applyStatusUpdate({
        service_id: record.service_id,
        status: "PLANNED",
        description: record.status_description || "",
        planned_date: next,
      });
    } catch (err) {
      window.alert(err.message || "Failed to update planned date.");
    } finally {
      setInlinePlannedDateSavingId(null);
    }
  };

  const handleInlinePendingStatusChange = (record, newStatus) => {
    const current = record.status || "PENDING";
    if (newStatus === current) return;

    if (newStatus.toUpperCase() === "PLANNED") {
      setPlannedPopupError("");
      setPlannedDatePopup({
        serviceId: record.service_id,
        plannedDate: plannedDateForInput(record.planned_date) || "",
      });
      return;
    }

    if (newStatus.toUpperCase() === "PENDING BY CUSTOMER") {
      setStatusError("");
      setStatusForm({
        service_id: record.service_id,
        currentStatus: current,
        newStatus,
        description: record.status_description || "",
        plannedDate: plannedDateForInput(record.planned_date),
      });
      setIsStatusModalOpen(true);
      return;
    }

    applyStatusUpdate({
      service_id: record.service_id,
      status: newStatus,
      description: record.status_description || "",
      planned_date: null,
    }).catch((err) => {
      window.alert(err.message || "Failed to update status.");
    });
  };

  const closePlannedDatePopup = () => {
    if (plannedPopupSaving) return;
    setPlannedDatePopup(null);
    setPlannedPopupError("");
  };

  const savePlannedDatePopup = async () => {
    if (!plannedDatePopup?.serviceId) return;
    const plannedDate = (plannedDatePopup.plannedDate || "").trim();
    if (!plannedDate) {
      setPlannedPopupError("Please select a planned date.");
      return;
    }
    try {
      setPlannedPopupSaving(true);
      setPlannedPopupError("");
      await applyStatusUpdate({
        service_id: plannedDatePopup.serviceId,
        status: "PLANNED",
        description: "",
        planned_date: plannedDate,
      });
      setPlannedDatePopup(null);
    } catch (err) {
      setPlannedPopupError(err.message || "Failed to save.");
    } finally {
      setPlannedPopupSaving(false);
    }
  };

  const renderServiceStatusCell = (record) => {
    const isPending = record.status?.toUpperCase() === "PENDING";
    const isPlanned = record.status?.toUpperCase() === "PLANNED";
    const canEdit = canChangeServiceStatus(record);

    if (canEdit && (isPending || isPlanned)) {
      return (
        <div className="flex flex-col gap-1.5 min-w-[140px]">
          <select
            className="w-full max-w-[180px] border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={record.status || "PENDING"}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => handleInlinePendingStatusChange(record, e.target.value)}
          >
            {pendingInlineStatusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {isPlanned && (
            <label className="flex flex-col gap-0.5">
              <span className="text-[11px] font-medium text-indigo-700">
                Planned date
              </span>
              <input
                type="date"
                disabled={inlinePlannedDateSavingId === record.service_id}
                className="w-full max-w-[180px] border border-indigo-200 rounded-md px-2 py-1 text-sm bg-indigo-50/40 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-60"
                value={plannedDateForInput(record.planned_date)}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) =>
                  handleInlinePlannedDateChange(record, e.target.value)
                }
              />
            </label>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col">
        <span>{record.status}</span>
        {isPlanned && record.planned_date && (
          <span className="text-xs font-medium text-indigo-700 mt-1">
            Planned: {formatDate(record.planned_date)}
          </span>
        )}
        {record.status?.toUpperCase() === "PENDING BY CUSTOMER" &&
          record.status_description && (
            <span className="text-xs text-gray-600 mt-1 break-words max-w-xs">
              {record.status_description}
            </span>
          )}
      </div>
    );
  };

  const handleStatusSubmit = async () => {
    if (!statusForm.service_id || !statusForm.newStatus) {
      setStatusError("Please select a status.");
      return;
    }

    const newStatus = statusForm.newStatus.trim();
    const description = (statusForm.description || "").trim();
    const isPlanned = newStatus.toUpperCase() === "PLANNED";
    const plannedDate = (statusForm.plannedDate || "").trim();

    try {
      setIsStatusSubmitting(true);
      setStatusError("");
      await applyStatusUpdate({
        service_id: statusForm.service_id,
        status: newStatus,
        description,
        planned_date: isPlanned ? plannedDate : null,
      });
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
   
    { name: "Pending",             value: records.filter(r => r.status?.toUpperCase() === "PENDING").length,             fill: "#f11532ff" },
    { name: "Pending Spares",      value: records.filter(r => r.status?.toUpperCase() === "PENDING FOR SPARES").length,  fill: "#f97316" },
    { name: "Pending by Customer", value: records.filter(r => r.status?.toUpperCase() === "PENDING BY CUSTOMER").length, fill: "#e6e95bff" },
  ].filter(d => d.value > 0);

  return (
    <div className="w-full">
      {/* KPI Section */}
      <div className="flex flex-wrap gap-4 mb-4 items-stretch">
        {/* Stats Card */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-5 py-4 min-w-[450px]">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            {[
              { label: "Total", value: kpiData.total, color: "text-gray-900", dot: "bg-blue-500" },
              { label: "Pending Spares", value: kpiData.pendingSpares, color: "text-orange-600", dot: "bg-orange-500" },
              { label: "Completed", value: kpiData.completed, color: "text-green-600", dot: "bg-green-500" },
              { label: "Pending by Customer", value: kpiData.pendingByCustomer, color: "text-red-600", dot: "bg-red-500" },
              { label: "Pending", value: kpiData.pending, color: "text-yellow-600", dot: "bg-yellow-500" },
              { label: "Completion %", value: `${completionPercentage}%`, color: "text-indigo-600", dot: "bg-indigo-500" },
            ].map(({ label, value, color, dot }) => (
              <div key={label} className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                  <span className="text-sm text-gray-500 whitespace-nowrap">{label}</span>
                </div>
                <span className={`text-base font-bold ${color}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pie Chart — uses permanent (unfiltered) counts */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-4 py-3 flex items-center">
          <ResponsiveContainer width={220} height={130}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={58}
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
              {statusFilterOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
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
            <thead className="sticky top-0 z-20 bg-blue-600 text-white shadow-sm [&_th]:bg-blue-600">
              <tr>
                <th
                  onClick={() => handleSort("service_id")}
                  className="bg-blue-600 px-6 py-3 text-left cursor-pointer"
                >
                  Service ID {getSortIndicator("service_id")}
                </th>
                {showAdminServiceFollowup && (
                  <th className="px-3 py-3 text-left w-[52px]">Follow-up</th>
                )}
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
                <th className="px-6 py-3 text-left">Location</th>
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
                {showStepVideos && (
                  <th className="px-6 py-3 text-left">Step Videos</th>
                )}
                <th className="px-6 py-3 text-left">Reports</th>
                {role === "ADMIN" && (
                  <th className="px-6 py-3 text-left">Company Cost</th>
                )}
              </tr>
            </thead>
            <tbody>
              {uniqueRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan={tableColSpan}
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
                  else if (record.status?.toUpperCase() === "WORKED")
                    rowBackgroundColor = "bg-amber-50";

                  return (
                    <tr
                      key={record.service_id}
                      className={`group hover:bg-blue-50 transition-all duration-200 ${rowBackgroundColor}`}
                    >
                      <td className="px-6 py-3">
                        <ProductFollowupIcons
                          product={{
                            machine_id: record.machine_id,
                            service_id: record.service_id,
                            serial_number: record.serial_number,
                            model: record.model,
                            contact: record.contact,
                            email: record.email,
                            includeCustomerFollowups: false,
                          }}
                          className="mb-1"
                        />
                        <div>{record.service_id}</div>
                        {record.serial_number && (
                          <div className="text-xs text-green-600 font-medium mt-0.5">{record.serial_number}</div>
                        )}
                      </td>
                      {showAdminServiceFollowup && (
                        <td className="px-3 py-3 align-top">
                          <ServiceRecordFollowupActions
                            record={record}
                            enabled
                            onUpdated={handleFollowupUpdated}
                          />
                        </td>
                      )}
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
                      <td className="px-6 py-3 text-xs">
                        {record.lat && record.longt ? (
                          <div className="space-y-1">
                            <div><span className="font-semibold text-gray-500">Lat:</span> {record.lat}</div>
                            <div><span className="font-semibold text-gray-500">Long:</span> {record.longt}</div>
                            <a
                              href={`https://www.google.com/maps?q=${record.lat},${record.longt}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              Maps ↗
                            </a>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3">{record.assigned_to}</td>
                      <td className="px-6 py-3">{record.service_type}</td>
                      <td className="px-6 py-3">{renderServiceStatusCell(record)}</td>
                      <td className="px-6 py-3 align-top overflow-hidden">
                        <ServiceCompletionDateCell
                          completedDate={record.completed_date}
                          preCompletion={record.pre_completion}
                          afterCompletion={record.after_completion}
                          formatDate={formatDate}
                        />
                      </td>
                      {showStepVideos && (
                        <td className="px-6 py-3">{renderStepVideos(record)}</td>
                      )}
                      <td className="px-6 py-3">{renderReportCell(record)}</td>

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
              else if (record.status?.toUpperCase() === "WORKED")
                cardBackgroundColor = "bg-amber-50";

              return (
                <div
                  key={record.service_id}
                  className={`group bg-white shadow-md rounded-lg p-4 space-y-2 ${cardBackgroundColor}`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <ProductFollowupIcons
                        product={{
                          machine_id: record.machine_id,
                          service_id: record.service_id,
                          serial_number: record.serial_number,
                          model: record.model,
                          contact: record.contact,
                          email: record.email,
                          includeCustomerFollowups: false,
                        }}
                        className="mb-1"
                      />
                      <span className="font-bold text-lg text-blue-600">
                        Service ID: {record.service_id}
                      </span>
                      {showAdminServiceFollowup && (
                        <div className="mt-2">
                          <ServiceRecordFollowupActions
                            record={record}
                            enabled
                            onUpdated={handleFollowupUpdated}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end max-w-[50%]">
                      {(record.status?.toUpperCase() === "PENDING" ||
                        record.status?.toUpperCase() === "PLANNED") &&
                      canChangeServiceStatus(record) ? (
                        <div className="flex flex-col items-end gap-1">
                          <select
                            className="max-w-[160px] border border-gray-300 rounded-md px-2 py-1 text-xs bg-white"
                            value={record.status || "PENDING"}
                            onChange={(e) =>
                              handleInlinePendingStatusChange(record, e.target.value)
                            }
                          >
                            {pendingInlineStatusOptions.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          {record.status?.toUpperCase() === "PLANNED" && (
                            <input
                              type="date"
                              disabled={inlinePlannedDateSavingId === record.service_id}
                              className="max-w-[160px] border border-indigo-200 rounded-md px-2 py-1 text-xs bg-indigo-50/40 disabled:opacity-60"
                              value={plannedDateForInput(record.planned_date)}
                              onChange={(e) =>
                                handleInlinePlannedDateChange(record, e.target.value)
                              }
                            />
                          )}
                        </div>
                      ) : (
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
                      )}
                      {record.status?.toUpperCase() === "PLANNED" &&
                        record.planned_date &&
                        !canChangeServiceStatus(record) && (
                          <span className="mt-1 text-[11px] font-medium text-indigo-700 text-right">
                            Planned: {formatDate(record.planned_date)}
                          </span>
                        )}
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
                    <div className="text-gray-500">
                      <span className="font-semibold text-gray-700">
                        Complete Date:
                      </span>
                      <div className="mt-1">
                        <ServiceCompletionDateCell
                          completedDate={record.completed_date}
                          preCompletion={record.pre_completion}
                          afterCompletion={record.after_completion}
                          formatDate={formatDate}
                        />
                      </div>
                    </div>
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
                    {showStepVideos && (
                      <div className="text-gray-500 mt-1">
                        <span className="font-semibold text-gray-700">
                          Step Videos:
                        </span>
                        <div className="mt-0.5">{renderStepVideos(record)}</div>
                      </div>
                    )}
                    <div className="text-gray-500 mt-1">
                      <span className="font-semibold text-gray-700">
                        Reports:
                      </span>
                      <div className="mt-0.5">{renderReportCell(record)}</div>
                    </div>
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
        dashboardPath={dashboardPath}
      />

      {plannedDatePopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5">
            <h3 className="text-lg font-semibold text-gray-900">
              Planned visit date
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Service ID: {plannedDatePopup.serviceId}
            </p>
            <label className="block text-sm font-medium text-gray-700 mt-4 mb-1">
              Select date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={plannedDatePopup.plannedDate || ""}
              onChange={(e) =>
                setPlannedDatePopup((p) =>
                  p ? { ...p, plannedDate: e.target.value } : p,
                )
              }
            />
            {plannedPopupError && (
              <p className="text-sm text-red-600 mt-2">{plannedPopupError}</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closePlannedDatePopup}
                disabled={plannedPopupSaving}
                className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={savePlannedDatePopup}
                disabled={plannedPopupSaving}
                className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {plannedPopupSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

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

              {statusForm.newStatus?.toUpperCase() === "PLANNED" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Planned date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    value={statusForm.plannedDate || ""}
                    onChange={(e) =>
                      handleStatusFieldChange("plannedDate", e.target.value)
                    }
                  />
                </div>
              )}

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
      {followupModals}
    </div>
  );
}
