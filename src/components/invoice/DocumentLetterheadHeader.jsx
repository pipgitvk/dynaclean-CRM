"use client";

import { useCallback, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import Image from "next/image";
import { Pencil, Upload } from "lucide-react";
import toast from "react-hot-toast";
import LetterheadDocumentBlock from "@/components/invoice/LetterheadDocumentBlock";
import {
  InvoiceLetterheadInlineFields,
} from "@/components/invoice/LetterheadInvoiceLayout";
import { useUser } from "@/context/UserContext";
import {
  canEditDocumentLetterhead,
  mergeDocumentFromCompany,
  resolveLogoSrc,
} from "@/lib/documentFromCompany";

const FIELD_META = [
  { key: "from_company", label: "Company name" },
  { key: "from_address", label: "Address", multiline: true },
  { key: "from_mobile", label: "Phone" },
  { key: "from_email", label: "Email" },
  { key: "from_gst", label: "GSTIN" },
  { key: "from_state", label: "State" },
  { key: "CIN_new", label: "CIN" },
];

export default forwardRef(function DocumentLetterheadHeader(
  {
    values,
    onChange,
    readOnly = false,
    variant = "quotation",
    onLetterheadPersist,
    persistTargetId,
  },
  ref,
) {
  const resolved = useMemo(
    () => mergeDocumentFromCompany(values),
    [values],
  );
  const [showEdit, setShowEdit] = useState(false);
  const [draft, setDraft] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef(null);
  const snapshotRef = useRef(null);
  const resolvedRef = useRef(resolved);
  resolvedRef.current = resolved;
  const draftRef = useRef(null);
  const { user } = useUser();
  const mayEditLetterhead = canEditDocumentLetterhead(user);
  const editable = Boolean(onChange) && !readOnly && mayEditLetterhead;

  const editValues = draft ?? resolved;
  const logoPreviewSrc = resolveLogoSrc(editValues.logo_file);

  const openEdit = useCallback(() => {
    snapshotRef.current = { ...resolved };
    const initial = { ...resolved };
    draftRef.current = initial;
    setDraft(initial);
    setShowEdit(true);
  }, [resolved]);

  const closeEdit = useCallback(
    (revert = false) => {
      if (revert && snapshotRef.current && onChange && !readOnly) {
        onChange({ ...snapshotRef.current });
      }
      draftRef.current = null;
      snapshotRef.current = null;
      setDraft(null);
      setShowEdit(false);
    },
    [onChange, readOnly],
  );

  useImperativeHandle(
    ref,
    () => ({
      getMergedForSave() {
        const d = draftRef.current;
        const base = resolvedRef.current;
        return mergeDocumentFromCompany(
          d ? { ...base, ...d } : base,
        );
      },
    }),
    [],
  );

  const buildLetterheadBody = useCallback((merged, letterheadOnly) => {
    const out = letterheadOnly ? { letterhead_only: true } : {};
    for (const key of [
      "from_company",
      "from_gst",
      "from_address",
      "from_mobile",
      "from_email",
      "from_state",
      "logo_file",
      "CIN_new",
    ]) {
      out[key] = merged[key] ?? null;
    }
    return out;
  }, []);

  const persistLetterhead = useCallback(
    async (merged) => {
      if (onLetterheadPersist) {
        await onLetterheadPersist(merged);
        return merged;
      }
      if (!persistTargetId?.id) {
        throw new Error(
          "Letterhead database save is not available until this document is saved once.",
        );
      }

      const isInvoice = persistTargetId.type === "invoice";
      const url = isInvoice
        ? `/api/invoices/${persistTargetId.id}`
        : `/api/quotations/${encodeURIComponent(String(persistTargetId.id))}/letterhead`;

      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildLetterheadBody(merged, isInvoice)),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || "Letterhead save failed");
      }
      return data.letterhead ? mergeDocumentFromCompany(data.letterhead) : merged;
    },
    [buildLetterheadBody, onLetterheadPersist, persistTargetId],
  );

  const patchDraft = useCallback(
    (key, val) => {
      setDraft((prev) => {
        const next = { ...(prev ?? resolved), [key]: val };
        draftRef.current = next;
        if (onChange && !readOnly) {
          onChange(next);
        }
        return next;
      });
    },
    [onChange, readOnly, resolved],
  );

  const handleSave = useCallback(async () => {
    if (readOnly) return;
    const merged = mergeDocumentFromCompany({
      ...resolvedRef.current,
      ...(draftRef.current ?? {}),
    });
    try {
      const saved = await persistLetterhead(merged);
      if (onChange) onChange(saved);
      toast.success("Letterhead saved to database");
      closeEdit(false);
    } catch (err) {
      toast.error(err?.message || "Could not save letterhead");
    }
  }, [closeEdit, onChange, persistLetterhead, readOnly]);

  const handleLogoFileChange = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file || readOnly || !onChange) return;

      const looksLikeImage =
        file.type.startsWith("image/") ||
        /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name || "");
      if (!looksLikeImage) {
        alert("Please choose an image file (PNG, JPG, etc.).");
        e.target.value = "";
        return;
      }

      setLogoUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload-letterhead-logo", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok || !data.url) {
          throw new Error(data.error || "Upload failed");
        }
        const url = String(data.url).trim();
        patchDraft("logo_file", url);
        toast.success("Logo uploaded.");
      } catch (err) {
        alert(err.message || "Logo upload failed.");
      } finally {
        setLogoUploading(false);
        e.target.value = "";
      }
    },
    [patchDraft, readOnly],
  );

  return (
    <div className="w-full space-y-2">
      {variant === "invoice" && showEdit && draft ? (
        <>
          <InvoiceLetterheadInlineFields
            draft={draft}
            onPatch={patchDraft}
            logoSlot={
              <div className="flex flex-wrap items-center gap-3 text-left text-xs text-gray-600">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoFileChange}
                  disabled={logoUploading}
                />
                <button
                  type="button"
                  disabled={logoUploading}
                  onClick={() => logoInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {logoUploading ? "Uploading…" : "Change logo"}
                </button>
                <input
                  type="text"
                  className="input flex-1 min-w-[180px] text-sm"
                  value={draft.logo_file || ""}
                  onChange={(e) => patchDraft("logo_file", e.target.value)}
                  placeholder="Logo path (optional)"
                />
              </div>
            }
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Save letterhead
            </button>
            <button
              type="button"
              onClick={() => closeEdit(true)}
              className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-100"
            >
              Cancel
            </button>
            <span className="text-xs text-gray-500">
              Invoice header updates after Save letterhead
            </span>
          </div>
        </>
      ) : (
        <LetterheadDocumentBlock values={resolved} variant={variant} />
      )}

      {editable && (
        <>
          <button
            type="button"
            onClick={() => (showEdit ? closeEdit(true) : openEdit())}
            className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 underline"
          >
            <Pencil className="w-3.5 h-3.5" />
            {showEdit ? "Hide letterhead fields" : "Edit letterhead details"}
          </button>

          {showEdit && draft && variant !== "invoice" && (
            <div className="border border-gray-200 rounded-lg bg-gray-50 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-start gap-4 pb-1 border-b border-gray-200">
                <div className="shrink-0">
                  <span className="block text-xs font-medium text-gray-600 mb-1">
                    Logo preview (unsaved)
                  </span>
                  <div className="w-[110px] h-[72px] border border-gray-300 bg-white flex items-center justify-center rounded">
                    <Image
                      src={logoPreviewSrc}
                      alt="Logo preview"
                      width={110}
                      height={72}
                      className="max-h-[72px] w-auto object-contain"
                      unoptimized
                    />
                  </div>
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <span className="block text-xs font-medium text-gray-600">
                    Company logo
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoFileChange}
                      disabled={logoUploading}
                    />
                    <button
                      type="button"
                      disabled={logoUploading}
                      onClick={() => logoInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {logoUploading ? "Uploading…" : "Upload logo"}
                    </button>
                    <span className="text-xs text-gray-500">
                      PNG/JPG, max 2 MB — applies on Save
                    </span>
                  </div>
                  <label className="block">
                    <span className="block text-xs font-medium text-gray-600 mb-1">
                      Logo URL / path (optional)
                    </span>
                    <input
                      type="text"
                      className="input w-full"
                      value={draft.logo_file || ""}
                      onChange={(e) => patchDraft("logo_file", e.target.value)}
                      placeholder="/images/logo.png or https://…"
                    />
                  </label>
                </div>
              </div>
              {FIELD_META.map(({ key, label, multiline }) => (
                <label
                  key={key}
                  className={multiline ? "sm:col-span-2" : ""}
                >
                  <span className="block text-xs font-medium text-gray-600 mb-1">
                    {label}
                  </span>
                  {multiline ? (
                    <textarea
                      className="input w-full min-h-[72px]"
                      value={draft[key] || ""}
                      onChange={(e) => patchDraft(key, e.target.value)}
                    />
                  ) : (
                    <input
                      type="text"
                      className="input w-full"
                      value={draft[key] || ""}
                      onChange={(e) => patchDraft(key, e.target.value)}
                    />
                  )}
                </label>
              ))}
              <div className="sm:col-span-2 flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
                >
                  Save letterhead
                </button>
                <button
                  type="button"
                  onClick={() => closeEdit(true)}
                  className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-100"
                >
                  Cancel
                </button>
                <span className="text-xs text-gray-500">
                  Fields sync to the form as you type — save invoice/quotation to store in database
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
});
