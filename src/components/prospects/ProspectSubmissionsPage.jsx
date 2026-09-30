"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { FileText, ExternalLink, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";

dayjs.extend(utc);

/** MySQL NOW()/CURRENT_TIMESTAMP is UTC. Show India time on the page. */
const IST_OFFSET_MINUTES = 330;

const formatDT = (val) => {
  if (!val) return "—";
  const s = String(val).trim();
  if (!s) return "—";
  const hasExplicitTz = /Z$/i.test(s) || /[+-]\d{2}:?\d{2}$/.test(s);
  const parsed = hasExplicitTz
    ? dayjs(s)
    : dayjs.utc(s.includes("T") ? s : s.replace(" ", "T"));
  if (!parsed.isValid()) return "—";
  return parsed.utcOffset(IST_OFFSET_MINUTES).format("DD MMM YYYY, hh:mm A");
};

function isAcknowledged(status) {
  const s = String(status || "").toLowerCase();
  return s === "acknowledged" || s === "reviewed";
}

function prospectFileHref(row) {
  const url = String(row?.pdf_path || "");
  if (!url) return "";
  const name = String(row?.pdf_original_name || "");
  const isCloudinaryPdf =
    url.includes("res.cloudinary.com") &&
    (name.toLowerCase().endsWith(".pdf") || url.includes("/raw/upload/"));
  if (!isCloudinaryPdf) return url;
  const filename = name.toLowerCase().endsWith(".pdf")
    ? name
    : `${name.replace(/\.[^.]+$/, "") || "prospect"}.pdf`;
  const params = new URLSearchParams({ url, filename });
  return `/api/cloudinary-proxy?${params.toString()}`;
}

function buildProspectQuery(scope, fromDate, toDate) {
  const params = new URLSearchParams({ scope });
  if (fromDate) params.set("fromDate", fromDate);
  if (toDate) params.set("toDate", toDate);
  return `/api/prospect-submissions?${params.toString()}`;
}

