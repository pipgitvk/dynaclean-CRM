"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { useUser } from "@/context/UserContext";
import Link from "next/link";
import { ArrowLeft, Loader2, History, X } from "lucide-react";
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

const DATETIME_REGEX = /^\s*(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/;
const DATETIME_DDMMYY = /^\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/;
const DATE_ONLY_DDMMYY = /^\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s*$/;
const DATE_ONLY_YYYYMMDD = /^\s*(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\s*$/;

function parseNextFollowupDate(line) {
  const m = line.match(DATETIME_REGEX);
  if (m) {
    const [, y, mo, d, h, min] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T${h.padStart(2, "0")}:${min}`;
  }
  const m2 = line.match(DATETIME_DDMMYY);
  if (m2) {
    const [, d, mo, y, h, min] = m2;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T${h.padStart(2, "0")}:${min}`;
  }
  const m3 = line.match(DATE_ONLY_DDMMYY);
  if (m3) {
    const [, d, mo, y] = m3;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T09:00`;
  }
  const m4 = line.match(DATE_ONLY_YYYYMMDD);
  if (m4) {
    const [, y, mo, d] = m4;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T09:00`;
  }
  return "";
}

function normalizeTagForMatch(s) {
  return String(s || "").toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
}

function parseTagString(tagLine) {
  const line = String(tagLine || "").trim();
  if (!line) return [];

  const tags = [];
  const parts = line.split(",").map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    const norm = normalizeTagForMatch(part);
    if (!norm) continue;
    const found = TL_TAG_OPTIONS.find((t) => normalizeTagForMatch(t) === norm);
    if (found && !tags.includes(found)) tags.push(found);
    else if ((norm === "running order" || norm.includes("running order")) && !tags.includes("Running Orders")) {
      tags.push("Running Orders");
    }
  }
  return tags;
}

function isBlockStartLine(line) {
  const normalized = String(line || "").trim();
  if (!normalized) return false;
  if (parseNextFollowupDate(normalized)) return false;
  return !!parseFirstLine(normalized);
}

function parseLabeledBlock(blockText) {
  const lines = blockText.split("\n").map((l) => l.trim());
  let customer_id = "";
  let model = "";
  let notes = "";
  let next_followup_date = "";
  let tagStr = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cidMatch = line.match(/^Customer ID:\s*(.+)$/i);
    if (cidMatch) {
      customer_id = String(cidMatch[1] || "").trim();
      continue;
    }
    const modelMatch = line.match(/^Model:\s*(.+)$/i);
    if (modelMatch) {
      model = String(modelMatch[1] || "").trim();
      continue;
    }
    const notesMatch = line.match(/^Follow-up Notes:\s*(.*)$/i);
    if (notesMatch) {
      notes = String(notesMatch[1] || "").trim();
      if (!notes && i + 1 < lines.length && !lines[i + 1].match(/^(Customer ID|Model|Next Follow-up Date|Tag):/i)) {
        notes = lines[++i].trim();
      }
      continue;
    }
    const dateMatch = line.match(/^Next Follow-up Date:\s*(.*)$/i);
    if (dateMatch) {
      let dateVal = String(dateMatch[1] || "").trim();
      if (!dateVal && i + 1 < lines.length) dateVal = lines[i + 1].trim();
      next_followup_date = parseNextFollowupDate(dateVal);
      continue;
    }
    const tagMatch = line.match(/^Tag:\s*(.+)$/i);
    if (tagMatch) {
      tagStr = String(tagMatch[1] || "").trim();
      if (!tagStr && i + 1 < lines.length && !lines[i + 1].match(/^(Customer ID|Model|Follow-up Notes|Next Follow-up Date):/i)) {
        tagStr = lines[++i].trim();
      }
      continue;
    }
    if (notes && !line.match(/^(Customer ID|Model|Follow-up Notes|Next Follow-up Date|Tag):/i) && line) {
      notes = (notes + "\n" + line).trim();
    }
  }

  if (!customer_id) return null;
  return {
    customer_id,
    model,
    notes,
    next_followup_date,
    multi_tag: parseTagString(tagStr),
    assigned_employee: "",
    stage: "Negotiation / Follow-up",
    status: "Good",
  };
}

