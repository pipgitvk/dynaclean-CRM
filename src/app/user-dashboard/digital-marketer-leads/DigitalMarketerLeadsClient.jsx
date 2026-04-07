"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { parseDmBulkCustomerCsv } from "@/lib/dmBulkUploadCsv";
import { DM_MODULE_ONLY_ASSIGNEE } from "@/lib/digitalMarketerLeadsAuth";

function formatLeadDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const REQUIRED_ROW = ["first_name", "phone"];

function getRowStatus(row) {
  const missing = REQUIRED_ROW.filter((f) => !row[f]?.toString().trim());
  if (missing.length > 0) {
    return { ok: false, reason: `Missing: ${missing.join(", ")}` };
  }
  const digits = String(row.phone ?? "").replace(/\D/g, "");
  const last10 = digits.length > 10 ? digits.slice(-10) : digits;
  if (!last10 || last10.length !== 10) {
    return { ok: false, reason: "Invalid phone (need 10 digits)" };
  }
  return { ok: true };
}

export default function DigitalMarketerLeadsClient({ viewerRole = "" }) {
  const isDm = viewerRole === "DIGITAL MARKETER";

  const bulkFileRef = useRef(null);
  const [leads, setLeads] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [assigningId, setAssigningId] = useState(null);
  const [selection, setSelection] = useState({});

  const [bulkRows, setBulkRows] = useState([]);
  const [bulkIsMeta, setBulkIsMeta] = useState(false);
  const [bulkFileName, setBulkFileName] = useState("");
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/digital-marketer-leads");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load");
        return;
      }
      setLeads(data.leads || []);
      setEmployees(data.employees || []);
    } catch (e) {
      console.error(e);
      setError("Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const kavyaUsername = useMemo(() => {
    const u = employees.find(
      (e) =>
        String(e).toUpperCase() === DM_MODULE_ONLY_ASSIGNEE.toUpperCase(),
    );
    return u ? String(u) : "";
  }, [employees]);

  const reassignEmployees = useMemo(
    () => (kavyaUsername ? [kavyaUsername] : []),
    [kavyaUsername],
  );

  const handleReassign = async (customerId) => {
    const employee_username = selection[customerId] || kavyaUsername;
    if (!employee_username) {
      return;
    }
    try {
      setAssigningId(customerId);
      setError(null);
      const res = await fetch("/api/digital-marketer-leads/reassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId, employee_username }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Re-assign failed");
        return;
      }
      await load();
      setSelection((prev) => {
        const next = { ...prev };
        delete next[customerId];
        return next;
      });
    } catch (e) {
      console.error(e);
      setError("Re-assign failed");
    } finally {
      setAssigningId(null);
    }
  };

  const handleBulkFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFileName(file.name);
    setBulkResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { rows: parsed, isMeta } = parseDmBulkCustomerCsv(
        ev.target?.result || "",
      );
      setBulkRows(parsed);
      setBulkIsMeta(isMeta);
      if (parsed.length === 0) {
        toast.error("No valid rows found in CSV");
      } else {
        toast.success(
          isMeta
            ? `Meta format: ${parsed.length} rows`
            : `Loaded ${parsed.length} rows`,
        );
      }
    };
    reader.readAsText(file);
  };

  const bulkValidRows = bulkRows.filter((r) => {
    if (!getRowStatus(r).ok) return false;
    return !!kavyaUsername;
  });

  const handleBulkUpload = async () => {
    if (!kavyaUsername) {
      toast.error("KAVYA is not in the sales rep list.");
      return;
    }
    if (bulkValidRows.length === 0) {
      toast.error(
        "No valid rows: check first_name and phone (10 digits).",
      );
      return;
    }
    setBulkUploading(true);
    setBulkResult(null);
    try {
      const res = await fetch("/api/digital-marketer-leads/bulk-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: bulkValidRows,
          employee_username: kavyaUsername,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Upload failed");
        return;
      }
      setBulkResult(data);
      toast.success(
        `Done: ${data.inserted} inserted, ${data.skipped} skipped`,
      );
      await load();
      setBulkRows([]);
      setBulkFileName("");
      if (bulkFileRef.current) bulkFileRef.current.value = "";
    } catch (err) {
      console.error(err);
      toast.error("Upload failed");
    } finally {
      setBulkUploading(false);
    }
  };

  const filtered = leads.filter((row) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const hay = [
      row.first_name,
      row.last_name,
      row.company,
      row.email,
      row.phone,
      row.lead_source,
      row.tags,
      row.notes,
      row.status,
      row.stage,
      row.products_interest,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto bg-white shadow-xl rounded-xl p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Fresh leads (last 24 hours)
            </h1>
            <p className="text-gray-600 mt-2 text-sm sm:text-base">
              Only leads created in the last 24 hours appear here. Re-assign is
              allowed within the same window; after 24 hours from creation, the
              lead leaves this list.
              {isDm ? (
                <span className="block mt-2 text-gray-700">
                  Each lead can be re-assigned once by you; after that, only
                  Super Admin or Admin can re-assign it.
                </span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="shrink-0 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-60"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <section className="mb-8 rounded-xl border border-gray-200 bg-slate-50/90 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Bulk upload (CSV → employee)
          </h2>
          
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <a
              href="/digital-marketer-leads-bulk-template.csv"
              download
              className="inline-flex items-center px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              Demo CSV (static)
            </a>
          </div>
          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CSV file
              </label>
              <input
                ref={bulkFileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleBulkFile}
                className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:bg-white file:text-gray-800"
              />
              {bulkFileName ? (
                <p className="text-xs text-gray-600 mt-1">
                  {bulkFileName}
                  {bulkIsMeta ? " · Meta format" : ""} · {bulkRows.length} rows ·{" "}
                  <span className="text-emerald-700 font-medium">
                    {bulkValidRows.length} ready to upload
                  </span>
                </p>
              ) : null}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assignee (fixed)
              </label>
              {kavyaUsername ? (
                <p className="text-sm font-medium text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 max-w-md">
                  All rows → {kavyaUsername}
                </p>
              ) : (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 max-w-md">
                  User &quot;KAVYA&quot; not found in sales reps. Add KAVYA in
                  rep_list.
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1 max-w-md">
                CSV column employee_username is ignored; leads go to KAVYA only.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={
                bulkUploading || bulkValidRows.length === 0 || !kavyaUsername
              }
              onClick={handleBulkUpload}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bulkUploading ? "Uploading…" : "Upload leads"}
            </button>
          </div>
          {bulkResult && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3 text-sm">
              <p className="font-medium text-gray-900">
                Inserted: {bulkResult.inserted} · Skipped: {bulkResult.skipped} ·
                Total processed: {bulkResult.total}
              </p>
              {bulkResult.errors?.length > 0 && (
                <ul className="mt-2 max-h-40 overflow-y-auto text-red-700 text-xs space-y-0.5">
                  {bulkResult.errors.slice(0, 30).map((err, i) => (
                    <li key={i}>
                      Row {err.row}: {err.reason}
                      {err.phone != null ? ` (${err.phone})` : ""}
                    </li>
                  ))}
                  {bulkResult.errors.length > 30 ? (
                    <li>… and {bulkResult.errors.length - 30} more</li>
                  ) : null}
                </ul>
              )}
            </div>
          )}
        </section>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, company, email, phone…"
            className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {loading && leads.length === 0 ? (
          <p className="text-gray-600">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-600">
            No leads in the last 24 hours{search.trim() ? " matching search" : ""}
            .
          </p>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
            <table className="min-w-[960px] w-full text-sm text-gray-900 border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/90">
                  <th className="px-4 py-3 text-left font-semibold text-gray-800">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-800">
                    Lead Source
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-800">
                    Tags
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-800">
                    Notes
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-800">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-800">
                    Stage
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-800">
                    Products Interest
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-800 whitespace-nowrap">
                    Date Created
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-800 min-w-[220px]">
                    Re-assign
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const fullName =
                    [row.first_name, row.last_name].filter(Boolean).join(" ") ||
                    "—";
                  const dmLocked =
                    isDm && Number(row.dm_reassign_exhausted) === 1;
                  return (
                    <tr
                      key={row.customer_id}
                      className="border-b border-gray-100 hover:bg-gray-50/80 align-top"
                    >
                      <td className="px-4 py-3 max-w-[240px]">
                        <div className="font-semibold text-gray-900 leading-snug">
                          {fullName}
                        </div>
                        <div className="text-gray-600 text-xs mt-0.5 break-all">
                          {row.email || "—"}
                        </div>
                        <div className="text-gray-600 text-xs mt-0.5">
                          {row.phone || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-800 whitespace-nowrap">
                        {row.lead_source || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[120px] break-words">
                        {row.tags || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[200px] break-words">
                        {row.notes || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-800 whitespace-nowrap">
                        {row.status || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-800 whitespace-nowrap">
                        {row.stage || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[160px] break-words">
                        {row.products_interest || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-800 whitespace-nowrap">
                        {formatLeadDate(row.date_created)}
                      </td>
                      <td className="px-4 py-3">
                        {dmLocked ? (
                          <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 max-w-[11rem] leading-snug">
                            Re-assigned
                          </p>
                        ) : (
                          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
                            <select
                              value={selection[row.customer_id] || kavyaUsername}
                              onChange={(e) =>
                                setSelection((prev) => ({
                                  ...prev,
                                  [row.customer_id]: e.target.value,
                                }))
                              }
                              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm min-w-[10rem] bg-white"
                              disabled={!kavyaUsername}
                            >
                              {!kavyaUsername ? (
                                <option value="">KAVYA not in list</option>
                              ) : (
                                reassignEmployees.map((u) => (
                                  <option key={u} value={u}>
                                    {u}
                                  </option>
                                ))
                              )}
                            </select>
                            <button
                              type="button"
                              disabled={
                                !kavyaUsername ||
                                assigningId === row.customer_id
                              }
                              onClick={() => handleReassign(row.customer_id)}
                              className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                              {assigningId === row.customer_id
                                ? "Saving…"
                                : "Re-assign"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
