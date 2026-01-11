"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, Download, Search } from "lucide-react";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function StockStatusModal({ isOpen, onClose }) {
  const [data, setData] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [statusFilter, setStatusFilter] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/product-stock-summary")
        .then((res) => res.json())
        .then(setData);
    }
  }, [isOpen]);

  function getFileType(url) {
    const ext = url.split(".").pop().toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
    if (ext === "pdf") return "pdf";
    return "unknown";
  }

  function handleSort(key) {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  }

  async function exportToXLS() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Stock Transactions");

    worksheet.columns = [
      { header: "Model", key: "product_code", width: 20 },
      { header: "Product UID No", key: "product_number", width: 20 },
      { header: "Item Name", key: "item_name", width: 25 },
      { header: "Latest Qty", key: "quantity", width: 15 },
      { header: "From Company", key: "from_company", width: 20 },
      { header: "Location", key: "location", width: 20 },
      { header: "Godown", key: "godown", width: 20 },
      { header: "Added By", key: "added_by", width: 20 },
      { header: "Sold to", key: "to_company", width: 20 },
      { header: "Sold Address", key: "delivery_address", width: 25 },
      { header: "Net Amount", key: "net_amount", width: 20 },
      { header: "Update Date", key: "updated_at", width: 25 },
    ];

    filteredData.forEach((row) => {
      worksheet.addRow({
        ...row,
        updated_at: new Date(row.updated_at).toLocaleString(),
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stock_transactions.xlsx";
    a.click();
    window.URL.revokeObjectURL(url);
  }

  function exportToPDF() {
    const doc = new jsPDF();
    autoTable(doc, {
      head: [
        [
          "Model",
          "Product UID No",
          "Item Name",
          "Latest Qty",
          "From Company",
          "Location",
          "Godown",
          "Added By",
          "Sold to",
          "Sold Address",
          "Net Amount",
          "Update Date",
        ],
      ],
      body: filteredData.map((row) => [
        row.product_code,
        row.product_number,
        row.item_name,
        row.quantity,
        row.from_company,
        row.location,
        row.godown,
        row.added_by,
        row.to_company,
        row.delivery_address,
        row.net_amount,
        new Date(row.updated_at).toLocaleString(),
      ]),
    });
    doc.save("stock_transactions.pdf");
  }

  const filteredData = useMemo(() => {
    let filtered = data;

    if (statusFilter) {
      filtered = filtered.filter(
        (item) => item.stock_status?.toUpperCase() === statusFilter
      );
    }

    if (search) {
      filtered = filtered.filter((item) =>
        Object.values(item).some((val) =>
          String(val).toLowerCase().includes(search.toLowerCase())
        )
      );
    }

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key] ?? "";
        const bVal = b[sortConfig.key] ?? "";
        return sortConfig.direction === "asc"
          ? aVal > bVal
            ? 1
            : -1
          : aVal < bVal
          ? 1
          : -1;
      });
    }

    return filtered;
  }, [data, search, sortConfig, statusFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-opacity-40 flex items-center justify-center z-50 px-4">
      <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-8xl max-h-[90vh] overflow-y-auto relative">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Stock Transactions</h3>
          <button onClick={onClose} className="text-gray-600 hover:text-black">
            ✕
          </button>
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

            <div className="flex gap-2">
              <button
                onClick={() => setStatusFilter("IN")}
                className={`px-3 py-1.5 text-sm rounded ${
                  statusFilter === "IN"
                    ? "bg-green-600 text-white"
                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                }`}
              >
                IN
              </button>
              <button
                onClick={() => setStatusFilter("OUT")}
                className={`px-3 py-1.5 text-sm rounded ${
                  statusFilter === "OUT"
                    ? "bg-red-600 text-white"
                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                }`}
              >
                OUT
              </button>
              <button
                onClick={() => setStatusFilter(null)}
                className={`px-3 py-1.5 text-sm rounded ${
                  statusFilter === null
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                }`}
              >
                All
              </button>
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
                  { key: "product_code", label: "Model" },
                  { key: "product_number", label: "Product UID No" },
                  { key: "item_name", label: "Item Name" },
                  { key: "quantity", label: "Latest Qty" },
                  { key: "from_company", label: "From Company" },
                  { key: "location", label: "Location" },
                  { key: "godown", label: "Godown" },
                  { key: "added_by", label: "Added By" },
                  { key: "to_company", label: "Sold To" },
                  { key: "delivery_address", label: "Sold Address" },
                  { key: "net_amount", label: "Net Amount" },
                  { key: "status", label: "Status" },
                  { key: "updated_at", label: "Updated At" },
                  { key: "supporting_file", label: "Supporting File" },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="p-2 border-b cursor-pointer hover:bg-gray-200"
                  >
                    {col.label}
                    {sortConfig.key === col.key && (
                      <span>
                        {sortConfig.direction === "asc" ? " ▲" : " ▼"}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, idx) => (
                <tr key={row.product_code + "_" + idx} className="border-t">
                  <td className="p-2">{row.product_code}</td>
                  <td className="p-2">{row.product_number}</td>
                  <td className="p-2">{row.item_name}</td>
                  <td className="p-2">{row.quantity}</td>
                  <td className="p-2">
                    {row.from_company ? row.from_company : "--"}
                  </td>
                  <td className="p-2">{row.location}</td>
                  <td className="p-2">{row.godown || "--"}</td>{" "}
                  {/* Display godown data */}
                  <td className="p-2">{row.added_by ? row.added_by : "--"}</td>
                  <td className="p-2">
                    {row.to_company ? row.to_company : "--"}
                  </td>
                  <td className="p-2">
                    {row.delivery_address ? row.delivery_address : "--"}
                  </td>
                  <td className="p-2">{row.net_amount}</td>
                  <td className="p-2">
                    <span
                      className={`font-semibold ${
                        row.stock_status === "IN"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {row.stock_status}
                    </span>
                  </td>
                  <td className="p-2">
                    {new Date(row.updated_at).toLocaleString()}
                  </td>
                  <td className="p-2 text-center">
                    {row.supporting_file ? (
                      <button
                        onClick={() =>
                          setPreviewImage({
                            url: row.supporting_file,
                            type: getFileType(row.supporting_file),
                          })
                        }
                        className="text-gray-600 hover:text-blue-700"
                      >
                        <Eye className="w-5 h-5 inline" />
                      </button>
                    ) : (
                      <span className="text-gray-400">--</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Preview Modal */}
        {previewImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-60">
            <div className="bg-white p-4 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-auto">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold">Preview</h4>
                <button onClick={() => setPreviewImage(null)}>✕</button>
              </div>
              {previewImage.type === "image" ? (
                <img
                  src={previewImage.url}
                  alt="Preview"
                  className="max-h-[70vh] object-contain mx-auto"
                />
              ) : previewImage.type === "pdf" ? (
                <iframe
                  src={previewImage.url}
                  title="PDF Preview"
                  className="w-full h-[70vh]"
                />
              ) : (
                <p className="text-red-500 text-center mt-4">
                  Cannot preview this file type.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
