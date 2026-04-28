"use client";

import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { Loader2, Upload } from "lucide-react";
import { canBulkImportAttendance } from "@/lib/attendanceBulkImportRoles";
import {
  parseAttendanceImportFile,
  buildImportPayloadRows,
} from "@/lib/attendanceImportFile";

/**
 * Bulk attendance import (HR). Calls /api/empcrm/attendance/import.
 * @param {() => void | Promise<void>} [props.onComplete] — e.g. refetch logs
 * @param {boolean} [props.showCard] — bordered panel with title (user-dashboard); false = inline toolbar (empcrm)
 */
export default function AttendanceBulkImportPanel({
  onComplete,
  showCard = false,
}) {
  const [visible, setVisible] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const importFileInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me");
        if (!res.ok) return;
        const me = await res.json();
        if (!cancelled && canBulkImportAttendance(me.userRole)) setVisible(true);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAttendanceImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportLoading(true);
    try {
      const parsed = await parseAttendanceImportFile(file);
      const placeholderUsers = new Set([
        "replace_with_username",
        "your_username",
        "replace_with_username_1",
        "replace_with_username_2",
        "replace_with_username_3",
        // Legacy sample rows
        "demo_user_one",
        "demo_user_two",
        "demo_user_three",
      ]);
      const rows = buildImportPayloadRows(parsed).filter(
        (r) => r.username && !placeholderUsers.has(r.username.toLowerCase())
      );
      if (rows.length === 0) {
        toast.error(
          "No rows to import. Replace REPLACE_WITH_USERNAME_1 / _2 / _3 (or each username column) with real CRM login usernames — different rows can be different employees."
        );
        return;
      }
      const res = await fetch("/api/empcrm/attendance/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Import failed");
      }
      const ins = data.inserted ?? 0;
      const up = data.updated ?? 0;
      const sk = data.skipped ?? 0;
      const sun = data.sunday_weekly_off ?? 0;
      const ok = ins + up;
      const uniqueEmployees = new Set(rows.map((r) => String(r.username || "").trim().toLowerCase()).filter(Boolean)).size;
      const sunPart =
        sun > 0
          ? ` ${sun} Sunday row(s) treated as weekly off (no punch stored).`
          : "";
      if (data.errors?.length) {
        const first = data.errors[0];
        toast.error(
          `Applied ${ok} row(s) (${ins} new, ${up} updated, ${uniqueEmployees} employee${uniqueEmployees === 1 ? "" : "s"} in file), ${sk} skipped (already has check-in or check-out), ${data.failed} failed.${sunPart} Row ${first?.row}: ${first?.message}`,
          { duration: 8000 }
        );
      } else {
        const skipPart =
          sk > 0
            ? `, ${sk} skipped (already has check-in or check-out)`
            : "";
        toast.success(
          `Done: ${ins} inserted, ${up} updated (${uniqueEmployees} employee${uniqueEmployees === 1 ? "" : "s"})${skipPart}.${sunPart}`
        );
      }
      await onComplete?.();
    } catch (err) {
      toast.error(err.message || "Could not import file");
    } finally {
      setImportLoading(false);
    }
  };

  if (!visible) return null;

  const controls = (
    <>
      <input
        ref={importFileInputRef}
        type="file"
        accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={handleAttendanceImport}
      />
      <button
        type="button"
        onClick={() => importFileInputRef.current?.click()}
        disabled={importLoading}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-800 shadow-sm hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {importLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {importLoading ? "Importing…" : "Import"}
      </button>
      <a
        href="/api/attendance/import-template"
        download="attendance_import_template.csv"
        className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
      >
        Sample file
      </a>
    </>
  );

  if (showCard) {
    return (
      <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">
          Bulk attendance import
        </h2>
        <p className="mt-1 text-xs text-gray-600">
          Upload CSV or Excel (same columns as sample).{" "}
          <strong>Multiple employees in one file:</strong> each row has its own{" "}
          <code className="rounded bg-white/80 px-1">username</code> — one import applies
          attendance for everyone in the sheet. New days are inserted; empty punch rows are
          updated; rows that already have check-in or check-out are skipped.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">{controls}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 sm:items-start">
      <div className="flex flex-wrap items-center gap-2">{controls}</div>
      <p className="max-w-xs text-[11px] leading-snug text-gray-500 sm:max-w-md">
        One file can import{" "}
        <span className="font-medium text-gray-600">multiple employees</span> — each row uses that
        person&apos;s CRM username.
      </p>
    </div>
  );
}
