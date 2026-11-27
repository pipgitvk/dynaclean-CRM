"use client";

import { useMemo, useState } from "react";
import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import { formatCrmDateOnly } from "@/lib/crmDateFormat";
import {
  SERVICE_RECORD_INLINE_STATUS_OPTIONS,
  applyServiceStatusUpdate,
  assignServiceRecordEngineer,
  canAssignServiceEngineer,
  canChangeServiceStatus,
  fetchActiveEngineerOptions,
  installationSiteComplete,
  installationSiteFromRecord,
  plannedDateForInput,
  thirdPartyIdFromRecord,
} from "@/lib/serviceRecordStatusPermissions";

const PLANNED_NOTES_PLACEHOLDER = "followup planning";

export default function ServiceRecordStatusInlineCell({
  record,
  role,
  onRecordUpdated,
  serviceIdLabel,
  statusOptions,
}) {
  const inlineOptions = useMemo(
    () =>
      Array.from(
        new Set([
          "PENDING",
          "PLANNED",
          ...(statusOptions ?? SERVICE_RECORD_INLINE_STATUS_OPTIONS).filter(Boolean),
        ]),
      ),
    [statusOptions],
  );
  const [localRecord, setLocalRecord] = useState(record);
  const [inlinePlannedDateSaving, setInlinePlannedDateSaving] = useState(false);

  const [plannedDatePopup, setPlannedDatePopup] = useState(null);
  const [plannedPopupEngineers, setPlannedPopupEngineers] = useState([]);
  const [plannedPopupThirdPartyEngineers, setPlannedPopupThirdPartyEngineers] = useState(
    [],
  );
  const [plannedPopupError, setPlannedPopupError] = useState("");
  const [plannedPopupSaving, setPlannedPopupSaving] = useState(false);

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusForm, setStatusForm] = useState(null);
  const [statusModalEngineers, setStatusModalEngineers] = useState([]);
  const [statusModalThirdPartyEngineers, setStatusModalThirdPartyEngineers] = useState(
    [],
  );
  const [statusError, setStatusError] = useState("");
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  const r = { ...record, ...localRecord };
  const serviceId = r.service_id;
  const status = r.status || "PENDING";
  const canEdit = canChangeServiceStatus(role, r);
  const isPending = status.toUpperCase() === "PENDING";
  const isPlanned = status.toUpperCase() === "PLANNED";

  const patchLocal = (patch) => {
    setLocalRecord((prev) => ({ ...prev, ...patch }));
    onRecordUpdated?.(patch);
  };

  const applyUpdate = async (payload) => {
    await applyServiceStatusUpdate(payload);
    const patch = {
      status: payload.status,
      status_description: payload.description || "",
      planned_date: payload.planned_date ?? null,
    };
    patchLocal(patch);
  };

  const siteFromRecord = (rec) => installationSiteFromRecord(rec || r);

  const openPlannedDatePopup = async (rec) => {
    const site = siteFromRecord(rec);
    setPlannedPopupError("");
    setPlannedDatePopup({
      serviceId: rec.service_id,
      plannedDate: plannedDateForInput(rec.planned_date) || "",
      assignEngineer: rec.assigned_to || "NOT ASSIGNED",
      thirdPartyId: thirdPartyIdFromRecord(rec),
      notes: (rec.status_description || "").trim(),
      ...site,
    });
    if (canAssignServiceEngineer(role)) {
      try {
        const { internalNames, thirdPartyEngineers } =
          await fetchActiveEngineerOptions(rec);
        setPlannedPopupEngineers(internalNames);
        setPlannedPopupThirdPartyEngineers(thirdPartyEngineers);
      } catch {
        setPlannedPopupEngineers([]);
        setPlannedPopupThirdPartyEngineers([]);
      }
    }
  };

  const handleInlinePendingStatusChange = (newStatus) => {
    const current = r.status || "PENDING";
    if (newStatus === current) return;

    if (newStatus.toUpperCase() === "PLANNED") {
      void openPlannedDatePopup(r);
      return;
    }

    if (newStatus.toUpperCase() === "PENDING BY CUSTOMER") {
      setStatusError("");
      setStatusForm({
        service_id: r.service_id,
        currentStatus: current,
        newStatus,
        description: r.status_description || "",
        plannedDate: plannedDateForInput(r.planned_date),
        assignEngineer: r.assigned_to || "NOT ASSIGNED",
        thirdPartyId: thirdPartyIdFromRecord(r),
        plannedNotes: (r.status_description || "").trim(),
      });
      setStatusModalOpen(true);
      return;
    }

    applyUpdate({
      service_id: r.service_id,
      status: newStatus,
      description: r.status_description || "",
      planned_date: null,
    }).catch((err) => {
      window.alert(err.message || "Failed to update status.");
    });
  };

  const handleInlinePlannedDateChange = async (dateYmd) => {
    const next = (dateYmd || "").trim();
    if (!next || next === plannedDateForInput(r.planned_date)) return;
    try {
      setInlinePlannedDateSaving(true);
      await applyUpdate({
        service_id: r.service_id,
        status: "PLANNED",
        description: r.status_description || "",
        planned_date: next,
      });
    } catch (err) {
      window.alert(err.message || "Failed to update planned date.");
    } finally {
      setInlinePlannedDateSaving(false);
    }
  };

  const savePlannedDatePopup = async () => {
    if (!plannedDatePopup?.serviceId) return;
    const plannedDate = (plannedDatePopup.plannedDate || "").trim();
    if (!plannedDate) {
      setPlannedPopupError("Please select a planned date.");
      return;
    }
    const notes = (plannedDatePopup.notes || "").trim();
    const assignEngineer = plannedDatePopup.assignEngineer || "NOT ASSIGNED";
    const thirdPartyId = plannedDatePopup.thirdPartyId;
    const wantsAssign =
      canAssignServiceEngineer(role) &&
      (String(assignEngineer).trim().toUpperCase() !== "NOT ASSIGNED" ||
        Boolean(String(thirdPartyId || "").trim()));
    const site = {
      installation_address: plannedDatePopup.installation_address || "",
      site_person: plannedDatePopup.site_person || "",
      site_email: plannedDatePopup.site_email || "",
      site_contact: plannedDatePopup.site_contact || "",
    };
    if (wantsAssign && !installationSiteComplete(site)) {
      setPlannedPopupError(
        "Please fill installation address, site person, email and contact.",
      );
      return;
    }
    try {
      setPlannedPopupSaving(true);
      setPlannedPopupError("");
      await applyUpdate({
        service_id: plannedDatePopup.serviceId,
        status: "PLANNED",
        description: notes,
        planned_date: plannedDate,
      });
      if (wantsAssign) {
        const assignRes = await assignServiceRecordEngineer(
          plannedDatePopup.serviceId,
          assignEngineer,
          thirdPartyId,
          site,
        );
        patchLocal({
          assigned_to: assignEngineer,
          third_party_engineer_id: thirdPartyId ? Number(thirdPartyId) : null,
          engineer_assigned_by: assignRes?.engineer_assigned_by || undefined,
          ...site,
        });
      }
      setPlannedDatePopup(null);
    } catch (err) {
      setPlannedPopupError(err.message || "Failed to save.");
    } finally {
      setPlannedPopupSaving(false);
    }
  };

  const openStatusModalForEdit = async () => {
    setStatusError("");
    setStatusForm({
      service_id: r.service_id,
      currentStatus: r.status || "",
      newStatus: r.status || "",
      description: r.status_description || "",
      plannedDate: plannedDateForInput(r.planned_date),
      assignEngineer: r.assigned_to || "NOT ASSIGNED",
      thirdPartyId: thirdPartyIdFromRecord(r),
      plannedNotes: (r.status_description || "").trim(),
    });
    setStatusModalOpen(true);
    if (canAssignServiceEngineer(role)) {
      try {
        const { internalNames, thirdPartyEngineers } =
          await fetchActiveEngineerOptions(r);
        setStatusModalEngineers(internalNames);
        setStatusModalThirdPartyEngineers(thirdPartyEngineers);
      } catch {
        setStatusModalEngineers([]);
        setStatusModalThirdPartyEngineers([]);
      }
    }
  };

  const handleStatusSubmit = async () => {
    if (!statusForm?.service_id || !statusForm?.newStatus) {
      setStatusError("Please select a status.");
      return;
    }
    const newStatus = statusForm.newStatus.trim();
    const isPlannedTarget = newStatus.toUpperCase() === "PLANNED";
    const description = isPlannedTarget
      ? (statusForm.plannedNotes || "").trim()
      : (statusForm.description || "").trim();
    const plannedDate = (statusForm.plannedDate || "").trim();

    try {
      setStatusSubmitting(true);
      setStatusError("");
      await applyUpdate({
        service_id: statusForm.service_id,
        status: newStatus,
        description,
        planned_date: isPlannedTarget ? plannedDate : null,
      });
      if (isPlannedTarget && canAssignServiceEngineer(role)) {
        const assignEngineer = statusForm.assignEngineer || "NOT ASSIGNED";
        const thirdPartyId = statusForm.thirdPartyId;
        const wantsAssign =
          String(assignEngineer).trim().toUpperCase() !== "NOT ASSIGNED" ||
          Boolean(String(thirdPartyId || "").trim());
        if (wantsAssign) {
          const site = installationSiteFromRecord({
            ...r,
            ...statusForm,
          });
          const assignRes = await assignServiceRecordEngineer(
            statusForm.service_id,
            assignEngineer,
            thirdPartyId,
            site,
          );
          patchLocal({
            assigned_to: assignEngineer,
            engineer_assigned_by: assignRes?.engineer_assigned_by || undefined,
            ...site,
          });
        }
      }
      setStatusModalOpen(false);
    } catch (err) {
      setStatusError(err.message || "Something went wrong.");
    } finally {
      setStatusSubmitting(false);
    }
  };

  const formatDate = (value) => formatCrmDateOnly(value, "");

  return (
    <div className="min-w-[8.5rem] max-w-[12rem]">
      {serviceIdLabel ? (
        <p className="mb-1 text-[10px] font-semibold text-slate-500">{serviceIdLabel}</p>
      ) : null}

      {canEdit && (isPending || isPlanned) ? (
        <div className="flex flex-col gap-1.5">
          <select
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-400"
            value={status}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => handleInlinePendingStatusChange(e.target.value)}
          >
            {inlineOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {isPlanned ? (
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium text-indigo-700">Planned date</span>
              <TypeableDateFilterInput
                value={plannedDateForInput(r.planned_date)}
                onChange={handleInlinePlannedDateChange}
                disabled={inlinePlannedDateSaving}
                className="w-full rounded-md border border-indigo-200 bg-indigo-50/40 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-60"
                onClick={(e) => e.stopPropagation()}
              />
            </label>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-800">{status}</span>
          {isPlanned && r.planned_date ? (
            <span className="text-[10px] font-medium text-indigo-700">
              Planned: {formatDate(r.planned_date)}
            </span>
          ) : null}
          {status.toUpperCase() === "COMPLETED" && r.completed_date ? (
            <span className="text-[10px] font-medium text-emerald-700">
              Installed: {formatDate(r.completed_date)}
            </span>
          ) : null}
          {(status.toUpperCase() === "PENDING BY CUSTOMER" || isPlanned) &&
          r.status_description ? (
            <span className="text-[10px] text-slate-600 break-words">{r.status_description}</span>
          ) : null}
          {canEdit && status.toUpperCase() !== "COMPLETED" ? (
            <button
              type="button"
              onClick={() => void openStatusModalForEdit()}
              className="text-left text-[10px] font-semibold text-violet-700 hover:underline"
            >
              Change status
            </button>
          ) : null}
        </div>
      )}

      {plannedDatePopup ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Planned visit date</h3>
            <p className="mt-1 text-xs text-gray-500">Service ID: {plannedDatePopup.serviceId}</p>
            <label className="mb-1 mt-4 block text-sm font-medium text-gray-700">
              Planned date <span className="text-red-500">*</span>
            </label>
            <TypeableDateFilterInput
              value={plannedDatePopup.plannedDate || ""}
              onChange={(v) =>
                setPlannedDatePopup((p) => (p ? { ...p, plannedDate: v } : p))
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            {canAssignServiceEngineer(role) ? (
              <>
                <label className="mb-1 mt-4 block text-sm font-medium text-gray-700">
                  Assign to service engineer
                </label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={plannedDatePopup.assignEngineer || "NOT ASSIGNED"}
                  onChange={(e) =>
                    setPlannedDatePopup((p) =>
                      p ? { ...p, assignEngineer: e.target.value } : p,
                    )
                  }
                >
                  <option value="NOT ASSIGNED">NOT ASSIGNED</option>
                  {plannedPopupEngineers.map((eng) => (
                    <option key={eng} value={eng}>
                      {eng}
                    </option>
                  ))}
                </select>
                <label className="mb-1 mt-4 block text-sm font-medium text-gray-700">
                  Third party engineer
                </label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={plannedDatePopup.thirdPartyId || ""}
                  onChange={(e) =>
                    setPlannedDatePopup((p) =>
                      p ? { ...p, thirdPartyId: e.target.value } : p,
                    )
                  }
                >
                  <option value="">— Not assigned —</option>
                  {plannedPopupThirdPartyEngineers.map((eng) => (
                    <option key={eng.engineer_id} value={String(eng.engineer_id)}>
                      {eng.name}
                      {eng.state ? ` (${eng.state})` : ""}
                    </option>
                  ))}
                </select>
                {!installationSiteComplete(plannedDatePopup) ? (
                  <div className="mt-4 space-y-3 rounded-md border border-amber-100 bg-amber-50/60 p-3">
                    <p className="text-xs font-semibold text-amber-900">
                      Installation site details
                    </p>
                    <label className="block text-sm font-medium text-gray-700">
                      Installation address
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      value={plannedDatePopup.installation_address || ""}
                      onChange={(e) =>
                        setPlannedDatePopup((p) =>
                          p ? { ...p, installation_address: e.target.value } : p,
                        )
                      }
                    />
                    <label className="block text-sm font-medium text-gray-700">
                      Site person
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      value={plannedDatePopup.site_person || ""}
                      onChange={(e) =>
                        setPlannedDatePopup((p) =>
                          p ? { ...p, site_person: e.target.value } : p,
                        )
                      }
                    />
                    <label className="block text-sm font-medium text-gray-700">
                      Site email
                    </label>
                    <input
                      type="email"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      value={plannedDatePopup.site_email || ""}
                      onChange={(e) =>
                        setPlannedDatePopup((p) =>
                          p ? { ...p, site_email: e.target.value } : p,
                        )
                      }
                    />
                    <label className="block text-sm font-medium text-gray-700">
                      Site contact
                    </label>
                    <input
                      type="tel"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      value={plannedDatePopup.site_contact || ""}
                      onChange={(e) =>
                        setPlannedDatePopup((p) =>
                          p ? { ...p, site_contact: e.target.value } : p,
                        )
                      }
                    />
                  </div>
                ) : null}
              </>
            ) : null}
            <label className="mb-1 mt-4 block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder={PLANNED_NOTES_PLACEHOLDER}
              value={plannedDatePopup.notes || ""}
              onChange={(e) =>
                setPlannedDatePopup((p) => (p ? { ...p, notes: e.target.value } : p)
                )
              }
            />
            {plannedPopupError ? (
              <p className="mt-2 text-sm text-red-600">{plannedPopupError}</p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => !plannedPopupSaving && setPlannedDatePopup(null)}
                disabled={plannedPopupSaving}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={savePlannedDatePopup}
                disabled={plannedPopupSaving}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {plannedPopupSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {statusModalOpen && statusForm ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-800">
              Change Status (Service ID: {statusForm.service_id})
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  New Status
                </label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={statusForm.newStatus || ""}
                  onChange={(e) =>
                    setStatusForm((prev) =>
                      prev ? { ...prev, newStatus: e.target.value } : prev,
                    )
                  }
                >
                  <option value="">Select status</option>
                  {inlineOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              {statusForm.newStatus?.toUpperCase() === "PLANNED" ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Planned date <span className="text-red-500">*</span>
                    </label>
                    <TypeableDateFilterInput
                      value={statusForm.plannedDate || ""}
                      onChange={(v) =>
                        setStatusForm((prev) =>
                          prev ? { ...prev, plannedDate: v } : prev,
                        )
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
                    <textarea
                      rows={3}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      placeholder={PLANNED_NOTES_PLACEHOLDER}
                      value={statusForm.plannedNotes || ""}
                      onChange={(e) =>
                        setStatusForm((prev) =>
                          prev ? { ...prev, plannedNotes: e.target.value } : prev,
                        )
                      }
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Description{" "}
                    {statusForm.newStatus?.toUpperCase() === "PENDING BY CUSTOMER" ? (
                      <span className="text-red-500">*</span>
                    ) : null}
                  </label>
                  <textarea
                    rows={3}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={statusForm.description || ""}
                    onChange={(e) =>
                      setStatusForm((prev) =>
                        prev ? { ...prev, description: e.target.value } : prev,
                      )
                    }
                  />
                </div>
              )}
              {statusError ? <p className="text-sm text-red-600">{statusError}</p> : null}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => !statusSubmitting && setStatusModalOpen(false)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 bg-white hover:bg-gray-50"
                  disabled={statusSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStatusSubmit}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={statusSubmitting}
                >
                  {statusSubmitting ? "Updating..." : "Update Status"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}