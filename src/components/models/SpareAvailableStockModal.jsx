"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function SpareAvailableStockModal({ isOpen, onClose }) {
  const [data, setData] = useState([]);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [showExportOptions, setShowExportOptions] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/spare/available-stock")
        .then((res) => res.json())
        .then((res) => setData(Array.isArray(res) ? res : []))
        .catch(() => setData([]));
    }
  }, [isOpen]);

  function handleSort(key) {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  }

  const filteredData = useMemo(() => {
    const rows = Array.isArray(data) ? [...data] : [];
    const searched = search
      ? rows.filter((item) =>
        Object.values(item).some((val) =>
          String(val ?? "").toLowerCase().includes(search.toLowerCase())
        )
      )
      : rows;

    if (!sortConfig.key) return searched;
    return searched.sort((a, b) => {
      const aVal = a[sortConfig.key] ?? "";
      const bVal = b[sortConfig.key] ?? "";
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }
      return sortConfig.direction === "asc" ? (aVal > bVal ? 1 : -1) : aVal < bVal ? 1 : -1;
    });
  }, [data, search, sortConfig]);

  async function exportToXLS() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Available Spare Stock");

    worksheet.columns = [
      { header: "Spare Number", key: "spare_number", width: 20 },
      { header: "Spare Image", key: "spare_image", width: 20 },
      { header: "Spare Name", key: "spare_name", width: 28 },
      { header: "Total Qty", key: "total", width: 14 },
      { header: "Delhi Godown", key: "delhi", width: 16 },
      { header: "South Godown", key: "south", width: 16 },
      { header: "Location", key: "location", width: 18 },
      { header: "Updated At", key: "updated_at", width: 22 },
    ];

    filteredData.forEach((row) =>
      worksheet.addRow({
        ...row,
        updated_at: row.updated_at ? new Date(row.updated_at).toLocaleString() : "",
      })
    );

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "available_spare_stock.xlsx";
    a.click();
    window.URL.revokeObjectURL(url);
  }

  function exportToPDF() {
    const doc = new jsPDF();
    autoTable(doc, {
      head: [
        [
          "Spare Number",
          "Spare Image",
          "Spare Name",
          "Total Qty",
          "Delhi Godown",
          "South Godown",
          "Location",
          "Updated At",
        ],
      ],
      body: filteredData.map((row) => [
        row.spare_number,
        row.spare_image,
        row.spare_name,
        row.total,
        row.delhi,
        row.south,
        row.location,
        row.updated_at ? new Date(row.updated_at).toLocaleString() : "",
      ]),
      styles: { fontSize: 8 },
    });
    doc.save("available_spare_stock.pdf");
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-opacity-40 flex items-center justify-center z-50 px-4">
      <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-7xl max-h-[90vh] overflow-y-auto relative">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Available Spare Stock</h3>
          <button onClick={onClose} className="text-gray-600 hover:text-black">✕</button>
        </div>

        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 border rounded-md text-sm"
              />
            </div>

            <div className="relative">
              <button
                onClick={() => setShowExportOptions((prev) => !prev)}
                className="bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 flex items-center gap-1 text-sm"
              >
                <Download className="w-4 h-4" /> Export
              </button>
              {showExportOptions && (
                <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded shadow-md z-10">
                  <button
                    onClick={() => {
                      exportToPDF();
                      setShowExportOptions(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                  >
                    Export as PDF
                  </button>
                  <button
                    onClick={() => {
                      exportToXLS();
                      setShowExportOptions(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                  >
                    Export as XLS
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-300 rounded">
            <thead className="bg-gray-100 text-left">
              <tr>
                {[
                  { key: "spare_number", label: "Spare Number" },
                  { key: "spare_image", label: "Spare Image" },
                  { key: "spare_name", label: "Spare Name" },
                  { key: "total", label: "Total Qty" },
                  { key: "delhi", label: "Delhi Godown" },
                  { key: "south", label: "South Godown" },
                  { key: "location", label: "Location" },
                  { key: "updated_at", label: "Updated At" },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="p-2 border-b cursor-pointer hover:bg-gray-200"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, idx) => (
                <tr key={(row.spare_id ?? "spare") + "_" + idx} className="border-t">
                  <td className="p-2">{row.spare_number}</td>
                  <td className="p-2">
                    {row.spare_image ? (
                      <img
                        src={row.spare_image}
                        alt={row.spare_name || "Spare"}
                        className="w-16 h-16 object-cover rounded"
                      />
                    ) : (
                      <span className="text-gray-400">No image</span>
                    )}
                  </td>
                  <td className="p-2">{row.spare_name}</td>
                  <td className="p-2">{row.total}</td>
                  <td className="p-2">{row.delhi}</td>
                  <td className="p-2">{row.south}</td>
                  <td className="p-2">{row.location || "N/A"}</td>
                  <td className="p-2">{row.updated_at ? new Date(row.updated_at).toLocaleString() : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
