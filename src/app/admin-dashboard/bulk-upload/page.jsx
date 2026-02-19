"use client";

import { useState, useRef } from "react";
import toast from "react-hot-toast";

const CSV_COLUMNS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "company",
  "address",
  "lead_campaign",
  "products_interest",
  "tags",
  "notes",
  "language",
];

const REQUIRED = ["first_name", "phone"];

// Detect if the CSV headers are from Meta's export format
function isMetaCSV(headers) {
  return headers.includes("full_name") || headers.includes("phone_number");
}

// Map a Meta CSV row to our system's field names
function mapMetaRow(row) {
  const fullName = row["full_name"]?.toString().trim() || "";
  const nameParts = fullName.split(" ");
  const first_name = nameParts[0] || "";
  const last_name = nameParts.slice(1).join(" ") || "";

  // Normalize language: "Tamil" → "Tamil", "HINDI" → "Hindi", etc.
  const language = row["preferred_language_to_communicate"]?.toString().trim() || "";

  return {
    first_name,
    last_name,
    email: row["email"]?.toString().trim() || "",
    phone: row["phone_number"]?.toString().trim() || "",
    company: "",
    address: row["city"]?.toString().trim() || "",
    lead_campaign: "social_media",           // Meta leads = social media
    products_interest: row["campaign_name"]?.toString().trim() || "",
    tags: "Other",
    notes: row["ad_name"]?.toString().trim() || "Lead from Meta",
    language,
  };
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { rows: [], isMeta: false };

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const isMeta = isMetaCSV(headers);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle CSVs with quoted fields containing commas
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let c = 0; c < line.length; c++) {
      if (line[c] === '"') {
        inQuotes = !inQuotes;
      } else if (line[c] === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += line[c];
      }
    }
    values.push(current.trim());

    const raw = {};
    headers.forEach((h, idx) => {
      raw[h] = values[idx] || "";
    });

    const row = isMeta ? mapMetaRow(raw) : raw;
    rows.push(row);
  }
  return { rows, isMeta };
}

