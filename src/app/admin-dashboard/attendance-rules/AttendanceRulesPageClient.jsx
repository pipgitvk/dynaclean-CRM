"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { Pencil, X } from "lucide-react";
import AttendanceRulesAdminClient from "./AttendanceRulesAdminClient";

function fmtTime(v) {
  if (v == null || v === "") return "—";
  const s = String(v).trim();
  if (s.length >= 5) return s.slice(0, 5);
  return s;
}

export default function AttendanceRulesPageClient() {
  const [modalOpen, setModalOpen] = useState(false);
  /** null = add new; row object = edit that employee's timings */
  const [editEmployeeRow, setEditEmployeeRow] = useState(null);
  const [modalSession, setModalSession] = useState(0);
  const [rows, setRows] = useState([]);
  const [tableSearch, setTableSearch] = useState("");
  const [tableLoading, setTableLoading] = useState(true);
  const [tableError, setTableError] = useState(null);

  const filteredRows = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((e) => {
      const hay = [e.username, e.email, e.userRole, e.empId != null ? String(e.empId) : ""]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, tableSearch]);

  const loadTable = useCallback(async () => {
    setTableLoading(true);
    setTableError(null);
    try {
      const res = await fetch(
        "/api/admin/employee-attendance-schedule?onlyWithSchedule=1",
        { credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to load");
      setRows(data.employees || []);
    } catch (e) {
      setTableError(e.message || "Load failed");
      setRows([]);
    } finally {
      setTableLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  /** After batch apply: reload table, then close modal so updated list is visible */
  const onEmployeeRulesApplied = useCallback(async () => {
    await loadTable();
    setModalOpen(false);
    setEditEmployeeRow(null);
  }, [loadTable]);

  const openAddModal = useCallback(() => {
    setEditEmployeeRow(null);
    setModalSession((s) => s + 1);
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((row) => {
    setEditEmployeeRow(row);
    setModalSession((s) => s + 1);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditEmployeeRow(null);
  }, []);

  return (
    <div className="mx-auto w-full max-w-screen-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:p-8 dark:border-slate-200 dark:bg-white">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          Attendance rules
        </h1>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-slate-800">
            Employees with custom rules
          </h2>
          {!tableLoading && !tableError && rows.length > 0 ? (
            <p className="mt-0.5 text-xs text-slate-500">
              {rows.length} employee{rows.length === 1 ? "" : "s"} — timings saved in database
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-slate-800"
        >
          Add rule employee
        </button>
      </div>

      {!tableLoading && !tableError && rows.length > 0 ? (
        <div className="mb-3">
          <label htmlFor="attendance-rules-table-search" className="sr-only">
            Search employees in table
          </label>
          <input
            id="attendance-rules-table-search"
            type="search"
            placeholder="Search by name, email, role…"
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            className="h-9 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200/80"
          />
          {tableSearch.trim() ? (
            <p className="mt-1.5 text-xs text-slate-500">
              Showing {filteredRows.length} of {rows.length} employee{rows.length === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        {tableLoading ? (
          <p className="p-8 text-center text-sm text-slate-600">Loading…</p>
        ) : tableError ? (
          <p className="p-8 text-center text-sm text-amber-700">{tableError}</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No custom rules yet. Click <strong>Add rule employee</strong> to choose employees and set
            timings.
          </p>
        ) : filteredRows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No employees match your search. Try a different keyword or clear the search box.
          </p>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-700">Employee</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700">Check-in</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700">Checkout</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700">Grace</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700">Half-day in</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700">Half-day out</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700">Morning</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700">Lunch</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700">Evening</th>
                <th className="px-4 py-3 text-left font-medium text-slate-700">Brk grace</th>
                <th className="px-4 py-3 text-right font-medium text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredRows.map((e) => (
                <tr key={e.username} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{e.username}</div>
                    <div className="text-xs text-slate-500">{e.userRole}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {fmtTime(e.checkin_time)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {fmtTime(e.checkout_time)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {e.grace_period_minutes != null ? `${e.grace_period_minutes} min` : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {fmtTime(e.half_day_checkin_time)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {fmtTime(e.half_day_checkout_time)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {fmtTime(e.break_morning)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {fmtTime(e.break_lunch)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {fmtTime(e.break_evening)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {e.break_grace_period_minutes != null
                      ? `${e.break_grace_period_minutes} min`
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEditModal(e)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                      <Pencil size={14} aria-hidden />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={modalOpen} onClose={closeModal} transition className="relative z-[200]">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-slate-900/50 transition duration-200 ease-out data-[closed]:opacity-0"
        />
        <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4 sm:p-6">
          <DialogPanel
            transition
            className="max-h-[min(92vh,900px)] w-full max-w-4xl transform overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl transition duration-200 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 sm:p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <DialogTitle className="text-lg font-semibold text-slate-900">
                  {editEmployeeRow?.username
                    ? `Edit timings — ${editEmployeeRow.username}`
                    : "Company rules & employee timings"}
                </DialogTitle>
                <p className="mt-1 text-xs text-slate-500">
                  {editEmployeeRow?.username
                    ? "Update times below, then Apply to save this employee’s schedule."
                    : "Tick employees, set times below, then apply — or save company defaults for everyone."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            {modalOpen ? (
              <AttendanceRulesAdminClient
                key={modalSession}
                editEmployeeRow={editEmployeeRow ?? undefined}
                onRulesChanged={onEmployeeRulesApplied}
              />
            ) : null}
          </DialogPanel>
        </div>
      </Dialog>
    </div>
  );
}