export default function ProspectSubmissionsPage({ defaultScope = "team" }) {
  const [scope, setScope] = useState(defaultScope);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasReportees, setHasReportees] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [ackModal, setAckModal] = useState(null);
  const [ackNotes, setAckNotes] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const employeeDropdownRef = useRef(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const meRes = await fetch("/api/me");
      const me = meRes.ok ? await meRes.json() : {};
      const roleNorm = String(me.userRole || "").trim().toUpperCase();
      setUserRole(roleNorm);

      let effectiveScope =
        roleNorm === "SUPERADMIN" || roleNorm === "ADMIN" ? "all" : scope;
      const res = await fetch(buildProspectQuery(effectiveScope, fromDate, toDate));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load submissions");
      const reportees = !!data.hasReportees;
      setHasReportees(reportees);
      if (roleNorm === "SUPERADMIN" || roleNorm === "ADMIN") {
        effectiveScope = "all";
        setScope("all");
      } else if (!reportees && effectiveScope === "team") {
        effectiveScope = "mine";
        setScope("mine");
        const mineRes = await fetch(buildProspectQuery("mine", fromDate, toDate));
        const mineData = await mineRes.json();
        if (mineRes.ok) {
          setRows(mineData.rows || []);
        } else {
          setRows([]);
        }
        return;
      }
      setRows(data.rows || []);
    } catch (error) {
      toast.error(error.message || "Failed to load submissions");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [scope, fromDate, toDate]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const openAcknowledgeModal = (row) => {
    setAckModal(row);
    setAckNotes("");
  };

  const submitAcknowledge = async () => {
    if (!ackModal) return;
    const notes = ackNotes.trim();
    if (!notes) {
      toast.error("Please enter acknowledgment notes.");
      return;
    }

    setUpdatingId(ackModal.id);
    try {
      const res = await fetch(`/api/prospect-submissions/${ackModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "acknowledged",
          acknowledgment_notes: notes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to acknowledge");
      toast.success("Acknowledged successfully");
      setAckModal(null);
      setAckNotes("");
      fetchRows();
    } catch (error) {
      toast.error(error.message || "Failed to acknowledge");
    } finally {
      setUpdatingId(null);
    }
  };

  const roleNorm = String(userRole || "").trim().toUpperCase();
  const isSuperAdmin = roleNorm === "SUPERADMIN" || roleNorm === "ADMIN";
  const title = isSuperAdmin
    ? "All Prospect Submissions"
    : hasReportees
      ? "Team Prospect Submissions"
      : "My Prospect Submissions";
  const canAcknowledge = (isSuperAdmin || hasReportees) && scope !== "mine";
  const showAdminFilters = roleNorm === "SUPERADMIN";

  const employees = useMemo(() => {
    return [...new Set(rows.map((row) => String(row.submitted_by || "").trim()).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b),
    );
  }, [rows]);

  const filteredEmployees = useMemo(() => {
    if (!employeeSearch.trim()) return employees;
    const search = employeeSearch.toLowerCase();
    return employees.filter((name) => name.toLowerCase().includes(search));
  }, [employees, employeeSearch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(event.target)) {
        setShowEmployeeDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (
        showAdminFilters &&
        employeeFilter &&
        String(row.submitted_by || "").trim() !== employeeFilter
      ) {
        return false;
      }
      if (showAdminFilters && statusFilter === "pending" && isAcknowledged(row.status)) return false;
      if (showAdminFilters && statusFilter === "acknowledged" && !isAcknowledged(row.status)) {
        return false;
      }
      return true;
    });
  }, [rows, employeeFilter, statusFilter, showAdminFilters]);

  const hasFilters = Boolean(
    fromDate || toDate || (showAdminFilters && (employeeFilter || statusFilter)),
  );

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 border-b-2 pb-2">{title}</h1>
          <p className="text-sm text-gray-500 mt-2">
            PDF/image uploads and notes submitted by employees to their reporting managers.
          </p>
        </div>

        {!isSuperAdmin && hasReportees && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setScope("team")}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                scope === "team" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"
              }`}
            >
              Team
            </button>
            <button
              type="button"
              onClick={() => setScope("mine")}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                scope === "mine" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"
              }`}
            >
              My Submissions
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Created From
          </label>
          <input
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Created To
          </label>
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
        {showAdminFilters && (
          <>
            <div ref={employeeDropdownRef} className="relative">
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Employee
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={employeeFilter || employeeSearch}
                  onChange={(e) => {
                    setEmployeeSearch(e.target.value);
                    setShowEmployeeDropdown(true);
                    if (!e.target.value) {
                      setEmployeeFilter("");
                    }
                  }}
                  onFocus={() => setShowEmployeeDropdown(true)}
                  placeholder="Search employee..."
                  className="min-w-[160px] rounded-lg border border-gray-300 px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                {employeeFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      setEmployeeFilter("");
                      setEmployeeSearch("");
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              {showEmployeeDropdown && filteredEmployees.length > 0 && (
                <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-300 bg-white shadow-lg">
                  {filteredEmployees.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setEmployeeFilter(name);
                        setEmployeeSearch("");
                        setShowEmployeeDropdown(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                        employeeFilter === name ? "bg-blue-50 font-medium text-blue-700" : ""
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="min-w-[160px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="acknowledged">Acknowledged</option>
              </select>
            </div>
          </>
        )}
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setFromDate("");
              setToDate("");
              setEmployeeFilter("");
              setEmployeeSearch("");
              setStatusFilter("");
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading submissions...
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
          {rows.length === 0
            ? "No prospect submissions found."
            : "No prospect submissions match these filters."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-3">Submitted By</th>
                <th className="px-4 py-3">Reporting Manager</th>
                <th className="px-4 py-3">Employee Notes</th>
                <th className="px-4 py-3">Attachment</th>
                <th className="px-4 py-3">Manager Acknowledgment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Submitted At</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.submitted_by}</td>
                  <td className="px-4 py-3">{row.reporting_manager || "—"}</td>
                  <td className="px-4 py-3 max-w-xs whitespace-pre-wrap break-words">
                    {row.notes || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {row.pdf_path ? (
                      <a
                        href={prospectFileHref(row)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        <FileText className="h-4 w-4" />
                        {row.pdf_original_name || "View file"}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    {row.acknowledgment_notes ? (
                      <div className="space-y-1">
                        <p className="whitespace-pre-wrap break-words text-gray-800">
                          {row.acknowledgment_notes}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {row.acknowledged_by ? `By ${row.acknowledged_by}` : ""}
                          {row.acknowledged_at ? ` · ${formatDT(row.acknowledged_at)}` : ""}
                        </p>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        isAcknowledged(row.status)
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {isAcknowledged(row.status) ? "acknowledged" : row.status || "pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDT(row.created_at)}</td>
                  <td className="px-4 py-3">
                    {canAcknowledge ? (
                      isAcknowledged(row.status) ? (
                        <span className="text-xs text-green-700 font-medium">Done</span>
                      ) : (
                        <button
                          type="button"
                          disabled={updatingId === row.id}
                          onClick={() => openAcknowledgeModal(row)}
                          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                        >
                          Acknowledge
                        </button>
                      )
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Acknowledge Prospect</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  From {ackModal.submitted_by} · notes will be visible to the employee
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAckModal(null);
                  setAckNotes("");
                }}
                className="rounded-full p-1 hover:bg-gray-100"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {ackModal.notes ? (
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                    Employee Notes
                  </p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{ackModal.notes}</p>
                </div>
              ) : null}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Acknowledgment Notes <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={ackNotes}
                  onChange={(e) => setAckNotes(e.target.value)}
                  rows={4}
                  placeholder="Write notes for the employee..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAckModal(null);
                    setAckNotes("");
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={updatingId === ackModal.id || !ackNotes.trim()}
                  onClick={submitAcknowledge}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {updatingId === ackModal.id ? "Saving..." : "Submit Acknowledgment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