function downloadTemplate() {
  const header = CSV_COLUMNS.join(",");
  const example =
    "Rahul,Sharma,rahul@example.com,9876543210,ABC Corp,Mumbai,india_mart,Scrubber,industry,Interested in bulk order,";
  const csv = header + "\n" + example;
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bulk_customers_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function BulkUploadPage() {
  const fileRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [isMetaFormat, setIsMetaFormat] = useState(false);
  const [mode, setMode] = useState("auto");
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [fileName, setFileName] = useState("");

  // Fetch employees when switching to manual mode
  const handleModeChange = async (newMode) => {
    setMode(newMode);
    if (newMode === "manual" && employees.length === 0) {
      try {
        const res = await fetch("/api/tl-assign-lead");
        const data = await res.json();
        setEmployees(data.employees || []);
      } catch {
        toast.error("Failed to load employees");
      }
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const { rows: parsed, isMeta } = parseCSV(ev.target.result);
      setRows(parsed);
      setIsMetaFormat(isMeta);
      if (parsed.length === 0) {
        toast.error("No valid rows found in CSV");
      } else {
        toast.success(
          isMeta
            ? `📊 Meta format detected! Mapped ${parsed.length} leads.`
            : `Parsed ${parsed.length} rows`
        );
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) {
      fileRef.current.files = e.dataTransfer.files;
      handleFileChange({ target: { files: [file] } });
    } else {
      toast.error("Please drop a .csv file");
    }
  };

  const getRowStatus = (row) => {
    const missing = REQUIRED.filter((f) => !row[f]?.toString().trim());
    if (missing.length > 0) return { ok: false, reason: `Missing: ${missing.join(", ")}` };
    const phone = row.phone?.toString().replace(/[^\d]/g, "");
    if (!phone || phone.length < 10) return { ok: false, reason: "Invalid phone" };
    return { ok: true };
  };

  const validRows = rows.filter((r) => getRowStatus(r).ok);
  const invalidRows = rows.filter((r) => !getRowStatus(r).ok);

  const handleUpload = async () => {
    if (validRows.length === 0) {
      toast.error("No valid rows to upload");
      return;
    }
    if (mode === "manual" && !selectedEmployee) {
      toast.error("Please select an employee");
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const res = await fetch("/api/bulk-upload-customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: validRows,
          mode,
          employee_username: mode === "manual" ? selectedEmployee : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Upload failed");
        return;
      }
      setResult(data);
      toast.success(`Done! ${data.inserted} customers uploaded.`);
    } catch {
      toast.error("Network error");
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setRows([]);
    setResult(null);
    setFileName("");
    setIsMetaFormat(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 text-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800">Bulk Customer Upload</h1>
          {isMetaFormat && (
            <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full border border-blue-300">
              📊 Meta Format Detected
            </span>
          )}
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          ⬇ Download CSV Template
        </button>
      </div>

      {/* CSV format info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        <strong>✅ Supports two formats:</strong>
        <ul className="mt-1 list-disc list-inside space-y-0.5 text-blue-700">
          <li><strong>Our Template</strong> — Download the template above and fill it in</li>
          <li><strong>Meta (Facebook) Export</strong> — Upload Meta lead CSV directly, columns are auto-mapped</li>
        </ul>
      </div>

      {/* Step 1: Upload CSV */}
      <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-400 transition"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          id="csv-upload"
          onChange={handleFileChange}
        />
        <label htmlFor="csv-upload" className="cursor-pointer">
          <div className="text-4xl mb-3">📂</div>
          {fileName ? (
            <p className="font-semibold text-blue-600">{fileName}</p>
          ) : (
            <>
              <p className="font-semibold text-gray-600">Drag & drop your CSV here</p>
              <p className="text-sm text-gray-400 mt-1">or click to browse</p>
            </>
          )}
        </label>
        {fileName && (
          <button onClick={handleReset} className="mt-3 text-xs text-red-500 underline">
            Clear
          </button>
        )}
      </div>

      {/* Step 2: Distribution Mode */}
      {rows.length > 0 && (
        <div className="bg-white border rounded-xl p-5 space-y-4 shadow-sm">
          <h2 className="font-semibold text-lg">Distribution Mode</h2>
          <div className="flex gap-4">
            <label className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition ${mode === "auto" ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}>
              <input type="radio" name="mode" value="auto" checked={mode === "auto"} onChange={() => handleModeChange("auto")} className="accent-blue-600" />
              <div>
                <p className="font-medium">🔄 Auto Distribute</p>
                <p className="text-xs text-gray-500">Round-robin using Lead Distribution config</p>
              </div>
            </label>
            <label className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition ${mode === "manual" ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}>
              <input type="radio" name="mode" value="manual" checked={mode === "manual"} onChange={() => handleModeChange("manual")} className="accent-blue-600" />
              <div>
                <p className="font-medium">👤 Manual — One Employee</p>
                <p className="text-xs text-gray-500">Assign all leads to one person</p>
              </div>
            </label>
          </div>

          {mode === "manual" && (
            <div>
              <label className="block text-sm font-medium mb-1">Select Employee</label>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="border rounded-lg p-2 w-full max-w-xs"
              >
                <option value="">-- Select Employee --</option>
                {employees.map((emp) => (
                  <option key={emp.username} value={emp.username}>
                    {emp.username}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Preview */}
      {rows.length > 0 && (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="font-semibold text-lg">Preview</h2>
            <div className="flex gap-3 text-sm">
              <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
                ✅ {validRows.length} Valid
              </span>
              {invalidRows.length > 0 && (
                <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full font-medium">
                  ❌ {invalidRows.length} Invalid (will be skipped)
                </span>
              )}
            </div>
          </div>

          <div className="overflow-auto max-h-80">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="p-2 border text-left w-10">#</th>
                  <th className="p-2 border text-left">First Name</th>
                  <th className="p-2 border text-left">Phone</th>
                  <th className="p-2 border text-left">Email</th>
                  <th className="p-2 border text-left">Company</th>
                  <th className="p-2 border text-left">Campaign</th>
                  <th className="p-2 border text-left">Product</th>
                  <th className="p-2 border text-left">Tags</th>
                  <th className="p-2 border text-left">Language</th>
                  <th className="p-2 border text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const status = getRowStatus(row);
                  return (
                    <tr key={idx} className={status.ok ? "" : "bg-red-50"}>
                      <td className="p-2 border text-gray-400">{idx + 1}</td>
                      <td className="p-2 border">{row.first_name || <span className="text-red-500">—</span>}</td>
                      <td className="p-2 border">{row.phone || <span className="text-red-500">—</span>}</td>
                      <td className="p-2 border">{row.email || "—"}</td>
                      <td className="p-2 border">{row.company || "—"}</td>
                      <td className="p-2 border">{row.lead_campaign || "—"}</td>
                      <td className="p-2 border">{row.products_interest || "—"}</td>
                      <td className="p-2 border">{row.tags || "—"}</td>
                      <td className="p-2 border">
                        {row.language ? (
                          <span className={row.language?.toString().toUpperCase().trim() === "TAMIL" ? "text-orange-600 font-semibold" : ""}>
                            {row.language}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="p-2 border">
                        {status.ok ? (
                          <span className="text-green-600 text-xs font-medium">✅ OK</span>
                        ) : (
                          <span className="text-red-600 text-xs font-medium" title={status.reason}>❌ {status.reason}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Step 4: Upload Button */}
      {rows.length > 0 && (
        <button
          onClick={handleUpload}
          disabled={uploading || validRows.length === 0}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-lg disabled:opacity-50 transition"
        >
          {uploading
            ? "Uploading..."
            : `Upload ${validRows.length} Customer${validRows.length !== 1 ? "s" : ""}`}
        </button>
      )}

      {/* Step 5: Result */}
      {result && (
        <div className="bg-white border rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-lg">Upload Result</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-3xl font-bold text-green-600">{result.inserted}</p>
              <p className="text-sm text-green-700 mt-1">Inserted</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-3xl font-bold text-yellow-600">{result.skipped}</p>
              <p className="text-sm text-yellow-700 mt-1">Skipped (Duplicates)</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-3xl font-bold text-red-600">{result.errors?.length || 0}</p>
              <p className="text-sm text-red-700 mt-1">Errors</p>
            </div>
          </div>

          {result.errors?.length > 0 && (
            <div>
              <h3 className="font-medium text-sm text-gray-600 mb-2">Error Details:</h3>
              <div className="overflow-auto max-h-48 border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 border text-left">Row</th>
                      <th className="p-2 border text-left">Phone</th>
                      <th className="p-2 border text-left">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((err, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 border">{err.row}</td>
                        <td className="p-2 border">{err.phone || "—"}</td>
                        <td className="p-2 border text-red-600">{err.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <button onClick={handleReset} className="w-full py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
            Upload Another File
          </button>
        </div>
      )}
    </div>
  );
}