function parseSingleBlock(lines) {
  const filtered = lines.map((l) => String(l).trim()).filter((l) => l.length > 0);
  if (filtered.length === 0) return null;

  const firstLine = filtered[0];
  if (/^Customer ID:/i.test(firstLine)) {
    return parseLabeledBlock(filtered.join("\n"));
  }

  const parsed = parseFirstLine(firstLine);
  if (!parsed) return null;

  const customer_id = parsed.customer_id;
  let model = parsed.model || "";
  const bodyLines = filtered.slice(1);

  const notes = bodyLines[0] || "";
  const next_followup_date = parseNextFollowupDate(bodyLines[1] || "");
  const multi_tag = parseTagString(bodyLines[2] || "");

  return {
    customer_id,
    model,
    notes,
    next_followup_date,
    multi_tag,
    assigned_employee: "",
    stage: "Negotiation / Follow-up",
    status: "Good",
  };
}

function isLabeledFormat(text) {
  return /^\s*Customer ID:/im.test(text);
}

// Split text into blocks - labeled format by "Customer ID:", else by customer line
function parseBulkTLFollowupFormat(text) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const allLines = normalized.split("\n");

  if (isLabeledFormat(normalized)) {
    const blocks = normalized.split(/(?=Customer ID:)/i).filter((b) => b.trim());
    const results = [];
    for (const block of blocks) {
      const parsed = parseLabeledBlock(block.trim());
      if (parsed) results.push(parsed);
    }
    return results;
  }

  const trimmedLines = allLines.map((l) => String(l).trim());
  const blocks = [];
  let currentBlock = [];

  for (const line of trimmedLines) {
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
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetch("/api/lead-sources")
      .then((res) => res.json())
      .then((data) => setEmployees(Array.isArray(data) ? data : []))
      .catch(() => setEmployees([]));
  }, []);

  const handleAnalyze = async () => {
    const results = parseBulkTLFollowupFormat(rawText);
    if (results.length === 0) {
      toast.error(
        "Format not recognized. Expected: customer_id||model, notes, next_followup_date, tags. Separate entries with blank lines."
      );
      return;
    }

    const invalid = [];
    for (const r of results) {
      const missing = [];
      if (!r.customer_id || !String(r.customer_id).trim()) missing.push("customer_id");
      if (!String(r.notes || "").trim()) missing.push("notes");
      if (!String(r.next_followup_date || "").trim()) missing.push("next_followup_date");
      if (missing.length > 0) {
        invalid.push({ customer_id: r.customer_id || "?", missing });
      }
    }
    if (invalid.length > 0) {
      const msg = invalid
        .map((i) => `Customer ${i.customer_id}: missing ${i.missing.join(", ")}`)
        .join("; ");
      toast.error(`Invalid entries: ${msg}`, { duration: 6000 });
      return;
    }

    setAnalyzing(true);
    try {
      const customerIds = [...new Set(results.map((r) => r.customer_id))];
      let lastFollowups = {};
      try {
        const res = await fetch("/api/tl-followup/last-by-customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customer_ids: customerIds }),
        });
        const data = await res.json();
        if (res.ok && data.lastFollowups) lastFollowups = data.lastFollowups;
      } catch {}

      const merged = results.map((entry) => {
        const last = lastFollowups[String(entry.customer_id)] || {};
        let model = String(entry.model || "").trim() || (last.model || "");
        const lastTags = last.multi_tag ? parseTagString(last.multi_tag) : [];
        const userTags = Array.isArray(entry.multi_tag) ? entry.multi_tag : [];
        const multi_tag = [...lastTags];
        for (const t of userTags) {
          if (!multi_tag.includes(t)) multi_tag.push(t);
        }
        const assigned_employee = last.assigned_employee || "";

        return { ...entry, model, multi_tag, assigned_employee };
      });

      setParsedEntries(merged);
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
            next_followup_date: entry.next_followup_date || null,
            assigned_employee: (entry.assigned_employee && String(entry.assigned_employee).trim()) ? entry.assigned_employee : null,
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

        {parsedEntries.length === 0 ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Paste follow-up text (10-12 entries at once)
              </label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={`Customer ID: 2436\nModel: DRS 90T\n\nFollow-up Notes:\nClient interested, price discussion ongoing\n\nNext Follow-up Date:\n28/03/2026 11:30\n\nTag:\nPrime\n\nCustomer ID: 2437\nModel: Dyna-40\n\nFollow-up Notes:\nDemo scheduled\n\nNext Follow-up Date:\n29/03/2026 10:00\n\nTag:\nDemo`}
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
                      <label className="block text-xs text-gray-500 mb-0.5">Next Follow-up Date</label>
                      <input
                        type="datetime-local"
                        value={entry.next_followup_date}
                        onChange={(e) => updateEntry(idx, "next_followup_date", e.target.value)}
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
