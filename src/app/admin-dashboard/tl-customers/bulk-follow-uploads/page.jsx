"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { useUser } from "@/context/UserContext";
import Link from "next/link";
import { ArrowLeft, Loader2, History, X } from "lucide-react";
import { resolveToCanonical } from "../../../../lib/productCodeUtils";

const TL_TAG_OPTIONS = [
  "Demo",
  "Prime",
  "Repeat order",
  "Mail",
  "Truck FollowUp",
  "Payment Collection",
  "Strong FollowUp",
  "Service Issue",
  "Running Orders",
  "Clear",
];

const DATE_REGEX = /^\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s*$/;
const DATE_REGEX_ALT = /^\s*(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\s*$/;

function parseFirstLine(firstLine) {
  // 2459||DRS 90T or 2459||
  const pipeMatch = firstLine.match(/^(\d+)\s*\|\|\s*(.*)$/);
  if (pipeMatch) {
    return { customer_id: pipeMatch[1], model: (pipeMatch[2] || "").trim() };
  }
  // 2459 DRS 90T (space, no ||)
  const spaceMatch = firstLine.match(/^(\d+)\s+(.+)$/);
  if (spaceMatch) {
    return { customer_id: spaceMatch[1], model: spaceMatch[2].trim() };
  }
  // 2459 (only customer_id)
  const soloMatch = firstLine.match(/^(\d+)$/);
  if (soloMatch) {
    return { customer_id: soloMatch[1], model: "" };
  }
  return null;
}

function toISODateFromLine(line) {
  const ddmmyy = line.match(DATE_REGEX);
  if (ddmmyy) {
    const [, d, m, y] = ddmmyy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const yyyymmdd = line.match(DATE_REGEX_ALT);
  if (yyyymmdd) {
    const [, y, m, d] = yyyymmdd;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return "";
}

function extractTagsFromLine(tagLine) {
  const lineLower = String(tagLine || "").toLowerCase();
  if (!lineLower) return [];

  const tags = [];
  for (const tag of TL_TAG_OPTIONS) {
    if (lineLower === tag.toLowerCase() || lineLower.includes(tag.toLowerCase())) {
      if (!tags.includes(tag)) tags.push(tag);
    }
  }
  if (!tags.includes("Running Orders") && (lineLower === "running order" || lineLower.includes("running order"))) {
    tags.push("Running Orders");
  }
  return tags;
}

function isBlockStartLine(line) {
  const normalized = String(line || "").trim();
  if (!normalized) return false;
  if (toISODateFromLine(normalized)) return false; // prevent date from becoming new block
  return !!parseFirstLine(normalized);
}

// Strict mapping requested (fixed order after first line):
// 1) notes
// 2) Est. Order Date
// 3) tags
// 4) Assign To
function parseSingleBlock(lines) {
  const filtered = lines.map((l) => String(l).trim()).filter((l) => l.length > 0);
  if (filtered.length === 0) return null;

  const firstLine = filtered[0];
  const parsed = parseFirstLine(firstLine);
  if (!parsed) return null;

  const customer_id = parsed.customer_id;
  const model = parsed.model;
  const bodyLines = filtered.slice(1);

  const notes = bodyLines[0] || "";
  const estimated_order_date = toISODateFromLine(bodyLines[1] || "");
  const multi_tag = extractTagsFromLine(bodyLines[2] || "");
  const assigned_employee = bodyLines[3] || "";

  return {
    customer_id,
    model,
    notes,
    multi_tag,
    estimated_order_date,
    assigned_employee,
    stage: "Negotiation / Follow-up",
    status: "Good",
  };
}

// Split text into blocks - each block starts with valid customer line only
function parseBulkTLFollowupFormat(text) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const allLines = normalized.split("\n").map((l) => String(l).trim());
  const blocks = [];
  let currentBlock = [];

  for (const line of allLines) {
    if (isBlockStartLine(line)) {
      if (currentBlock.length > 0) {
        blocks.push([...currentBlock]);
      }
      currentBlock = [line];
    } else if (currentBlock.length > 0) {
      currentBlock.push(line);
    }
  }
  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  const results = [];
  for (const block of blocks) {
    const parsed = parseSingleBlock(block);
    if (parsed) results.push(parsed);
  }
  return results;
}

export default function BulkFollowUploadsPage() {
  const [rawText, setRawText] = useState("");
  const [parsedEntries, setParsedEntries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [validProductCodes, setValidProductCodes] = useState([]);
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetch("/api/lead-sources")
      .then((res) => res.json())
      .then((data) => setEmployees(Array.isArray(data) ? data : []))
      .catch(() => setEmployees([]));
  }, []);

  useEffect(() => {
    fetch("/api/products/list")
      .then((res) => res.json())
      .then((data) => setValidProductCodes((Array.isArray(data) ? data : []).map((p) => p.item_code).filter(Boolean)))
      .catch(() => setValidProductCodes([]));
  }, []);

  const handleAnalyze = async () => {
    const results = parseBulkTLFollowupFormat(rawText);
    if (results.length === 0) {
      toast.error(
        "Format not recognized. Expected first line: customer_id and model (e.g. 2461||DRS 90T or 2461 DRS 90T). Separate entries with blank lines."
      );
      return;
    }

    if (validProductCodes.length === 0) {
      toast.error("Product list is loading. Please wait a moment and try again.");
      return;
    }

    setAnalyzing(true);
    try {
      const codes = validProductCodes;
      const invalidCodes = [];
      const normalizedEntries = results.map((entry) => {
        const modelStr = String(entry.model || "").trim();
        if (!modelStr) return { ...entry, model: "" };
        const parts = modelStr.split(",").map((s) => s.trim()).filter(Boolean);
        const canonicalParts = [];
        for (const part of parts) {
          const resolved = resolveToCanonical(part, codes);
          if (!resolved) {
            if (!invalidCodes.includes(part)) invalidCodes.push(part);
          } else {
            canonicalParts.push(resolved.canonical);
          }
        }
        return { ...entry, model: canonicalParts.join(", ") };
      });

      if (invalidCodes.length > 0) {
        toast.error(
          `Invalid product code(s): ${invalidCodes.join(", ")}. These codes do not exist in the product list. Please correct and try again.`,
          { duration: 6000 }
        );
        return;
      }

      setParsedEntries(normalizedEntries);
      toast.success(`Parsed ${results.length} entr${results.length === 1 ? "y" : "ies"}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const updateEntry = (index, field, value) => {
    setParsedEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleTagToggle = (index, tag) => {
    setParsedEntries((prev) => {
      const next = [...prev];
      const entry = next[index];
      const has = entry.multi_tag.includes(tag);
      const newTags = has
        ? entry.multi_tag.filter((t) => t !== tag)
        : [...entry.multi_tag, tag];
      next[index] = { ...entry, multi_tag: newTags };
      return next;
    });
  };

  const removeEntry = (index) => {
    setParsedEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setRawText("");
    setParsedEntries([]);
  };

  const handleSaveAll = async (e) => {
    e.preventDefault();
    const valid = parsedEntries.filter((e) => e.customer_id);
    if (valid.length === 0) {
      toast.error("No valid entries to save");
      return;
    }

    setLoading(true);
    const now = new Date();
    const followed_date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    let successCount = 0;
    let failCount = 0;

    for (const entry of valid) {
      try {
        const res = await fetch("/api/tl-followup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_id: entry.customer_id,
            model: entry.model || null,
            notes: entry.notes || null,
            multi_tag: entry.multi_tag?.length ? entry.multi_tag.join(", ") : null,
            estimated_order_date: entry.estimated_order_date || null,
            assigned_employee: entry.assigned_employee || null,
            stage: entry.stage || "Negotiation / Follow-up",
            status: entry.status || "Good",
            followed_date,
          }),
        });
        const data = await res.json();
        if (res.ok) successCount++;
        else {
          failCount++;
          toast.error(`Customer ${entry.customer_id}: ${data.error || "Failed"}`);
        }
      } catch {
        failCount++;
        toast.error(`Customer ${entry.customer_id}: Network error`);
      }
    }

    setLoading(false);
    if (successCount > 0) {
      toast.success(`${successCount} TL follow-up${successCount > 1 ? "s" : ""} added successfully!`);
      if (failCount === 0) resetForm();
      // Log to history
      try {
        await fetch("/api/bulk-followup-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries: valid }),
        });
      } catch {}
    }
    if (failCount > 0 && successCount === 0) {
      toast.error(`All ${failCount} entries failed.`);
    }
  };

  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/bulk-followup-history");
      const data = await res.json();
      if (res.ok) setHistory(data.history || []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistory = () => {
    setHistoryOpen(true);
    fetchHistory();
  };

  const formatDate = (d) => {
    if (!d) return "-";
    const dt = new Date(d);
    return dt.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link
        href="/admin-dashboard/tl-customers"
        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6 transition-colors"
      >
        <ArrowLeft size={20} />
        Back to TL Customers
      </Link>

      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Bulk Follow Uploads
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Paste multiple entries. Each entry starts with <code className="bg-gray-100 px-1 rounded">customer_id || model</code> or <code className="bg-gray-100 px-1 rounded">customer_id model</code>. Separate entries with a blank line.
        </p>

        {parsedEntries.length === 0 ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Paste follow-up text (10-12 entries at once)
              </label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={`2461||DRS 90T or 2461 DRS 90T\nNext week going to finalize.\n23/03/2026\nRunning order\nAB\n\n2462 DRS 100T\n...`}
                className="w-full h-64 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={openHistory}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
              >
                <History size={18} />
                History
              </button>
              <Link
                href="/admin-dashboard/tl-customers"
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </Link>
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {analyzing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Validating...
                  </>
                ) : (
                  "Analyze"
                )}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveAll} className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">
                {parsedEntries.length} entr{parsedEntries.length === 1 ? "y" : "ies"} parsed. Review and Save All.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={openHistory}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
                >
                  <History size={16} />
                  History
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-gray-600 hover:text-gray-800 underline text-sm"
                >
                  Back (Paste again)
                </button>
                <Link
                  href="/admin-dashboard/tl-customers"
                  className="px-3 py-1.5 text-gray-600 hover:text-gray-800 text-sm"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    `Save All (${parsedEntries.length})`
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
              {parsedEntries.map((entry, idx) => (
                <div
                  key={idx}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50/50"
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-semibold text-gray-800">
                      #{idx + 1} — Customer {entry.customer_id}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeEntry(idx)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <label className="block text-xs text-gray-500 mb-0.5">Customer ID</label>
                      <input
                        value={entry.customer_id}
                        onChange={(e) => updateEntry(idx, "customer_id", e.target.value)}
                        className="w-full border border-gray-300 rounded p-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-0.5">Model</label>
                      <input
                        value={entry.model}
                        onChange={(e) => updateEntry(idx, "model", e.target.value)}
                        className="w-full border border-gray-300 rounded p-1.5 text-sm"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs text-gray-500 mb-0.5">Notes</label>
                      <textarea
                        value={entry.notes}
                        onChange={(e) => updateEntry(idx, "notes", e.target.value)}
                        rows={2}
                        className="w-full border border-gray-300 rounded p-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-0.5">Est. Order Date</label>
                      <input
                        type="date"
                        value={entry.estimated_order_date}
                        onChange={(e) => updateEntry(idx, "estimated_order_date", e.target.value)}
                        className="w-full border border-gray-300 rounded p-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-0.5">Assign To</label>
                      <input
                        list={`employee-list-${idx}`}
                        value={entry.assigned_employee}
                        onChange={(e) => updateEntry(idx, "assigned_employee", e.target.value)}
                        className="w-full border border-gray-300 rounded p-1.5 text-sm"
                      />
                      <datalist id={`employee-list-${idx}`}>
                        {employees.map((emp) => (
                          <option key={emp} value={emp} />
                        ))}
                      </datalist>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Tags</label>
                      <div className="flex flex-wrap gap-1">
                        {TL_TAG_OPTIONS.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleTagToggle(idx, tag)}
                            className={`px-2 py-1 rounded text-xs transition ${
                              entry.multi_tag?.includes(tag)
                                ? "bg-blue-600 text-white"
                                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-sm text-gray-600 pt-2 border-t">
              Added by: {user?.username || "-"}
            </div>
          </form>
        )}

        {/* History Modal */}
        {historyOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col">
              <div className="flex justify-between items-center p-4 border-b">
                <h2 className="text-xl font-semibold">Bulk Upload History</h2>
                <button
                  onClick={() => setHistoryOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="overflow-y-auto p-4 flex-1">
                {historyLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 size={32} className="animate-spin text-blue-600" />
                  </div>
                ) : history.length === 0 ? (
                  <p className="text-center text-gray-500 py-12">No upload history yet.</p>
                ) : (
                  <div className="space-y-4">
                    {history.map((h) => (
                      <div
                        key={h.id}
                        className="border border-gray-200 rounded-lg p-4 bg-gray-50/50"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="font-semibold text-gray-800">
                              {h.uploaded_by}
                            </span>
                            <span className="text-gray-500 text-sm ml-2">
                              — {h.entries_count} entr{h.entries_count === 1 ? "y" : "ies"}
                            </span>
                          </div>
                          <span className="text-sm text-gray-600">
                            {formatDate(h.uploaded_at)}
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-1 pr-4">Customer</th>
                                <th className="text-left py-1 pr-4">Model</th>
                                <th className="text-left py-1 pr-4">Tags</th>
                                <th className="text-left py-1">Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(h.entries || []).map((e, i) => (
                                <tr key={i} className="border-b border-gray-100">
                                  <td className="py-1.5 pr-4 font-medium">{e.customer_id}</td>
                                  <td className="py-1.5 pr-4">{e.model || "-"}</td>
                                  <td className="py-1.5 pr-4">{e.tags || "-"}</td>
                                  <td className="py-1.5 text-gray-600 truncate max-w-[200px]">
                                    {e.notes || "-"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
