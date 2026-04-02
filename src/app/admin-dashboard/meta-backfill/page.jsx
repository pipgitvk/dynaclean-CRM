"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Eye, X } from "lucide-react";

const CRON_HISTORY_KEY = "meta-backfill-cron-history";
const AUTO_POLL_KEY = "meta-backfill-auto-poll-enabled";
const MAX_HISTORY = 50;
/** Fixed assigner for "assigned_by" View (not editable in UI) */
const ASSIGNED_BY_FIXED_USERNAME = "harsh_M";

/** Map customers.lead_campaign to summary bucket (Campaign column) */
function campaignLeadBucket(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, "_");
  if (s === "social_media" || s === "socialmedia") return "social_media";
  if (s === "google" || s === "google_ads" || s === "googleads") return "google";
  if (s === "indiamart" || s === "india_mart" || s === "india-mart") return "indiamart";
  return null;
}

function getAutoPollEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(AUTO_POLL_KEY) === "1";
  } catch {
    return false;
  }
}

function setAutoPollEnabled(value) {
  try {
    localStorage.setItem(AUTO_POLL_KEY, value ? "1" : "0");
  } catch {}
}

function getCronHistory() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CRON_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addCronHistory(entry) {
  const list = getCronHistory();
  list.unshift({
    ...entry,
    timestamp: new Date().toISOString(),
  });
  localStorage.setItem(CRON_HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
}

export default function MetaBackfillPage() {
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [diagnoseLoading, setDiagnoseLoading] = useState(false);
  const [diagnoseResult, setDiagnoseResult] = useState(null);
  const [autoImportEnabled, setAutoImportEnabled] = useState(true);
  const [leadsReportLoading, setLeadsReportLoading] = useState(false);
  const [leadsReport, setLeadsReport] = useState(null);
  const [cronTestLoading, setCronTestLoading] = useState(false);
  const [cronTestResult, setCronTestResult] = useState(null);
  const [autoPollEnabled, setAutoPollEnabledState] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [cronHistory, setCronHistory] = useState([]);
  const pollCountRef = useRef(0);
  const [reportDetailOpen, setReportDetailOpen] = useState(false);
  const [reportDetailEmployee, setReportDetailEmployee] = useState(null);
  const [reportDetailLeads, setReportDetailLeads] = useState([]);
  const [reportDetailLoading, setReportDetailLoading] = useState(false);
  const [reportDetailError, setReportDetailError] = useState("");
  const [assignedByOpen, setAssignedByOpen] = useState(false);
  const [assignedByLeads, setAssignedByLeads] = useState([]);
  const [assignedByLoading, setAssignedByLoading] = useState(false);
  const [assignedByError, setAssignedByError] = useState("");
  const [assignerDetailOpen, setAssignerDetailOpen] = useState(false);
  const [assignerDetailName, setAssignerDetailName] = useState(null);
  const [assignerDetailLeads, setAssignerDetailLeads] = useState([]);
  const [assignerDetailLoading, setAssignerDetailLoading] = useState(false);
  const [assignerDetailError, setAssignerDetailError] = useState("");

  /** Per assigned_to row: counts by lead_campaign bucket (from API byCampaignAndAssigner) */
  const assignerCampaignBreakdown = useMemo(() => {
    const map = new Map();
    const rows = leadsReport?.byCampaignAndAssigner;
    if (!rows?.length) return map;
    for (const r of rows) {
      const key = r.assigner;
      if (!map.has(key)) {
        map.set(key, { social_media: 0, google: 0, indiamart: 0, other: 0 });
      }
      const b = map.get(key);
      const n = Number(r.leadCount) || 0;
      const c = r.campaign;
      if (c === "social_media") b.social_media += n;
      else if (c === "google") b.google += n;
      else if (c === "indiamart") b.indiamart += n;
      else b.other += n;
    }
    return map;
  }, [leadsReport?.byCampaignAndAssigner]);

  const assignedByCampaignTotals = useMemo(() => {
    const totals = { social_media: 0, indiamart: 0, google: 0 };
    for (const lead of assignedByLeads) {
      const b = campaignLeadBucket(lead.lead_campaign);
      if (b === "social_media") totals.social_media += 1;
      else if (b === "indiamart") totals.indiamart += 1;
      else if (b === "google") totals.google += 1;
    }
    return totals;
  }, [assignedByLeads]);

  /** Total = sum of all employee buckets (table + hidden harsh_M), not raw API total */
  const leadsReportBreakdown = useMemo(() => {
    const rows = leadsReport?.byEmployee;
    if (!rows?.length) {
      return { grand: leadsReport?.total ?? 0, visible: 0, harsh: 0 };
    }
    let harsh = 0;
    let visible = 0;
    for (const r of rows) {
      const n = Number(r.leadCount) || 0;
      if (String(r.employee ?? "").toLowerCase() === "harsh_m") harsh += n;
      else visible += n;
    }
    return { grand: visible + harsh, visible, harsh };
  }, [leadsReport]);

  // Hydrate auto-poll from localStorage (persists across refresh)
  useEffect(() => {
    setAutoPollEnabledState(getAutoPollEnabled());
  }, []);

  // API call every 10 min when auto-poll is on (direct meta-backfill - fast response)
  useEffect(() => {
    if (!autoPollEnabled) return;
    const run = async () => {
      pollCountRef.current += 1;
      setCronTestResult({ ok: null, data: { loading: true }, count: pollCountRef.current });
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 120000); // 2 min max
        const res = await fetch("/api/meta-backfill?mode=all&autoImport=1", { signal: ctrl.signal });
        clearTimeout(timeout);
        const data = await res.json();
        setCronTestResult({
          ok: res.ok,
          data: res.ok
            ? { imported: data?.importSummary?.imported ?? 0, skipped: data?.importSummary?.skipped ?? 0 }
            : { error: data?.error || data?.message || "Failed" },
          count: pollCountRef.current,
        });
      } catch (err) {
        setCronTestResult({
          ok: false,
          data: { error: err.name === "AbortError" ? "Timeout (2 min)" : err.message },
          count: pollCountRef.current,
        });
      }
    };
    run(); // first call immediately
    const id = setInterval(run, 10 * 60 * 1000); // then every 10 min
    return () => clearInterval(id);
  }, [autoPollEnabled]);

  // Save to history when result comes (skip loading state)
  useEffect(() => {
    if (cronTestResult?.data?.loading || cronTestResult?.ok === undefined || cronTestResult?.ok === null) return;
    addCronHistory({
      status: cronTestResult.ok ? "success" : "failed",
      imported: cronTestResult.data?.imported ?? 0,
      skipped: cronTestResult.data?.skipped ?? 0,
      error: cronTestResult.data?.error,
      source: autoPollEnabled ? "auto-poll" : "test-cron",
      callNum: cronTestResult.count,
    });
  }, [cronTestResult?.ok, cronTestResult?.data?.loading, cronTestResult?.data?.imported, cronTestResult?.data?.skipped, cronTestResult?.data?.error, cronTestResult?.count, autoPollEnabled]);

  const handleFetch = async (e) => {
    e.preventDefault();
    setMessage("");
    setLeads([]);
    if (!since || !until) {
      setMessage("Please select both dates");
      return;
    }
    setLoading(true);
    try {
      const baseUrl = `/api/meta-backfill?since=${since}&until=${until}`;
      const url = autoImportEnabled ? `${baseUrl}&autoImport=1` : baseUrl;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        const metaMsg = data?.metaError?.message || data?.metaError?.error?.message || data?.message;
        setMessage(metaMsg ? `Meta error: ${metaMsg}` : "Failed to fetch leads from Meta");
        return;
      }
      setLeads(data.leads || []);
      const importInfo =
        autoImportEnabled && data.importSummary
          ? ` Auto-imported: ${data.importSummary.imported}, Skipped: ${data.importSummary.skipped}, Errors: ${data.importSummary.errors}.`
          : "";
      setMessage(
        `Total in DB: ${data.total_leads_in_db ?? "—"}, Total from Meta: ${data.total_from_meta}, In range: ${data.total_in_range}, Existing in DB: ${data.existing_in_db}, New: ${data.new_count}.${importInfo}`,
      );
    } catch (err) {
      console.error(err);
      setMessage("Error fetching leads");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchAll = async () => {
    setMessage("");
    setLeads([]);
    setLoading(true);
    try {
      const baseUrl = `/api/meta-backfill?mode=all`;
      const url = autoImportEnabled ? `${baseUrl}&autoImport=1` : baseUrl;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        const metaMsg = data?.metaError?.message || data?.metaError?.error?.message || data?.message;
        setMessage(metaMsg ? `Meta error: ${metaMsg}` : "Failed to fetch all leads from Meta");
        return;
      }
      setLeads(data.leads || []);
      const importInfo =
        autoImportEnabled && data.importSummary
          ? ` Auto-imported: ${data.importSummary.imported}, Skipped: ${data.importSummary.skipped}, Errors: ${data.importSummary.errors}.`
          : "";
      setMessage(
        `Total in DB: ${data.total_leads_in_db ?? "—"}, Total from Meta: ${data.total_from_meta}, New (not in DB): ${data.new_count}.${importInfo}`,
      );
    } catch (err) {
      console.error(err);
      setMessage("Error fetching all leads");
    } finally {
      setLoading(false);
    }
  };

  const handleLeadsReport = async () => {
    setLeadsReport(null);
    if (!since || !until) {
      setMessage("Please select both From and To dates");
      return;
    }
    setLeadsReportLoading(true);
    try {
      const res = await fetch(`/api/meta-backfill/leads-report?from=${since}&to=${until}`);
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.error || "Failed to fetch leads report");
        return;
      }
      setLeadsReport(data);
      setMessage("");
    } catch (err) {
      console.error(err);
      setMessage("Error fetching leads report");
    } finally {
      setLeadsReportLoading(false);
    }
  };

  const openAssignerLeadDetails = async (assignerLabel) => {
    if (!since || !until) return;
    setAssignerDetailName(assignerLabel);
    setAssignerDetailLeads([]);
    setAssignerDetailError("");
    setAssignerDetailOpen(true);
    setAssignerDetailLoading(true);
    try {
      const q = new URLSearchParams({
        from: since,
        to: until,
        assigner: assignerLabel,
      });
      const res = await fetch(`/api/meta-backfill/leads-report/by-assigner?${q.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setAssignerDetailError(data?.error || "Failed to load leads");
        return;
      }
      setAssignerDetailLeads(data.leads || []);
    } catch (err) {
      console.error(err);
      setAssignerDetailError("Error loading leads");
    } finally {
      setAssignerDetailLoading(false);
    }
  };

  const openEmployeeLeadDetails = async (employeeName) => {
    if (!since || !until) return;
    setReportDetailEmployee(employeeName);
    setReportDetailLeads([]);
    setReportDetailError("");
    setReportDetailOpen(true);
    setReportDetailLoading(true);
    try {
      const q = new URLSearchParams({
        from: since,
        to: until,
        employee: employeeName,
      });
      const res = await fetch(`/api/meta-backfill/leads-report/details?${q.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setReportDetailError(data?.error || "Failed to load leads");
        return;
      }
      setReportDetailLeads(data.leads || []);
    } catch (err) {
      console.error(err);
      setReportDetailError("Error loading leads");
    } finally {
      setReportDetailLoading(false);
    }
  };

  /** Leads where this user was the assigner (assigned_to = TL/admin who assigned), same date range as report */
  const openAssignedByModal = async () => {
    if (!since || !until) {
      setMessage("Please select both From and To dates");
      return;
    }
    const by = ASSIGNED_BY_FIXED_USERNAME;
    setAssignedByLeads([]);
    setAssignedByError("");
    setAssignedByOpen(true);
    setAssignedByLoading(true);
    setMessage("");
    try {
      const q = new URLSearchParams({ from: since, to: until, by });
      const res = await fetch(`/api/meta-backfill/leads-report/assigned-by?${q.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setAssignedByError(data?.error || "Failed to load leads");
        return;
      }
      setAssignedByLeads(data.leads || []);
    } catch (err) {
      console.error(err);
      setAssignedByError("Error loading leads");
    } finally {
      setAssignedByLoading(false);
    }
  };

  const handleCronTest = async () => {
    setCronTestResult(null);
    setCronTestLoading(true);
    try {
      const res = await fetch("/api/cron/meta-backfill");
      const data = await res.json();
      setCronTestResult({ ok: res.ok, data });
    } catch (err) {
      setCronTestResult({ ok: false, data: { error: err.message } });
    } finally {
      setCronTestLoading(false);
    }
  };

  const handleDiagnose = async () => {
    setDiagnoseResult(null);
    setDiagnoseLoading(true);
    try {
      const res = await fetch("/api/meta-backfill/diagnose");
      const data = await res.json();
      setDiagnoseResult(data);
    } catch (err) {
      console.error(err);
      setDiagnoseResult({ error: err.message });
    } finally {
      setDiagnoseLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-full">
      <h1 className="text-xl font-semibold">Meta Leads Backfill</h1>

      {/* Detailing Diagnosis - Why leads not in DB */}
      <div className="border rounded-lg p-4 bg-amber-50/50 border-amber-200">
        <h2 className="font-medium mb-2 text-amber-900">Detailing Diagnosis</h2>
        {/* <p className="text-sm text-amber-800 mb-3">
          Leads are coming from Meta but not showing in the database? Use this button to check — token, webhook, lead distribution, and Meta vs DB comparison.
        </p> */}
        <button
          type="button"
          onClick={handleDiagnose}
          disabled={diagnoseLoading}
          className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {diagnoseLoading ? "Checking..." : "Detailing Diagnosis"}
        </button>
        {diagnoseResult && (
          <div className="mt-4 space-y-4 text-sm">
            {diagnoseResult.error && (
              <p className="text-red-600 font-medium">{diagnoseResult.error}</p>
            )}
            {diagnoseResult.webhookUrl && (
              <div className="bg-white rounded p-3 border">
                <strong className="text-gray-700">Webhook URL (configure in Meta App):</strong>
                <p className="mt-1 text-xs font-mono text-blue-600 break-all">{diagnoseResult.webhookUrl}</p>
              </div>
            )}
            {diagnoseResult.checks?.map((c, i) => (
              <div key={i} className="flex items-start gap-2">
                <span
                  className={
                    c.status === "ok"
                      ? "text-green-600"
                      : c.status === "error"
                        ? "text-red-600"
                        : c.status === "warning"
                          ? "text-amber-600"
                          : "text-gray-500"
                  }
                >
                  {c.status === "ok" ? "✓" : c.status === "error" ? "✗" : "○"}
                </span>
                <span>
                  <strong>{c.name}:</strong> {c.message}
                  {c.forms?.length > 0 && (
                    <span className="block mt-1 text-gray-600">
                      Forms: {c.forms.map((f) => `${f.name} (${f.id})`).join(", ")}
                    </span>
                  )}
                </span>
              </div>
            ))}
            {diagnoseResult.dbDiagnosis && (
              <div className="bg-white rounded p-3 border">
                <strong className="text-gray-700">DB Status:</strong>
                <ul className="mt-1 list-disc list-inside text-gray-600">
                  <li>Total customers in DB: {diagnoseResult.dbDiagnosis.totalCustomersInDb ?? "—"}</li>
                  <li>Lead distribution reps: {diagnoseResult.dbDiagnosis.leadDistributionCount ?? 0}</li>
                  {diagnoseResult.dbDiagnosis.reps?.length > 0 && (
                    <li className="mt-1">
                      Reps: {diagnoseResult.dbDiagnosis.reps.map((r) => `${r.username} (priority: ${r.priority})`).join(", ")}
                    </li>
                  )}
                </ul>
              </div>
            )}
            {diagnoseResult.metaVsDb && diagnoseResult.metaVsDb.metaLeadsSample?.length > 0 && (
              <div className="bg-white rounded p-3 border overflow-x-auto">
                <strong className="text-gray-700">Last {diagnoseResult.metaVsDb.metaLeadsCount} Meta leads vs DB:</strong>
                <table className="mt-2 min-w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1 pr-2">Name</th>
                      <th className="text-left py-1 pr-2">Phone</th>
                      <th className="text-left py-1 pr-2">In DB?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diagnoseResult.metaVsDb.metaLeadsSample.map((l, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-1 pr-2">{l.name || "—"}</td>
                        <td className="py-1 pr-2">{l.phone || "—"}</td>
                        <td className={l.inDb ? "text-green-600" : "text-red-600"}>
                          {l.inDb ? "✓ Yes" : "✗ No"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-amber-700">
                  {diagnoseResult.metaVsDb.notInDbCount > 0
                    ? `${diagnoseResult.metaVsDb.notInDbCount} lead(s) exist in Meta but not in DB — check webhook or manually Import.`
                    : "All sample leads found in DB."}
                </p>
              </div>
            )}
            {diagnoseResult.suggestions?.length > 0 && (
              <div className="mt-2 pt-2 border-t border-amber-200">
                <strong className="text-amber-800">Suggestions:</strong>
                <ul className="list-disc list-inside text-amber-900 mt-1 space-y-1">
                  {diagnoseResult.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Automatic Cron - fetches leads from Meta */}
      <div className="border rounded-lg p-4 bg-blue-50/50 border-blue-200">
        <h2 className="font-medium mb-3 text-blue-900">Automatic Cron (every 10 min)</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={handleCronTest}
            disabled={cronTestLoading || autoPollEnabled}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {cronTestLoading ? "Testing..." : "Test Cron Now"}
          </button>
          <button
            type="button"
            onClick={() => {
              setAutoPollEnabledState((p) => {
                const next = !p;
                setAutoPollEnabled(next);
                if (next) pollCountRef.current = 0;
                return next;
              });
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              autoPollEnabled ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-700"
            }`}
          >
            {autoPollEnabled ? "Stop (every 10 min)" : "Auto-poll every 10 min"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowHistory((h) => !h);
              if (!showHistory) setCronHistory(getCronHistory());
            }}
            className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-700 text-white text-sm font-medium"
          >
            History
          </button>
        </div>
        {cronTestResult && (
          <div
            className={`mt-3 p-3 rounded text-sm ${
              cronTestResult.data?.loading ? "bg-blue-100 text-blue-800" : cronTestResult.ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}
          >
            {cronTestResult.data?.loading ? (
              <>⏳ Fetching from Meta... (call #{cronTestResult.count})</>
            ) : cronTestResult.ok ? (
              <>
                ✓ Success — Imported: {cronTestResult.data?.imported ?? 0}, Skipped: {cronTestResult.data?.skipped ?? 0}
                {autoPollEnabled && <span className="ml-2 opacity-80">(call #{cronTestResult.count})</span>}
              </>
            ) : (
              <>
                ✗ Failed — {cronTestResult.data?.error || JSON.stringify(cronTestResult.data)}
                {autoPollEnabled && <span className="ml-2 opacity-80">(call #{cronTestResult.count})</span>}
              </>
            )}
          </div>
        )}
        {showHistory && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setShowHistory(false)}
          >
            <div
              className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center p-4 border-b">
                <strong className="text-lg text-blue-900">Cron / Auto-poll History</strong>
                <button
                  type="button"
                  onClick={() => setShowHistory(false)}
                  className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-sm font-medium"
                >
                  Close
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1">
                {cronHistory.length === 0 ? (
                  <p className="text-sm text-gray-500">No history yet</p>
                ) : (
                  <table className="text-sm w-full">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 pr-3">Time</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3">Source</th>
                        <th className="py-2 pr-3">Imported</th>
                        <th className="py-2 pr-3">Skipped</th>
                        <th className="py-2 pr-3">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cronHistory.map((h, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-2 pr-3">{new Date(h.timestamp).toLocaleString()}</td>
                          <td className={`py-2 pr-3 font-medium ${h.status === "success" ? "text-green-600" : "text-red-600"}`}>
                            {h.status === "success" ? "✓ Success" : "✗ Failed"}
                          </td>
                          <td className="py-2 pr-3">{h.source}</td>
                          <td className="py-2 pr-3">{h.imported ?? 0}</td>
                          <td className="py-2 pr-3">{h.skipped ?? 0}</td>
                          <td className="py-2 pr-3 text-red-600 max-w-[150px] truncate" title={h.error}>
                            {h.error || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border rounded-lg p-3 bg-gray-50">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-800">
              Automatic import new Meta leads to DB
            </p>
            <p className="text-xs text-gray-600">
              Yes: backfill requests will save new leads into customers table. No: backfill will only show leads without saving them.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAutoImportEnabled(true)}
              className={`px-3 py-1 rounded text-sm border ${
                autoImportEnabled
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-white text-gray-700 border-gray-300"
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setAutoImportEnabled(false)}
              className={`px-3 py-1 rounded text-sm border ${
                !autoImportEnabled
                  ? "bg-red-600 text-white border-red-600"
                  : "bg-white text-gray-700 border-gray-300"
              }`}
            >
              No
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleFetch} className="space-y-2">
        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col text-sm">
            <span className="font-medium mb-1">From date</span>
            <input
              type="date"
              value={since}
              onChange={(e) => setSince(e.target.value)}
              className="border px-2 py-1 rounded"
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="font-medium mb-1">To date</span>
            <input
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              className="border px-2 py-1 rounded"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="px-3 py-1 rounded bg-blue-600 text-white text-sm disabled:opacity-50"
          >
            {loading ? "Fetching..." : "Fetch Leads (by date)"}
          </button>
          <button
            type="button"
            onClick={handleFetchAll}
            disabled={loading}
            className="px-3 py-1 rounded bg-purple-600 text-white text-sm disabled:opacity-50"
          >
            {loading ? "Fetching..." : "Fetch ALL Leads (form history)"}
          </button>
          <button
            type="button"
            onClick={handleLeadsReport}
            disabled={leadsReportLoading || !since || !until}
            className="px-3 py-1 rounded bg-emerald-600 text-white text-sm disabled:opacity-50 hover:bg-emerald-700"
          >
            {leadsReportLoading ? "Checking..." : "Check Leads Report"}
          </button>
        </div>
      </form>

      {message && <p className="text-sm text-gray-700">{message}</p>}

      {leadsReport && (
        <div className="border rounded-lg p-4 bg-emerald-50/50 border-emerald-200">
          <h2 className="font-medium mb-2 text-emerald-900">
        Assigned By ({leadsReport.from} to {leadsReport.to})
          </h2>
          <p className="text-sm text-emerald-800 mb-3">
            <strong>Total Leads Added :</strong> {leadsReportBreakdown.grand}
          </p>
          <div className="flex flex-col lg:flex-row gap-4 items-stretch mb-3">
            {Array.isArray(leadsReport.byAssigner) && leadsReport.byAssigner.length > 0 && (
              <div className="border border-emerald-200 rounded-lg overflow-hidden bg-white text-sm shrink-0 lg:max-w-md w-full">
                <table className="min-w-[280px] w-full">
                  <thead className="bg-emerald-100">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-emerald-900">
                        Added By
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-emerald-900 whitespace-nowrap">
                        Total
                      </th>
                      <th className="px-3 py-2 text-center font-medium text-emerald-900 w-14">
                        View
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leadsReport.byAssigner.map((row, i) => (
                      <tr key={`${row.assigner}-${i}`} className="border-t border-emerald-100">
                        <td className="px-3 py-1.5 text-emerald-950">{row.assigner}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                          {row.leadCount}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => openAssignerLeadDetails(row.assigner)}
                            className="inline-flex items-center justify-center rounded p-1.5 text-emerald-800 hover:bg-emerald-100"
                            title="View all leads for this assigned_to"
                            aria-label={`View leads for ${row.assigner}`}
                          >
                            <Eye className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {Array.isArray(leadsReport.byCampaignAndAssigner) &&
              leadsReport.byCampaignAndAssigner.length > 0 && (
                <div className="flex-1 min-w-0 overflow-x-auto border border-emerald-200 rounded-lg bg-white">
                
                  <table className="min-w-full text-sm">
                    <thead className="bg-emerald-100">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-emerald-900">Source</th>
                        <th className="px-3 py-2 text-left font-medium text-emerald-900">Assigned-By</th>
                        <th className="px-3 py-2 text-right font-medium text-emerald-900">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leadsReport.byCampaignAndAssigner.map((row, i) => (
                        <tr key={`${row.campaign}-${row.assigner}-${i}`} className="border-t border-emerald-100">
                          <td className="px-3 py-1.5">{row.campaign}</td>
                          <td className="px-3 py-1.5">{row.assigner}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                            {row.leadCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
            {/* <span className="font-medium text-emerald-900">assigned_by</span>
            <span
              className="inline-flex items-center border border-emerald-200 rounded px-2 py-1 bg-emerald-50/80 text-emerald-950 font-medium tabular-nums"
              aria-label="Assigner (fixed)"
            >
              {ASSIGNED_BY_FIXED_USERNAME}
            </span>
            <button
              type="button"
              onClick={openAssignedByModal}
              disabled={!since || !until}
              className="px-3 py-1 rounded bg-teal-700 text-white text-sm hover:bg-teal-800 disabled:opacity-50"
            >
              View
            </button> */}
            {/* <span className="text-xs text-emerald-800/90 max-w-md">
              Shows leads assigned or added by this user (where{" "}
              <code className="bg-emerald-100/80 px-1 rounded">assigned_to</code> matches).
            </span> */}
          </div>
          
        </div>
      )}
       <h2 className="font-medium mb-2 text-emerald-900">
          Assigned To ({leadsReport.from} to {leadsReport.to})
          </h2>
      <div className="overflow-x-auto border rounded bg-white">
         
            <table className="min-w-full text-sm">
              
              
              

              <thead className="bg-emerald-100">
                
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-emerald-900">Employee</th>
                  <th className="px-3 py-2 text-right font-medium text-emerald-900">Leads Count</th>
                  <th className="px-3 py-2 text-center font-medium text-emerald-900 w-24">View</th>
                </tr>
              </thead>
              <tbody>
                {leadsReport.byEmployee
                  ?.filter(
                    (row) => String(row.employee ?? "").toLowerCase() !== "harsh_m"
                  )
                  .map((row, i) => (
                  <tr key={i} className="border-t border-emerald-100">
                    <td className="px-3 py-2">{row.employee}</td>
                    <td className="px-3 py-2 text-right font-medium">{row.leadCount}</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => openEmployeeLeadDetails(row.employee)}
                        className="inline-flex items-center justify-center rounded p-1.5 text-emerald-800 hover:bg-emerald-100 disabled:opacity-40 disabled:pointer-events-none"
                        title="View leads for this employee"
                        aria-label={`View leads for ${row.employee}`}
                        disabled={row.leadCount === 0}
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

      {assignerDetailOpen && assignerDetailName != null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assigner-detail-title"
          onClick={() => setAssignerDetailOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <div>
                <h3 id="assigner-detail-title" className="text-lg font-semibold text-gray-900">
                  assigned_to — {assignerDetailName}
                </h3>
                {since && until && (
                  <p className="text-sm text-gray-600 mt-0.5">
                    {since} to {until} · Loaded: {assignerDetailLeads.length}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setAssignerDetailOpen(false)}
                className="rounded p-1 text-gray-600 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-auto flex-1 p-4">
              {leadsReport?.byCampaignAndAssigner?.length > 0 && assignerDetailName && (
                <div className="mb-4 flex flex-wrap gap-4 text-sm border border-emerald-100 rounded-lg bg-emerald-50/50 p-3">
                  <span className="font-medium text-emerald-900">By campaign (lead_campaign):</span>
                  {(() => {
                    const d =
                      assignerCampaignBreakdown.get(assignerDetailName) ?? {
                        social_media: 0,
                        google: 0,
                        indiamart: 0,
                        other: 0,
                      };
                    return (
                      <>
                        <span>
                          Social media: <strong className="tabular-nums">{d.social_media}</strong>
                        </span>
                        <span>
                          Google: <strong className="tabular-nums">{d.google}</strong>
                        </span>
                        <span>
                          Indiamart: <strong className="tabular-nums">{d.indiamart}</strong>
                        </span>
                        {d.other > 0 && (
                          <span>
                            Other: <strong className="tabular-nums">{d.other}</strong>
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
              {assignerDetailLoading && (
                <p className="text-sm text-gray-600">Loading...</p>
              )}
              {!assignerDetailLoading && assignerDetailError && (
                <p className="text-sm text-red-600">{assignerDetailError}</p>
              )}
              {!assignerDetailLoading && !assignerDetailError && assignerDetailLeads.length === 0 && (
                <p className="text-sm text-gray-600">No leads in this range for this assigned_to.</p>
              )}
              {!assignerDetailLoading && !assignerDetailError && assignerDetailLeads.length > 0 && (
                <div className="overflow-x-auto border rounded">
                  <table className="min-w-full text-xs sm:text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-2 py-2 text-left border-b">ID</th>
                        <th className="px-2 py-2 text-left border-b">Name</th>
                        <th className="px-2 py-2 text-left border-b">Phone</th>
                        <th className="px-2 py-2 text-left border-b">Email</th>
                        <th className="px-2 py-2 text-left border-b">Status</th>
                        <th className="px-2 py-2 text-left border-b">Stage</th>
                        <th className="px-2 py-2 text-left border-b">Campaign</th>
                        <th className="px-2 py-2 text-left border-b">assigned_to</th>
                        <th className="px-2 py-2 text-left border-b">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignerDetailLeads.map((lead) => {
                        const fullName = [lead.first_name, lead.last_name]
                          .filter(Boolean)
                          .join(" ")
                          .trim() || "—";
                        const created =
                          lead.date_created != null
                            ? String(lead.date_created).slice(0, 19).replace("T", " ")
                            : "—";
                        return (
                          <tr key={lead.customer_id} className="border-b border-gray-100">
                            <td className="px-2 py-2 whitespace-nowrap">{lead.customer_id}</td>
                            <td className="px-2 py-2">{fullName}</td>
                            <td className="px-2 py-2 whitespace-nowrap">{lead.phone || "—"}</td>
                            <td className="px-2 py-2 break-all max-w-[180px]">{lead.email || "—"}</td>
                            <td className="px-2 py-2">{lead.status || "—"}</td>
                            <td className="px-2 py-2">{lead.stage || "—"}</td>
                            <td className="px-2 py-2">{lead.lead_campaign || "—"}</td>
                            <td className="px-2 py-2 whitespace-nowrap">{lead.assigned_to || "—"}</td>
                            <td className="px-2 py-2 whitespace-nowrap text-gray-700">{created}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {reportDetailOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-detail-title"
          onClick={() => setReportDetailOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <h3 id="report-detail-title" className="text-lg font-semibold text-gray-900">
                Leads — {reportDetailEmployee}
                {since && until && (
                  <span className="text-sm font-normal text-gray-600 ml-2">
                    ({since} to {until})
                  </span>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setReportDetailOpen(false)}
                className="rounded p-1 text-gray-600 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-auto flex-1 p-4">
              {reportDetailLoading && (
                <p className="text-sm text-gray-600">Loading...</p>
              )}
              {!reportDetailLoading && reportDetailError && (
                <p className="text-sm text-red-600">{reportDetailError}</p>
              )}
              {!reportDetailLoading && !reportDetailError && reportDetailLeads.length === 0 && (
                <p className="text-sm text-gray-600">No leads in this range for this employee.</p>
              )}
              {!reportDetailLoading && !reportDetailError && reportDetailLeads.length > 0 && (
                <div className="overflow-x-auto border rounded">
                  <table className="min-w-full text-xs sm:text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-2 py-2 text-left border-b">ID</th>
                        <th className="px-2 py-2 text-left border-b">Name</th>
                        <th className="px-2 py-2 text-left border-b">Phone</th>
                        <th className="px-2 py-2 text-left border-b">Email</th>
                        <th className="px-2 py-2 text-left border-b">Status</th>
                        <th className="px-2 py-2 text-left border-b">Stage</th>
                        <th className="px-2 py-2 text-left border-b">Campaign</th>
                        <th className="px-2 py-2 text-left border-b">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportDetailLeads.map((lead) => {
                        const fullName = [lead.first_name, lead.last_name]
                          .filter(Boolean)
                          .join(" ")
                          .trim() || "—";
                        const created =
                          lead.date_created != null
                            ? String(lead.date_created).slice(0, 19).replace("T", " ")
                            : "—";
                        return (
                          <tr key={lead.customer_id} className="border-b border-gray-100">
                            <td className="px-2 py-2 whitespace-nowrap">{lead.customer_id}</td>
                            <td className="px-2 py-2">{fullName}</td>
                            <td className="px-2 py-2 whitespace-nowrap">{lead.phone || "—"}</td>
                            <td className="px-2 py-2 break-all max-w-[180px]">{lead.email || "—"}</td>
                            <td className="px-2 py-2">{lead.status || "—"}</td>
                            <td className="px-2 py-2">{lead.stage || "—"}</td>
                            <td className="px-2 py-2">{lead.lead_campaign || "—"}</td>
                            <td className="px-2 py-2 whitespace-nowrap text-gray-700">{created}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {assignedByOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assigned-by-title"
          onClick={() => setAssignedByOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <div>
                <h3 id="assigned-by-title" className="text-lg font-semibold text-gray-900">
                  Assigned by — {ASSIGNED_BY_FIXED_USERNAME}
                </h3>
                {since && until && (
                  <p className="text-sm text-gray-600 mt-0.5">
                    Date range: {since} to {until} · Total: {assignedByLeads.length}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setAssignedByOpen(false)}
                className="rounded p-1 text-gray-600 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-auto flex-1 p-4">
              {assignedByLoading && (
                <p className="text-sm text-gray-600">Loading...</p>
              )}
              {!assignedByLoading && assignedByError && (
                <p className="text-sm text-red-600">{assignedByError}</p>
              )}
              {!assignedByLoading && !assignedByError && assignedByLeads.length === 0 && (
                <p className="text-sm text-gray-600">
                  No leads assigned or added by this user in the selected date range.
                </p>
              )}
              {!assignedByLoading && !assignedByError && assignedByLeads.length > 0 && (
                <>
                  <div className="mb-3 rounded-lg border border-teal-200 bg-teal-50/60 px-3 py-2 text-sm text-gray-800">
                    {/* <span className="font-medium text-teal-950">Campaign (lead_campaign):</span>{" "} */}
                    <span className="ml-1">
                      social_media={assignedByCampaignTotals.social_media}
                    </span>
                    <span className="mx-2 text-gray-400">|</span>
                    <span>indiamart={assignedByCampaignTotals.indiamart}</span>
                    <span className="mx-2 text-gray-400">|</span>
                    <span>google={assignedByCampaignTotals.google}</span>
                  </div>
                  <div className="overflow-x-auto border rounded">
                  <table className="min-w-full text-xs sm:text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-2 py-2 text-left border-b">ID</th>
                        <th className="px-2 py-2 text-left border-b">Name</th>
                        <th className="px-2 py-2 text-left border-b">Phone</th>
                        <th className="px-2 py-2 text-left border-b">Email</th>
                        <th className="px-2 py-2 text-left border-b">lead_source</th>
                        <th className="px-2 py-2 text-left border-b">sales_representative</th>
                        {/* <th className="px-2 py-2 text-left border-b">Added By</th> */}
                        <th className="px-2 py-2 text-left border-b">Status</th>
                        <th className="px-2 py-2 text-left border-b">Stage</th>
                        <th className="px-2 py-2 text-left border-b">Campaign</th>
                        <th className="px-2 py-2 text-left border-b">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignedByLeads.map((lead) => {
                        const fullName = [lead.first_name, lead.last_name]
                          .filter(Boolean)
                          .join(" ")
                          .trim() || "—";
                        const created =
                          lead.date_created != null
                            ? String(lead.date_created).slice(0, 19).replace("T", " ")
                            : "—";
                        return (
                          <tr key={lead.customer_id} className="border-b border-gray-100">
                            <td className="px-2 py-2 whitespace-nowrap">{lead.customer_id}</td>
                            <td className="px-2 py-2">{fullName}</td>
                            <td className="px-2 py-2 whitespace-nowrap">{lead.phone || "—"}</td>
                            <td className="px-2 py-2 break-all max-w-[160px]">{lead.email || "—"}</td>
                            <td className="px-2 py-2 whitespace-nowrap">{lead.lead_source || "—"}</td>
                            <td className="px-2 py-2 whitespace-nowrap">{lead.sales_representative || "—"}</td>
                            <td className="px-2 py-2 whitespace-nowrap">{lead.assigned_to || "—"}</td>
                            <td className="px-2 py-2">{lead.status || "—"}</td>
                            <td className="px-2 py-2">{lead.stage || "—"}</td>
                            <td className="px-2 py-2">{lead.lead_campaign || "—"}</td>
                            <td className="px-2 py-2 whitespace-nowrap text-gray-700">{created}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {leads.length > 0 && (
        <div className="space-y-3">
          <div className="overflow-x-auto border rounded">
            <table className="min-w-full text-xs sm:text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-2 py-1 border">Lead ID</th>
                  <th className="px-2 py-1 border">Created</th>
                  <th className="px-2 py-1 border">Name</th>
                  <th className="px-2 py-1 border">Phone</th>
                  <th className="px-2 py-1 border">Email</th>
                  <th className="px-2 py-1 border">City</th>
                  <th className="px-2 py-1 border">Product / Campaign</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.leadgen_id}>
                    <td className="px-2 py-1 border break-all">
                      {lead.leadgen_id}
                    </td>
                    <td className="px-2 py-1 border">
                      {lead.created_time || "-"}
                    </td>
                    <td className="px-2 py-1 border">
                      {lead.first_name || "-"}
                    </td>
                    <td className="px-2 py-1 border">{lead.phone || "-"}</td>
                    <td className="px-2 py-1 border break-all">
                      {lead.email || "-"}
                    </td>
                    <td className="px-2 py-1 border">{lead.address || "-"}</td>
                    <td className="px-2 py-1 border">
                      {lead.products_interest || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
