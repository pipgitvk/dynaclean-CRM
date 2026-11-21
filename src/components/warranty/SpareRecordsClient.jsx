"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";
import { FilePlus, UserPlus } from "lucide-react";
import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "PLANNED", label: "Planned" },
  { value: "COMPLETED", label: "Completed" },
];

const actionIconClass =
  "inline-flex items-center justify-center p-1.5 rounded-md text-white transition-colors";

function normalizeStatus(status) {
  const u = String(status || "").trim().toUpperCase();
  if (u === "COMPLETED") return "COMPLETED";
  if (u === "PLANNED") return "PLANNED";
  if (u === "PENDING") return "PENDING";
  if (u === "IN_PROGRESS") return "PLANNED";
  return "PENDING";
}

function engineerSelectValue(assigned) {
  const v = String(assigned || "").trim();
  return v || "NOT ASSIGNED";
}

function statusSearchLabel(status) {
  const v = normalizeStatus(status);
  return STATUS_OPTIONS.find((o) => o.value === v)?.label || v;
}

function recordSubmittedYmd(record) {
  const raw = record?.created_at;
  if (!raw) return "";
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function spareRecordSearchText(record) {
  const statusLabel = statusSearchLabel(record.status);
  const assigned = engineerSelectValue(record.assigned_to);
  const parts = [
    record.spare_item_name,
    record.spare_item_code,
    record.rs_product_name,
    record.serial_number,
    record.order_id,
    record.quote_number,
    record.customer_name,
    record.rs_customer_name,
    record.installation_address,
    record.site_person,
    record.site_contact,
    record.site_email,
    assigned,
    assigned === "NOT ASSIGNED" ? "not assigned" : "",
    record.status,
    statusLabel,
    record.service_record_id,
    record.created_by,
    record.created_at,
  ];
  return parts
    .filter((p) => p != null && String(p).trim() !== "")
    .join(" ")
    .toLowerCase();
}

function ymdForInput(value) {
  if (!value) return "";
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function thirdPartyIdFromRecord(record) {
  const tpId =
    record?.third_party_engineer_id ??
    (record?.assigned_to_type === "third_party" ? record?.assigned_to_id : null);
  return tpId != null && tpId !== "" ? String(tpId) : "";
}

export default function SpareRecordsClient() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [serviceEngineers, setServiceEngineers] = useState([]);

  const [assignModal, setAssignModal] = useState(null);
  const [assignEngineer, setAssignEngineer] = useState("NOT ASSIGNED");
  const [assignThirdPartyId, setAssignThirdPartyId] = useState("");
  const [thirdPartyEngineers, setThirdPartyEngineers] = useState([]);
  const [assignError, setAssignError] = useState("");
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assignedFilter, setAssignedFilter] = useState("all");
  const [submittedDateFrom, setSubmittedDateFrom] = useState("");
  const [submittedDateTo, setSubmittedDateTo] = useState("");

  const [statusModal, setStatusModal] = useState(null);
  const [statusModalPlannedDate, setStatusModalPlannedDate] = useState("");
  const [statusModalCompletedBy, setStatusModalCompletedBy] = useState("");
  const [statusModalCompletedDate, setStatusModalCompletedDate] = useState("");
  const [statusModalError, setStatusModalError] = useState("");
  const [statusModalSubmitting, setStatusModalSubmitting] = useState(false);

  const loadEngineers = useCallback(async () => {
    try {
      const res = await fetch("/api/service-engineers/active", { cache: "no-store" });
      const data = await res.json();
      const names =
        data.users?.map((u) => u.username).filter(Boolean) || [];
      setServiceEngineers(names);
    } catch {
      setServiceEngineers([]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/warranty/spare-installation?limit=500", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Load failed");
        setItems([]);
        return;
      }
      setItems(data.items || []);
    } catch {
      setError("Could not load spare records");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadEngineers();
  }, [load, loadEngineers]);

  const assignedFilterOptions = useMemo(() => {
    const fromRows = new Set();
    for (const r of items) {
      const v = engineerSelectValue(r.assigned_to);
      if (v && v !== "NOT ASSIGNED") fromRows.add(v);
    }
    for (const name of serviceEngineers) {
      if (name) fromRows.add(name);
    }
    return [...fromRows].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [items, serviceEngineers]);

  const filteredItems = useMemo(() => {
    let rows = items;
    if (statusFilter !== "all") {
      rows = rows.filter(
        (r) => normalizeStatus(r.status) === statusFilter,
      );
    }
    if (assignedFilter === "unassigned") {
      rows = rows.filter(
        (r) => engineerSelectValue(r.assigned_to) === "NOT ASSIGNED",
      );
    } else if (assignedFilter !== "all") {
      rows = rows.filter(
        (r) => engineerSelectValue(r.assigned_to) === assignedFilter,
      );
    }
    if (submittedDateFrom || submittedDateTo) {
      rows = rows.filter((r) => {
        const d = recordSubmittedYmd(r);
        if (!d) return false;
        if (submittedDateFrom && d < submittedDateFrom) return false;
        if (submittedDateTo && d > submittedDateTo) return false;
        return true;
      });
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => spareRecordSearchText(r).includes(q));
    }
    return rows;
  }, [
    items,
    searchQuery,
    statusFilter,
    assignedFilter,
    submittedDateFrom,
    submittedDateTo,
  ]);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    statusFilter !== "all" ||
    assignedFilter !== "all" ||
    submittedDateFrom !== "" ||
    submittedDateTo !== "";

  const engineerOptionsForRow = (row) => {
    const current = engineerSelectValue(row.assigned_to);
    if (
      current !== "NOT ASSIGNED" &&
      !serviceEngineers.includes(current)
    ) {
      return [current, ...serviceEngineers];
    }
    return serviceEngineers;
  };

  async function patchStatus(id, payload) {
    setSavingId(id);
    try {
      const res = await fetch(`/api/warranty/spare-installation/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Update failed");
        load();
        return false;
      }
      return true;
    } catch {
      toast.error("Update failed");
      load();
      return false;
    } finally {
      setSavingId(null);
    }
  }

  function handleStatusSelect(row, nextStatus) {
    const current = normalizeStatus(row.status);
    const next = normalizeStatus(nextStatus);
    if (current === "COMPLETED") return;
    if (next === current) return;

    if (next === "PLANNED") {
      setStatusModal({ row, mode: "PLANNED" });
      setStatusModalPlannedDate(ymdForInput(row.planned_date) || todayYmd());
      setStatusModalError("");
      return;
    }
    if (next === "COMPLETED") {
      const assigned = engineerSelectValue(row.assigned_to);
      setStatusModal({ row, mode: "COMPLETED" });
      setStatusModalCompletedBy(
        String(row.completed_by || "").trim() ||
          (assigned !== "NOT ASSIGNED" ? assigned : ""),
      );
      setStatusModalCompletedDate(
        ymdForInput(row.completed_date) || todayYmd(),
      );
      setStatusModalError("");
      return;
    }
    void (async () => {
      const ok = await patchStatus(row.id, { status: "PENDING" });
      if (ok) {
        setItems((prev) =>
          prev.map((r) =>
            r.id === row.id
              ? { ...r, status: "PENDING", planned_date: null }
              : r,
          ),
        );
        toast.success("Status updated");
      }
    })();
  }

  function closeStatusModal() {
    if (statusModalSubmitting) return;
    setStatusModal(null);
    setStatusModalError("");
  }

  async function submitStatusModal() {
    if (!statusModal) return;
    const { row, mode } = statusModal;

    if (mode === "PLANNED") {
      const plannedDate = statusModalPlannedDate.trim();
      if (!plannedDate) {
        setStatusModalError("Please select a planned date.");
        return;
      }
      setStatusModalSubmitting(true);
      setStatusModalError("");
      const ok = await patchStatus(row.id, {
        status: "PLANNED",
        planned_date: plannedDate,
      });
      setStatusModalSubmitting(false);
      if (ok) {
        setItems((prev) =>
          prev.map((r) =>
            r.id === row.id
              ? { ...r, status: "PLANNED", planned_date: plannedDate }
              : r,
          ),
        );
        toast.success("Planned date saved");
        setStatusModal(null);
      }
      return;
    }

    const completedBy = statusModalCompletedBy.trim();
    const completedDate = statusModalCompletedDate.trim();
    if (!completedBy || !completedDate) {
      setStatusModalError("Completed by and completed date are required.");
      return;
    }
    setStatusModalSubmitting(true);
    setStatusModalError("");
    const ok = await patchStatus(row.id, {
      status: "COMPLETED",
      completed_by: completedBy,
      completed_date: completedDate,
    });
    setStatusModalSubmitting(false);
    if (ok) {
      setItems((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? {
                ...r,
                status: "COMPLETED",
                completed_by: completedBy,
                completed_date: completedDate,
              }
            : r,
        ),
      );
      toast.success("Marked completed");
      setStatusModal(null);
    }
  }

  async function openAssignModal(row) {
    setAssignModal(row);
    setAssignEngineer(engineerSelectValue(row.assigned_to));
    setAssignThirdPartyId(thirdPartyIdFromRecord(row));
    setAssignError("");
    try {
      const tpRes = await fetch("/api/third-party-engineers/active", {
        cache: "no-store",
      });
      const tpData = await tpRes.json().catch(() => []);
      setThirdPartyEngineers(Array.isArray(tpData) ? tpData : []);
    } catch {
      setThirdPartyEngineers([]);
    }
  }

  function closeAssignModal() {
    if (assignSubmitting) return;
    setAssignModal(null);
    setAssignError("");
  }

  async function handleAssignSubmit() {
    if (!assignModal) return;
    if (!assignEngineer) {
      setAssignError("Please select an engineer.");
      return;
    }
    setAssignSubmitting(true);
    setAssignError("");
    try {
      const serviceId = assignModal.service_record_id;
      if (serviceId) {
        const res = await fetch("/api/service-status/assign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service_id: serviceId,
            assigned_to: assignEngineer,
            third_party_engineer_id: assignThirdPartyId || null,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.message || "Failed to assign.");
        }
      }
      const patchRes = await fetch(
        `/api/warranty/spare-installation/${assignModal.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assigned_to: assignEngineer }),
        },
      );
      if (!patchRes.ok) {
        const d = await patchRes.json().catch(() => ({}));
        throw new Error(d.message || "Failed to update spare record.");
      }
      const tpIdNum = assignThirdPartyId ? Number(assignThirdPartyId) : null;
      setItems((prev) =>
        prev.map((r) =>
          r.id === assignModal.id
            ? {
                ...r,
                assigned_to: assignEngineer,
                third_party_engineer_id: tpIdNum,
                assigned_to_id: tpIdNum,
                assigned_to_type: tpIdNum ? "third_party" : "internal",
              }
            : r,
        ),
      );
      toast.success("Assigned successfully");
      setAssignModal(null);
    } catch (err) {
      setAssignError(err.message || "Something went wrong.");
    } finally {
      setAssignSubmitting(false);
    }
  }

  const colSpan = 11;

  return (
    <div className="w-full max-w-full p-6">
      <Toaster position="top-center" />
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-3xl font-bold">Spare Records</h2>
        <Link
          href="/admin-dashboard/warranty/spares"
          className="text-sm text-blue-600 hover:underline"
        >
          Registered Spares
        </Link>
      </div>
      <p className="mb-4 text-sm text-gray-600">
        On-site spare installation requests — assign service engineers and
        update status.
      </p>

      {error ? (
        <p className="mb-4 text-sm text-red-600">
          {error}{" "}
          <button type="button" onClick={load} className="underline">
            Retry
          </button>
        </p>
      ) : null}

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search spare, serial, customer, address, engineer, status, order…"
            className="min-w-[16rem] flex-1 rounded border border-gray-300 px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 md:max-w-xl"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={assignedFilter}
            onChange={(e) => setAssignedFilter(e.target.value)}
            className="min-w-[10rem] rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Filter by assigned engineer"
          >
            <option value="all">Assigned to — All</option>
            <option value="unassigned">Not assigned</option>
            {assignedFilterOptions.map((eng) => (
              <option key={eng} value={eng}>
                {eng}
              </option>
            ))}
          </select>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setAssignedFilter("all");
                setSubmittedDateFrom("");
                setSubmittedDateTo("");
              }}
              className="text-sm text-gray-600 underline hover:text-gray-900"
            >
              Clear filters
            </button>
          ) : null}
          {!loading && items.length > 0 ? (
            <span className="text-sm text-gray-500">
              Showing {filteredItems.length} of {items.length}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <span className="pb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            Submitted
          </span>
          <TypeableDateFilterInput
            value={submittedDateFrom}
            onChange={setSubmittedDateFrom}
            className="w-full min-w-[9rem] max-w-[11rem] rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="From date"
          />
          <span className="pb-2 text-sm text-gray-400">to</span>
          <TypeableDateFilterInput
            value={submittedDateTo}
            onChange={setSubmittedDateTo}
            className="w-full min-w-[9rem] max-w-[11rem] rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="To date"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded border bg-white shadow">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-800 text-white">
            <tr>
              <th className="p-3">Spare / Model</th>
              <th className="p-3">Serial</th>
              <th className="p-3">Order</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Installation address</th>
              <th className="p-3">Site contact</th>
              <th className="p-3">Assigned to</th>
              <th className="p-3">Status</th>
              <th className="p-3">Submitted</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colSpan} className="p-8 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="p-8 text-center text-gray-500">
                  No spare installation records yet.
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="p-8 text-center text-gray-500">
                  No rows match your filters.
                </td>
              </tr>
            ) : (
              filteredItems.map((r) => {
                const value = normalizeStatus(r.status);
                const assignedLabel = engineerSelectValue(r.assigned_to);
                const completed = value === "COMPLETED";
                return (
                  <tr
                    key={r.id}
                    className="border-t odd:bg-white even:bg-gray-50"
                  >
                    <td className="p-3">
                      <div className="font-medium">
                        {r.spare_item_name || r.rs_product_name || "—"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {r.spare_item_code || "—"}
                      </div>
                    </td>
                    <td className="p-3 text-xs">{r.serial_number || "—"}</td>
                    <td className="p-3 text-xs">{r.order_id || "—"}</td>
                    <td className="p-3 text-xs">
                      {r.customer_name || r.rs_customer_name || "—"}
                    </td>
                    <td className="max-w-xs p-3 text-xs whitespace-normal">
                      {r.installation_address}
                    </td>
                    <td className="p-3 text-xs">
                      <div>{r.site_person}</div>
                      <div className="text-gray-600">{r.site_contact}</div>
                      <div className="text-gray-600">{r.site_email}</div>
                    </td>
                    <td className="p-3 text-xs whitespace-nowrap">
                      {assignedLabel === "NOT ASSIGNED" ? (
                        <span className="text-gray-500">Not assigned</span>
                      ) : (
                        <span className="font-medium text-gray-900">
                          {assignedLabel}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-xs">
                      {completed ? (
                        <span className="inline-block min-w-[7.5rem] rounded border border-green-300 bg-green-50 px-2 py-1.5 text-xs font-semibold text-green-800">
                          Completed
                        </span>
                      ) : (
                        <select
                          value={value}
                          disabled={savingId === r.id}
                          onChange={(e) =>
                            handleStatusSelect(r, e.target.value)
                          }
                          className={`min-w-[7.5rem] rounded border px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            value === "PLANNED"
                              ? "border-amber-300 bg-amber-50 text-amber-900"
                              : "border-gray-300 bg-gray-50 text-gray-800"
                          }`}
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="p-3 text-xs whitespace-nowrap">
                      {r.created_at
                        ? new Date(r.created_at).toLocaleString("en-GB")
                        : "—"}
                    </td>
                    <td className="p-3 text-xs">
                      <div className="flex flex-wrap items-center gap-1">
                        {!completed ? (
                          <button
                            type="button"
                            onClick={() => openAssignModal(r)}
                            title="Assign Engineer"
                            className={`${actionIconClass} bg-indigo-500 hover:bg-indigo-600`}
                          >
                            <UserPlus className="h-4 w-4" />
                          </button>
                        ) : null}
                        {r.service_record_id ? (
                          <Link
                            href={`/admin-dashboard/complete-service/${r.service_record_id}`}
                            title="Spare installation report (prefilled)"
                            className={`${actionIconClass} bg-purple-500 hover:bg-purple-600`}
                          >
                            <FilePlus className="h-4 w-4" />
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {assignModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={closeAssignModal}
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-700"
              aria-label="Close"
            >
              ✕
            </button>
            <h3 className="mb-4 text-lg font-semibold text-gray-800">
              Assign Service
              {assignModal.service_record_id
                ? ` (ID: ${assignModal.service_record_id})`
                : ""}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Assign To (Internal)
                </label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={assignEngineer}
                  onChange={(e) => setAssignEngineer(e.target.value)}
                >
                  <option value="NOT ASSIGNED">NOT ASSIGNED</option>
                  {engineerOptionsForRow(assignModal).map((eng) => (
                    <option key={eng} value={eng}>
                      {eng}
                    </option>
                  ))}
                </select>
              </div>
              {assignModal.service_record_id ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Third Party Engineer
                  </label>
                  <select
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={assignThirdPartyId}
                    onChange={(e) => setAssignThirdPartyId(e.target.value)}
                  >
                    <option value="">— Not assigned —</option>
                    {thirdPartyEngineers.length > 0 ? (
                      thirdPartyEngineers.map((eng) => (
                        <option
                          key={eng.engineer_id}
                          value={String(eng.engineer_id)}
                        >
                          {eng.name}
                          {eng.state ? ` (${eng.state})` : ""}
                        </option>
                      ))
                    ) : (
                      <option disabled>No third-party engineers found</option>
                    )}
                  </select>
                </div>
              ) : null}
              {assignError ? (
                <p className="text-sm text-red-600">{assignError}</p>
              ) : null}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeAssignModal}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  disabled={assignSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssignSubmit}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-60"
                  disabled={assignSubmitting}
                >
                  {assignSubmitting ? "Assigning..." : "Assign"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {statusModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={closeStatusModal}
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-700"
              aria-label="Close"
            >
              ✕
            </button>
            <h3 className="mb-1 text-lg font-semibold text-gray-800">
              {statusModal.mode === "PLANNED"
                ? "Planned visit"
                : "Complete installation"}
            </h3>
            <p className="mb-4 text-xs text-gray-500">
              {statusModal.row.spare_item_name ||
                statusModal.row.rs_product_name ||
                "Spare"}{" "}
              · {statusModal.row.serial_number || "—"}
            </p>
            <div className="space-y-4">
              {statusModal.mode === "PLANNED" ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Planned date <span className="text-red-500">*</span>
                  </label>
                  <TypeableDateFilterInput
                    value={statusModalPlannedDate}
                    onChange={setStatusModalPlannedDate}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Completed by (service engineer){" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      value={statusModalCompletedBy}
                      onChange={(e) =>
                        setStatusModalCompletedBy(e.target.value)
                      }
                    >
                      <option value="">— Select —</option>
                      {engineerOptionsForRow(statusModal.row).map((eng) => (
                        <option key={eng} value={eng}>
                          {eng}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Completed date <span className="text-red-500">*</span>
                    </label>
                    <TypeableDateFilterInput
                      value={statusModalCompletedDate}
                      onChange={setStatusModalCompletedDate}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </>
              )}
              {statusModalError ? (
                <p className="text-sm text-red-600">{statusModalError}</p>
              ) : null}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeStatusModal}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  disabled={statusModalSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitStatusModal}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={statusModalSubmitting}
                >
                  {statusModalSubmitting ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}