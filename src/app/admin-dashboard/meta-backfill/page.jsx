"use client";

import { useState } from "react";

export default function MetaBackfillPage() {
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [message, setMessage] = useState("");

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
      if (!res.ok) {
        setMessage("Failed to fetch leads from Meta");
        return;
      }
      const data = await res.json();
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
      if (!res.ok) {
        setMessage("Failed to fetch all leads from Meta");
        return;
      }
      const data = await res.json();
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
