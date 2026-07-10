"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Download, Upload } from "lucide-react";
import toast from "react-hot-toast";
import ExcelJS from "exceljs";

export default function AddBacklinkModal({
  open,
  onClose,
  onSuccess,
}) {
  const [rows, setRows] = useState([
    { website: "", keyword: "", email: "", followup_date: "", status: "submitted", assigned_to: "" }
  ]);
  const [loading, setLoading] = useState(false);
  const [digitalMarketers, setDigitalMarketers] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [emails, setEmails] = useState([]);
  const [currentUser, setCurrentUser] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    fetchDigitalMarketers();
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    // Fetch keywords after currentUser is set
    if (currentUser) {
      fetchKeywords();
      fetchEmails();
    }
  }, [currentUser, isSuperAdmin]);

  useEffect(() => {
    if (open) {
      // Reset when modal opens
      const today = new Date().toISOString().split("T")[0];
      setRows([
        { website: "", keyword: "", email: "", followup_date: today, status: "submitted", assigned_to: "" }
      ]);
      setSavedCount(0);
    }
  }, [open]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/current-user");
      const data = await res.json();
      if (res.ok && data.username) {
        setCurrentUser(data.username);
        const role = (data.role || data.userRole || "").toUpperCase();
        setCurrentRole(role);
        setIsSuperAdmin(role === "SUPERADMIN");
      }
    } catch (error) {
      console.error("Error fetching current user:", error);
      setIsSuperAdmin(false);
    }
  };

  const fetchDigitalMarketers = async () => {
    try {
      const res = await fetch("/api/digital-marketers");
      const data = await res.json();
      if (res.ok) {
        setDigitalMarketers(data.users || []);
      }
    } catch (error) {
      console.error("Error fetching digital marketers:", error);
    }
  };

  const fetchKeywords = async () => {
    try {
      const res = await fetch("/api/keywords");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        // Filter keywords: if isSuperAdmin show all, otherwise only show assigned to current user
        const filtered = isSuperAdmin 
          ? data 
          : data.filter(kw => kw.assigned_to === currentUser);
        setKeywords(filtered);
      }
    } catch (error) {
      console.error("Error fetching keywords:", error);
    }
  };

  const fetchEmails = async () => {
    try {
      const res = await fetch("/api/backlink-emails");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setEmails(data);
      }
    } catch (error) {
      console.error("Error fetching emails:", error);
    }
  };

  const handleRowChange = (index, field, value) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    setRows(newRows);
  };

  const addRow = () => {
    const today = new Date().toISOString().split("T")[0];
    setRows([
      ...rows,
      { website: "", keyword: "", email: "", followup_date: today, status: "submitted", assigned_to: currentUser || "" }
    ]);
  };

  const removeRow = (index) => {
    if (rows.length > 1) {
      setRows(rows.filter((_, i) => i !== index));
    }
  };

  const saveRow = async (row) => {
    if (!row.website) {
      toast.error("Website is required for saving.");
      return false;
    }

    try {
      const res = await fetch("/api/backlinks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website: row.website.trim(),
          keyword: row.keyword.trim() || null,
          email: row.email.trim() || null,
          followup_date: row.followup_date || null,
          status: row.status || "submitted",
          assigned_to: row.assigned_to || currentUser || null,
        }),
      });

      if (res.ok) {
        return true;
      } else {
        const data = await res.json();
        toast.error(`Failed to save: ${data.message || "Unknown error"}`);
        return false;
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Network error while saving.");
      return false;
    }
  };

  const handleSaveAll = async () => {
    const validRows = rows.filter(r => r.website && r.website.trim());
    if (validRows.length === 0) {
      toast.error("Please fill in at least one backlink with website information.");
      return;
    }

    setLoading(true);
    let successCount = 0;

    for (const row of validRows) {
      const saved = await saveRow(row);
      if (saved) {
        successCount++;
      }
    }

    setLoading(false);
    setSavedCount(successCount);
    
    if (successCount > 0) {
      toast.success(`${successCount} backlink(s) saved successfully!`);
      if (onSuccess) {
        // Add a small delay before fetching to ensure data is persisted
        setTimeout(() => {
          onSuccess();
        }, 500);
      }
      // Auto-close after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    }
  };

  const downloadTemplate = () => {
    const headers = ["Website", "Keyword", "Email", "Date", "Status", "Assigned To"];
    const template = [headers.join(",")].join("\n");
    
    const element = document.createElement("a");
    element.setAttribute("href", "data:text/csv;charset=utf-8," + encodeURIComponent(template));
    element.setAttribute("download", "backlinks_template.csv");
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success("Template downloaded!");
  };

  // Helper function to extract text from Excel cell value (handles hyperlinks and objects)
  const getCellText = (value) => {
    if (!value && value !== 0) return "";
    if (typeof value === "string") {
      return value.trim();
    }
    // Handle objects with text property (hyperlinks)
    if (typeof value === "object" && value.text) {
      return String(value.text).trim();
    }
    // Handle date numbers (Excel stores dates as numbers)
    if (typeof value === "number" && value > 20000 && value < 50000) {
      // Convert Excel date number to ISO date string
      // Excel epoch: January 0, 1900 (which is actually December 30, 1899)
      const excelEpoch = new Date(1899, 11, 30);
      const d = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
      
      // Adjust for timezone to get the correct date
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    }
    return String(value).trim();
  };

  const handleImportExcel = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const isXLSX = file.name.endsWith(".xlsx");
      const isCSV = file.name.endsWith(".csv");
      const validStatuses = ["submitted", "approved", "deleted"];

      if (isXLSX) {
        // Handle XLSX file
        const arrayBuffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          toast.error("No worksheet found in Excel file");
          return;
        }

        // Get headers from first row
        const headerRow = worksheet.getRow(1);
        const headers = headerRow.values.slice(1).map(h => getCellText(h).toLowerCase());
        
        console.log("Headers from Excel:", headers);
        
        const websiteIdx = headers.findIndex(h => h.includes("website"));
        const keywordIdx = headers.findIndex(h => h.includes("keyword"));
        const emailIdx = headers.findIndex(h => h.includes("email"));
        const dateIdx = headers.findIndex(h => h.includes("date"));
        const statusIdx = headers.findIndex(h => h.includes("status"));
        const assignedIdx = headers.findIndex(h => h.includes("assigned"));

        // Parse data rows and validate
        const importedRows = [];
        const keywordList = keywords.map(k => k.keyword.toLowerCase());
        const emailList = emails.map(e => e.email.toLowerCase());
        
        let hasError = false;
        let errorMessage = "";
        
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header row
          if (hasError) return;
          
          const values = row.values.slice(1);
          
          const website = getCellText(websiteIdx >= 0 ? values[websiteIdx] : values[0]);
          const keyword = getCellText(keywordIdx >= 0 ? values[keywordIdx] : values[1]);
          const emailVal = getCellText(emailIdx >= 0 ? values[emailIdx] : values[2]);
          const date = getCellText(dateIdx >= 0 ? values[dateIdx] : values[3]);
          const status = getCellText(statusIdx >= 0 ? values[statusIdx] : values[4]) || "submitted";
          // Don't import assigned_to from Excel - always use current user
          
          if (website) {
            // Validate keyword
            if (keyword && !keywordList.includes(keyword.toLowerCase())) {
              hasError = true;
              errorMessage = `Row ${rowNumber}: Keyword "${keyword}" not found in dropdown`;
              return;
            }

            // Keyword is required
            if (!keyword) {
              hasError = true;
              errorMessage = `Row ${rowNumber}: Keyword is required`;
              return;
            }
            
            // Validate email
            if (emailVal && !emailList.includes(emailVal.toLowerCase())) {
              hasError = true;
              errorMessage = `Row ${rowNumber}: Email "${emailVal}" not found in dropdown`;
              return;
            }

            // Validate status
            if (status && !validStatuses.includes(status.toLowerCase())) {
              hasError = true;
              errorMessage = `Row ${rowNumber}: Status "${status}" is invalid. Valid options are: submitted, approved, deleted`;
              return;
            }
            
            console.log(`Row ${rowNumber}:`, { website, keyword, emailVal, date, status, assigned_to: currentUser });
            
            importedRows.push({
              website: website,
              keyword: keyword || "",
              email: emailVal || "",
              followup_date: date || new Date().toISOString().split("T")[0],
              status: status || "submitted",
              assigned_to: currentUser || ""
            });
          }
        });

        if (hasError) {
          toast.error(errorMessage);
          return;
        }

        if (importedRows.length === 0) {
          toast.error("No valid rows found in the Excel file");
          return;
        }

        setRows(importedRows);
        toast.success(`${importedRows.length} rows imported successfully from Excel!`);
      } else if (isCSV) {
        // Handle CSV file
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            let text = e.target?.result;
            if (typeof text !== "string") {
              toast.error("Failed to read file");
              return;
            }

            // Remove BOM if present (for UTF-8 files)
            if (text.charCodeAt(0) === 0xFEFF) {
              text = text.slice(1);
            }

            const lines = text.split("\n").filter(line => line.trim());
            if (lines.length < 2) {
              toast.error("CSV file must have headers and at least one data row");
              return;
            }

            // Parse CSV properly handling quotes and commas
            const parseCSVLine = (line) => {
              const result = [];
              let current = "";
              let insideQuotes = false;

              for (let i = 0; i < line.length; i++) {
                const char = line[i];

                if (char === '"') {
                  insideQuotes = !insideQuotes;
                } else if (char === "," && !insideQuotes) {
                  result.push(current.trim().replace(/^"|"$/g, ""));
                  current = "";
                } else {
                  current += char;
                }
              }
              result.push(current.trim().replace(/^"|"$/g, ""));
              return result;
            };

            // Parse header to find column indices
            const headerLine = lines[0];
            const headers = parseCSVLine(headerLine).map(h => h.toLowerCase().trim());
            
            console.log("Headers from CSV:", headers);
            
            const websiteIdx = headers.findIndex(h => h.includes("website"));
            const keywordIdx = headers.findIndex(h => h.includes("keyword"));
            const emailIdx = headers.findIndex(h => h.includes("email"));
            const dateIdx = headers.findIndex(h => h.includes("date"));
            const statusIdx = headers.findIndex(h => h.includes("status"));
            const assignedIdx = headers.findIndex(h => h.includes("assigned"));

            // Validate and parse data rows
            const importedRows = [];
            const keywordList = keywords.map(k => k.keyword.toLowerCase());
            const emailList = emails.map(e => e.email.toLowerCase());
            
            let hasError = false;
            let errorMessage = "";

            for (let idx = 1; idx < lines.length; idx++) {
              if (hasError) break;
              
              const line = lines[idx];
              const parts = parseCSVLine(line);
              
              const website = websiteIdx >= 0 ? parts[websiteIdx]?.trim() || "" : parts[0]?.trim() || "";
              const keyword = keywordIdx >= 0 ? parts[keywordIdx]?.trim() || "" : parts[1]?.trim() || "";
              const emailVal = emailIdx >= 0 ? parts[emailIdx]?.trim() || "" : parts[2]?.trim() || "";
              const date = dateIdx >= 0 ? parts[dateIdx]?.trim() || "" : parts[3]?.trim() || "";
              const status = statusIdx >= 0 ? parts[statusIdx]?.trim() || "submitted" : parts[4]?.trim() || "submitted";
              // Don't import assigned_to from CSV - always use current user
              
              if (website) {
                // Validate keyword
                if (keyword && !keywordList.includes(keyword.toLowerCase())) {
                  hasError = true;
                  errorMessage = `Row ${idx + 1}: Keyword "${keyword}" not found in dropdown`;
                  break;
                }

                // Keyword is required
                if (!keyword) {
                  hasError = true;
                  errorMessage = `Row ${idx + 1}: Keyword is required`;
                  break;
                }
                
                // Validate email
                if (emailVal && !emailList.includes(emailVal.toLowerCase())) {
                  hasError = true;
                  errorMessage = `Row ${idx + 1}: Email "${emailVal}" not found in dropdown`;
                  break;
                }

                // Validate status
                if (status && !validStatuses.includes(status.toLowerCase())) {
                  hasError = true;
                  errorMessage = `Row ${idx + 1}: Status "${status}" is invalid. Valid options are: submitted, approved, deleted`;
                  break;
                }
                
                console.log(`Row ${idx}:`, { website, keyword, emailVal, date, status, assigned_to: currentUser });
                
                importedRows.push({
                  website: website,
                  keyword: keyword || "",
                  email: emailVal || "",
                  followup_date: date || new Date().toISOString().split("T")[0],
                  status: status || "submitted",
                  assigned_to: currentUser || ""
                });
              }
            }

            if (hasError) {
              toast.error(errorMessage);
              return;
            }

            if (importedRows.length === 0) {
              toast.error("No valid rows found in the file");
              return;
            }

            setRows(importedRows);
            toast.success(`${importedRows.length} rows imported successfully from CSV!`);
          } catch (error) {
            console.error("Error parsing CSV:", error);
            toast.error("Error parsing CSV file: " + error.message);
          }
        };

        reader.readAsText(file, "UTF-8");
      } else {
        toast.error("Please upload a CSV or XLSX file");
      }
    } catch (error) {
      console.error("Error processing file:", error);
      toast.error("Error processing file: " + error.message);
    }

    // Reset input so same file can be selected again
    event.target.value = "";
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-lg flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-6 sticky top-0 bg-white pb-4 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Bulk Add Backlinks</h2>
            <p className="text-sm text-gray-600 mt-1">Add multiple backlinks at once. They will be saved automatically.</p>
            {savedCount > 0 && <p className="text-sm text-green-600 mt-1">✓ {savedCount} backlink(s) saved</p>}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Download Template Button */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm"
          >
            <Download size={16} />
            Download Template
          </button>
          <label className="flex items-center gap-2 px-3 py-2 bg-green-200 text-green-700 rounded-lg hover:bg-green-300 transition text-sm cursor-pointer">
            <Upload size={16} />
            Import Excel
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={handleImportExcel}
              className="hidden"
              disabled={loading}
            />
          </label>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-gray-300 rounded-lg mb-6">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b border-gray-300 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Website*</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Keyword</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Assigned To</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-b hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <input
                      type="url"
                      value={row.website}
                      onChange={(e) => handleRowChange(index, "website", e.target.value)}
                      placeholder="https://example.com"
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-xs"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={row.keyword || ""}
                      onChange={(e) => handleRowChange(index, "keyword", e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-xs"
                    >
                      <option value="">Select Keyword</option>
                      {keywords.map((kw) => (
                        <option key={kw.id} value={kw.keyword}>
                          {kw.keyword}
                        </option>
                      ))}
                      {row.keyword && !keywords.find(k => k.keyword === row.keyword) && (
                        <option value={row.keyword} selected>
                          {row.keyword} (not found in list)
                        </option>
                      )}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={row.email || ""}
                      onChange={(e) => handleRowChange(index, "email", e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-xs"
                    >
                      <option value="">Select Email</option>
                      {emails.map((emailItem) => (
                        <option key={emailItem.id} value={emailItem.email}>
                          {emailItem.email}
                        </option>
                      ))}
                      {row.email && !emails.find(e => e.email === row.email) && (
                        <option value={row.email} selected>
                          {row.email} (not found in list)
                        </option>
                      )}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="date"
                      value={row.followup_date}
                      onChange={(e) => handleRowChange(index, "followup_date", e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-xs"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={row.status}
                      onChange={(e) => handleRowChange(index, "status", e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-xs"
                    >
                      <option value="submitted">Submitted</option>
                      <option value="approved">Approved</option>
                      <option value="deleted">Deleted</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {isSuperAdmin ? (
                      <select
                        value={row.assigned_to}
                        onChange={(e) => handleRowChange(index, "assigned_to", e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-xs"
                      >
                        <option value="">Select user</option>
                        {digitalMarketers.map((dm) => (
                          <option key={dm.username} value={dm.username}>
                            {dm.username}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={currentUser}
                        disabled
                        className="w-full px-2 py-1 border border-gray-300 rounded bg-gray-100 text-gray-600 cursor-not-allowed text-xs"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => removeRow(index)}
                      disabled={rows.length === 1}
                      className="text-red-600 hover:text-red-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Remove row"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add Row Button */}
        <div className="mb-6">
          <button
            onClick={addRow}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm"
          >
            <Plus size={18} />
            Add Row
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 sticky bottom-0 bg-white pt-4 border-t">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveAll}
            disabled={loading || rows.every(r => !r.website)}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
          >
            {loading ? "Saving..." : `Save All (${rows.filter(r => r.website).length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
