"use client";

import { useEffect, useState } from "react";
import {
  assignServiceRecordEngineer,
  fetchActiveEngineerOptions,
  thirdPartyIdFromRecord,
} from "@/lib/serviceRecordStatusPermissions";

export default function ServiceRecordAssignEngineerModal({
  open,
  record,
  onClose,
  onAssigned,
}) {
  const serviceId = record?.service_id;
  const [assignEngineer, setAssignEngineer] = useState("NOT ASSIGNED");
  const [assignThirdPartyId, setAssignThirdPartyId] = useState("");
  const [engineers, setEngineers] = useState([]);
  const [thirdPartyEngineers, setThirdPartyEngineers] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !record) return;
    setAssignEngineer(record.assigned_to || "NOT ASSIGNED");
    setAssignThirdPartyId(thirdPartyIdFromRecord(record));
    setError("");
    let cancelled = false;
    (async () => {
      try {
        const { internalNames, thirdPartyEngineers: tp } =
          await fetchActiveEngineerOptions(record);
        if (!cancelled) {
          setEngineers(internalNames);
          setThirdPartyEngineers(tp);
        }
      } catch {
        if (!cancelled) {
          setEngineers([]);
          setThirdPartyEngineers([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, record]);

  const close = () => {
    if (submitting) return;
    onClose?.();
  };

  const handleSubmit = async () => {
    if (!serviceId || !assignEngineer) {
      setError("Please select an engineer.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const data = await assignServiceRecordEngineer(
        serviceId,
        assignEngineer,
        assignThirdPartyId,
      );
      const tpIdNum = assignThirdPartyId ? Number(assignThirdPartyId) : null;
      onAssigned?.({
        assigned_to: assignEngineer,
        third_party_engineer_id: tpIdNum,
        assigned_to_id: tpIdNum,
        assigned_to_type: tpIdNum ? "third_party" : "internal",
        engineer_assigned_by: data?.engineer_assigned_by,
      });
      onClose?.();
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !record) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div
        className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-labelledby="assign-service-title"
      >
        <button
          type="button"
          onClick={close}
          className="absolute right-3 top-3 text-slate-400 hover:text-slate-700"
          aria-label="Close"
        >
          ✕
        </button>
        <h3 id="assign-service-title" className="mb-4 text-lg font-semibold text-slate-800">
          Assign Service (ID: {serviceId})
        </h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Assign To (Internal)
            </label>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={assignEngineer}
              onChange={(e) => setAssignEngineer(e.target.value)}
            >
              <option value="NOT ASSIGNED">NOT ASSIGNED</option>
              {engineers.length > 0 ? (
                engineers.map((eng) => (
                  <option key={eng} value={eng}>
                    {eng}
                  </option>
                ))
              ) : (
                <option disabled>Loading…</option>
              )}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Third Party Engineer
            </label>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={assignThirdPartyId}
              onChange={(e) => setAssignThirdPartyId(e.target.value)}
            >
              <option value="">— Not assigned —</option>
              {thirdPartyEngineers.length > 0 ? (
                thirdPartyEngineers.map((eng) => (
                  <option key={eng.engineer_id} value={String(eng.engineer_id)}>
                    {eng.name}
                    {eng.state ? ` (${eng.state})` : ""}
                  </option>
                ))
              ) : (
                <option disabled>No third-party engineers</option>
              )}
            </select>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              disabled={submitting}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {submitting ? "Assigning…" : "Assign"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}