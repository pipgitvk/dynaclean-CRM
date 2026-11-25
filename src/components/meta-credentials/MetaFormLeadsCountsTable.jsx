"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import { resolveLeadsHubRange } from "@/lib/leadsManageHubRange";
import { BarChart3, Loader2, Tag } from "lucide-react";

function ProductInterestBadge({ value }) {
  const text = String(value || "").trim();
  if (!text) return <span className="text-gray-400 text-sm">—</span>;
  return (
    <span className="inline-flex max-w-md items-start gap-1.5 rounded-md bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-800">
      <Tag className="mt-0.5 h-3 w-3 shrink-0" />
      <span className="break-words">{text}</span>
    </span>
  );
}

export default function MetaFormLeadsCountsTable({ formIds, productInterestByFormId = {} }) {
  const todayDefault = useMemo(() => resolveLeadsHubRange("today"), []);
  const [startDate, setStartDate] = useState(todayDefault.from);
  const [endDate, setEndDate] = useState(todayDefault.to);
  const [rows, setRows] = useState({});
  const [loading, setLoading] = useState({});

  useEffect(() => {
    if (!formIds?.length) return undefined;

    let cancelled = false;
    const loadingMap = Object.fromEntries(formIds.map((id) => [id, true]));
    setLoading(loadingMap);

    (async () => {
      const results = await Promise.all(
        formIds.map(async (formId) => {
          try {
            const res = await axios.get("/api/meta-leads", {
              params: {
                formId,
                limit: 0,
                skip: 0,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
              },
            });
            if (!res.data?.success) {
              return { formId, total: 0, imported: 0, notImported: 0 };
            }
            return {
              formId,
              total: res.data.pagination?.total ?? 0,
              imported: res.data.counts?.imported ?? 0,
              notImported: res.data.counts?.notImported ?? 0,
            };
          } catch (err) {
            console.error("Lead counts fetch failed:", err);
            return { formId, total: 0, imported: 0, notImported: 0 };
          }
        }),
      );

      if (cancelled) return;

      const nextRows = {};
      const nextLoading = {};
      for (const row of results) {
        nextRows[row.formId] = {
          total: row.total,
          imported: row.imported,
          notImported: row.notImported,
        };
        nextLoading[row.formId] = false;
      }
      setRows(nextRows);
      setLoading(nextLoading);
    })();

    return () => {
      cancelled = true;
    };
  }, [formIds, startDate, endDate]);

  const grandTotal = useMemo(
    () => formIds.reduce((sum, id) => sum + (Number(rows[id]?.total) || 0), 0),
    [formIds, rows],
  );

  if (!formIds?.length) {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
        No form IDs on this credential.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-md">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-violet-600" />
          <h2 className="text-lg font-semibold text-slate-900">Leads count</h2>
        </div>
        <p className="mb-4 text-sm text-slate-600">
          Lead counts for the selected date range (unique leads per form).
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[10rem]">
            <label className="mb-1 block text-xs font-medium text-slate-600">From</label>
            <TypeableDateFilterInput
              value={startDate}
              onChange={setStartDate}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="min-w-[10rem]">
            <label className="mb-1 block text-xs font-medium text-slate-600">To</label>
            <TypeableDateFilterInput
              value={endDate}
              onChange={setEndDate}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <p className="pb-2 text-sm font-semibold text-violet-700">
            Total (all forms): {grandTotal.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 font-semibold sm:px-6">Form ID</th>
              <th className="min-w-[12rem] px-4 py-3 font-semibold sm:px-6">Product interest</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-semibold sm:px-6">Total leads</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-semibold sm:px-6">Imported</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-semibold sm:px-6">Not imported</th>
            </tr>
          </thead>
          <tbody>
            {formIds.map((formId) => {
              const isLoading = loading[formId];
              const data = rows[formId];
              return (
                <tr key={formId} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-mono text-xs text-slate-800 sm:px-6">{formId}</td>
                  <td className="px-4 py-3 sm:px-6">
                    <ProductInterestBadge value={productInterestByFormId[formId]} />
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900 sm:px-6">
                    {isLoading ? (
                      <Loader2 className="ml-auto h-4 w-4 animate-spin text-violet-600" />
                    ) : (
                      (data?.total ?? 0).toLocaleString("en-IN")
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-700 sm:px-6">
                    {isLoading ? "—" : (data?.imported ?? 0).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3 text-right text-rose-700 sm:px-6">
                    {isLoading ? "—" : (data?.notImported ?? 0).toLocaleString("en-IN")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}