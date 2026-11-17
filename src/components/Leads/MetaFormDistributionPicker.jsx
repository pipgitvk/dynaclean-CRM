"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Loader2, Settings2, X } from "lucide-react";
import MetaFormAssignments from "@/components/MetaFormAssignments";

export default function MetaFormDistributionPicker() {
  const [forms, setForms] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loadingForms, setLoadingForms] = useState(true);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [modalFormId, setModalFormId] = useState(null);
  const [pickerValue, setPickerValue] = useState("");

  const loadForms = useCallback(async () => {
    setLoadingForms(true);
    try {
      const res = await axios.get("/api/leads-manage/meta-forms");
      if (res.data?.success) {
        setForms(res.data.data || []);
        setForbidden(false);
      }
    } catch (err) {
      if (err?.response?.status === 403) setForbidden(true);
      console.error(err);
    } finally {
      setLoadingForms(false);
    }
  }, []);

  useEffect(() => {
    loadForms();
    axios
      .get("/api/employees/active")
      .then((res) => {
        if (res.data?.success) setEmployees(res.data.data || []);
      })
      .catch(console.error)
      .finally(() => setLoadingEmployees(false));
  }, [loadForms]);

  const selectedForm = forms.find((f) => f.formId === modalFormId);

  if (forbidden) return null;

  const formLabel = (f) => {
    const campaign = f.campaignName?.trim();
    if (campaign) return `${campaign} · ${f.formId}`;
    return f.formId;
  };

  return (
    <>
      <div className="relative inline-flex min-w-[12rem] max-w-[22rem] items-center sm:min-w-[14rem]">
        <Settings2 className="pointer-events-none absolute left-3 z-10 h-[1.125rem] w-[1.125rem] text-violet-700" />
        <select
          value={pickerValue}
          disabled={loadingForms || loadingEmployees}
          onChange={(e) => {
            const v = e.target.value;
            setPickerValue(v);
            if (v) {
              setModalFormId(v);
              setPickerValue("");
            }
          }}
          className="w-full cursor-pointer appearance-none rounded-xl border border-violet-400/70 bg-violet-200/95 py-2.5 pl-10 pr-8 text-base font-semibold text-slate-900 shadow-sm hover:border-violet-500/80 hover:bg-violet-300/90 focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:opacity-60"
          aria-label="Open form lead distribution"
        >
          <option value="">
            {loadingForms ? "Loading forms…" : "Form distribution"}
          </option>
          {forms.map((f) => (
            <option key={f.formId} value={f.formId}>
              {formLabel(f)}
            </option>
          ))}
        </select>
      </div>

      {modalFormId ? (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/50 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="meta-form-distribution-title"
          onClick={() => setModalFormId(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-6">
              <div className="min-w-0">
                <h2
                  id="meta-form-distribution-title"
                  className="text-lg font-bold text-slate-900"
                >
                  Form-Specific Lead Distribution
                </h2>
                {selectedForm ? (
                  <p className="mt-1 truncate text-sm text-slate-600">
                    {selectedForm.campaignName ? (
                      <>
                        <span className="font-medium text-slate-800">
                          {selectedForm.campaignName}
                        </span>
                        <span className="text-slate-400"> · </span>
                      </>
                    ) : null}
                    <span className="font-mono text-xs">{selectedForm.formId}</span>
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setModalFormId(null)}
                className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-4 sm:px-6">
              {loadingEmployees ? (
                <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading employees…
                </div>
              ) : (
                <MetaFormAssignments
                  embedded
                  formIds={[modalFormId]}
                  employees={employees}
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}