"use client";

import { buildOpenInstallationServiceLineItems } from "@/lib/openInstallationServiceLineItems";
import { OpenInstallationServiceLineTableRow } from "@/components/installation/OpenInstallationServiceLineCard";

export default function OpenInstallationServicesModal({
  isOpen,
  onClose,
  title,
  row,
  dashboardBase = "",
  role,
  onRowPatched,
  showStatusEditor = true,
  showSerial = true,
}) {
  if (!isOpen || !row) return null;

  const lines = buildOpenInstallationServiceLineItems(row);
  const modalTitle = title || `Services (${lines.length})`;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[min(85vh,560px)] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-900">{modalTitle}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
        <div className="max-h-[calc(min(85vh,560px)-3.5rem)] overflow-auto p-2 sm:p-3">
          {lines.length === 0 ? (
            <p className="p-3 text-sm text-slate-500">No service lines found.</p>
          ) : (
            <table className="w-full min-w-[720px] border-collapse text-left text-xs text-slate-800">
              <thead className="sticky top-0 z-[1] bg-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2">Service ID</th>
                  {showSerial ? (
                    <th className="border-b border-slate-200 px-3 py-2">S/N</th>
                  ) : null}
                  <th className="border-b border-slate-200 px-3 py-2">Product</th>
                  <th className="border-b border-slate-200 px-3 py-2">Status</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right">Report</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <OpenInstallationServiceLineTableRow
                    key={line.serviceId}
                    row={row}
                    line={line}
                    dashboardBase={dashboardBase}
                    role={role}
                    onRowPatched={onRowPatched}
                    showStatusEditor={showStatusEditor}
                    showSerial={showSerial}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}