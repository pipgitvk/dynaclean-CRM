"use client";

import { useState } from "react";

export default function MetaBackfillPage() {
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [diagnoseLoading, setDiagnoseLoading] = useState(false);
  const [diagnoseResult, setDiagnoseResult] = useState(null);

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
      const res = await fetch(
        `/api/meta-backfill?since=${since}&until=${until}`,
      );
      const data = await res.json();
      if (!res.ok) {
        const metaMsg = data?.metaError?.message || data?.metaError?.error?.message || data?.message;
        setMessage(metaMsg ? `Meta error: ${metaMsg}` : "Failed to fetch leads from Meta");
        return;
      }
      setLeads(data.leads || []);
      setMessage(
        `Total from Meta: ${data.total_from_meta}, In range: ${data.total_in_range}, Existing in DB: ${data.existing_in_db}, New: ${data.new_count}`,
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
      const res = await fetch(`/api/meta-backfill?mode=all`);
      const data = await res.json();
      if (!res.ok) {
        const metaMsg = data?.metaError?.message || data?.metaError?.error?.message || data?.message;
        setMessage(metaMsg ? `Meta error: ${metaMsg}` : "Failed to fetch all leads from Meta");
        return;
      }
      setLeads(data.leads || []);
      setMessage(
        `Total from Meta: ${data.total_from_meta}, New (not in DB): ${data.new_count}`,
      );
    } catch (err) {
      console.error(err);
      setMessage("Error fetching all leads");
    } finally {
      setLoading(false);
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

  const handleImport = async () => {
    setMessage("");
    if (!leads.length) {
      setMessage("No leads to import");
      return;
    }
    setImportLoading(true);
    try {
      const leadIds = leads.map((l) => l.leadgen_id);
      const res = await fetch("/api/meta-backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds }),
      });
      if (!res.ok) {
        setMessage("Failed to import leads");
        return;
      }
      const data = await res.json();
      setMessage(
        `Imported / processed ${data.count} leads. Check DB/logs for details.`,
      );
    } catch (err) {
      console.error(err);
      setMessage("Error importing leads");
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-full">
      <h1 className="text-xl font-semibold">Meta Leads Backfill</h1>

      {/* Check connection - commented out
      <div className="border rounded p-4 bg-gray-50">
        <h2 className="font-medium mb-2">Check connection</h2>
        <p className="text-sm text-gray-600 mb-2">
          Run this to verify token, form ID, and permissions before fetching leads.
        </p>
        <button
          type="button"
          onClick={handleDiagnose}
          disabled={diagnoseLoading}
          className="px-3 py-1.5 rounded bg-amber-600 text-white text-sm disabled:opacity-50"
        >
          {diagnoseLoading ? "Checking..." : "Check connection"}
        </button>
        {diagnoseResult && (
          <div className="mt-4 space-y-2 text-sm">
            {diagnoseResult.error && (
              <p className="text-red-600">{diagnoseResult.error}</p>
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
            {diagnoseResult.suggestions?.length > 0 && (
              <div className="mt-2 pt-2 border-t">
                <strong className="text-amber-700">Suggestions:</strong>
                <ul className="list-disc list-inside text-amber-800 mt-1">
                  {diagnoseResult.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
      */}

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
        </div>
      </form>

      {message && <p className="text-sm text-gray-700">{message}</p>}

      {leads.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={handleImport}
            disabled={importLoading}
            className="px-3 py-1 rounded bg-green-600 text-white text-sm disabled:opacity-50"
          >
            {importLoading ? "Importing..." : "Import All New Leads"}
          </button>

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
