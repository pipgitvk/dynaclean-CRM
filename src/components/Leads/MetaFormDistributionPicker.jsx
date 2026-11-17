"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { ChevronDown, Loader2, Settings2, X } from "lucide-react";
import MetaFormAssignments from "@/components/MetaFormAssignments";

function FormDistributionMenu({
  open,
  onClose,
  triggerRef,
  forms,
  formLabel,
  onPick,
  loading,
}) {
  const menuRef = useRef(null);
  const [rect, setRect] = useState(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const margin = 12;
    const viewportW = window.innerWidth;
    setRect({
      top: r.bottom + 8,
      right: Math.max(margin, viewportW - r.right),
      minWidth: r.width,
      maxWidth: Math.min(512, viewportW - margin * 2),
    });
  }, [triggerRef]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition, forms.length]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      const t = e.target;
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, triggerRef]);

  if (!open || !rect || typeof document === "undefined") return null;

  return createPortal(
    <ul
      ref={menuRef}
      role="listbox"
      aria-label="Form distribution options"
      className="fixed z-[10050] max-h-[min(18rem,50vh)] overflow-y-auto rounded-md border border-slate-300 bg-white py-1 text-base text-slate-900 shadow-xl"
      style={{
        top: rect.top,
        right: rect.right,
        left: "auto",
        minWidth: rect.minWidth,
        maxWidth: rect.maxWidth,
        width: "max-content",
      }}
    >
      {loading && forms.length === 0 ? (
        <li className="px-3 py-2 text-slate-500">Loading forms…</li>
      ) : null}
      {forms.map((f) => {
        const label = formLabel(f);
        return (
          <li key={f.formId} role="presentation">
            <button
              type="button"
              role="option"
              className="w-full whitespace-normal px-3 py-2 text-left text-slate-900 transition hover:bg-blue-700 hover:text-white focus:bg-blue-700 focus:text-white focus:outline-none"
              onClick={() => {
                onPick(f.formId);
                onClose();
              }}
            >
              {label}
            </button>
          </li>
        );
      })}
    </ul>,
    document.body,
  );
}

export default function MetaFormDistributionPicker() {
  const [forms, setForms] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loadingForms, setLoadingForms] = useState(true);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [modalFormId, setModalFormId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef(null);

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

  const pickerDisabled = loadingForms || loadingEmployees;

  return (
    <>
      <div className="w-[12rem] shrink-0 sm:w-[14rem]">
        <button
          ref={triggerRef}
          type="button"
          disabled={pickerDisabled}
          onClick={() => setMenuOpen((o) => !o)}
          className="relative flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-violet-400/70 bg-violet-200/95 py-2.5 pl-10 pr-3 text-left text-base font-semibold text-slate-900 shadow-sm hover:border-violet-500/80 hover:bg-violet-300/90 focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          aria-label="Open form lead distribution"
        >
          <Settings2 className="pointer-events-none absolute left-3 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-violet-700" />
          <span className="truncate">
            {loadingForms ? "Loading forms…" : "Form distribution"}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-violet-800/80 transition-transform ${menuOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      </div>

      <FormDistributionMenu
        open={menuOpen && !pickerDisabled}
        onClose={() => setMenuOpen(false)}
        triggerRef={triggerRef}
        forms={forms}
        formLabel={formLabel}
        loading={loadingForms}
        onPick={setModalFormId}
      />

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