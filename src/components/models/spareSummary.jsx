"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function StockStatusModal({ isOpen, onClose }) {
  const [data, setData] = useState([]);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [statusFilter, setStatusFilter] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/spare/modelsummary")
        .then((res) => res.json())
        .then((result) => {
          if (Array.isArray(result)) {
            setData(result);
          } else {
            console.error("API response is not an array:", result);
            setData([]);
          }
        })
        .catch((error) => {
          console.error("Failed to fetch stock data:", error);
          setData([]);
        });
    }
  }, [isOpen]);

  function handleSort(key) {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  }

  async function exportToXLS() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Stock Transactions");

    // Updated columns to match the new data structure
    worksheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Spare ID", key: "spare_id", width: 15 },
      { header: "Spare Number", key: "spare_number", width: 20 },
      // { header: "Specification", key: "specification", width: 25 },
      { header: "Latest Qty", key: "quantity", width: 15 },
      { header: "Total Qty", key: "total", width: 15 },
      { header: "Delhi Godown", key: "delhi", width: 15 },
      { header: "South Godown", key: "south", width: 15 },
      { header: "Godown Location", key: "godown_location", width: 20 }, // Added Godown Location
      { header: "From Company", key: "from_company", width: 20 },
      { header: "Godown", key: "godown", width: 15 },
      { header: "Added By", key: "added_by", width: 20 },
      { header: "Sold To", key: "to_company", width: 20 },
      { header: "Sold Address", key: "delivery_address", width: 25 },
      { header: "Net Amount", key: "net_amount", width: 15 },
      { header: "Stock Status", key: "stock_status", width: 15 },
      { header: "Update Date", key: "updated_at", width: 25 },
    ];

    filteredData.forEach((row) => {
      worksheet.addRow({
        ...row,
        godown_location: row.godown_location || "---", // Default value if godown_location is missing
        updated_at: new Date(row.updated_at).toLocaleString(),
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "stock_transactions.xlsx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  function exportToPDF() {
    const doc = new jsPDF();
    autoTable(doc, {
      // Updated header to match the new data structure
      head: [
        [
          "ID",
          "Spare ID",
          "Spare Number",
          // "Specification",
          "Latest Qty",
          "Total Qty",
          "Delhi Godown",
          "South Godown",
          "Godown Location", // Added Godown Location
          "From Company",
          "Godown",
          "Added BY",
          "Sold to",
          "Sold Address",
          "Net Amount",
          "Update Date",
        ],
      ],
      // Updated body mapping to use the new data keys
      body: filteredData.map((row) => [
        row.id,
        row.spare_id,
        row.spare_number,
        // row.specification,
        row.quantity,
        row.total,
        row.delhi,
        row.south,
        row.godown_location || "---", // Default value if godown_location is missing
        row.from_company,
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
    let filtered = Array.isArray(data) ? data : [];

    if (statusFilter) {
      filtered = filtered.filter(
        (item) =>
          item.stock_status?.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    filtered = filtered.filter((item) =>
      Object.values(item).some((val) =>
        String(val).toLowerCase().includes(search.toLowerCase())
      )
    );

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
      <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-7xl max-h-[90vh] overflow-y-auto relative">
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

            <button
              onClick={() => setStatusFilter("IN")}
              className={`px-3 py-1.5 rounded-md text-sm ${
                statusFilter === "IN"
                  ? "bg-blue-700 text-white"
                  : "bg-gray-200 text-black"
              }`}
            >
              IN
            </button>
            <button
              onClick={() => setStatusFilter("OUT")}
              className={`px-3 py-1.5 rounded-md text-sm ${
                statusFilter === "OUT"
                  ? "bg-blue-700 text-white"
                  : "bg-gray-200 text-black"
              }`}
            >
              OUT
            </button>
            <button
              onClick={() => setStatusFilter(null)}
              className="px-3 py-1.5 rounded-md text-sm bg-gray-100"
            >
              Reset
            </button>

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
                  "id",
                  "spare_id",
                  "spare_number",
                  "spare_name",
                  // "specification",
                  "quantity",
                  "total",
                  "delhi",
                  "south",
                  "godown_location", // Added Godown Location
                  "net_amount",
                  "godown",
                  "stock_status",
                  "added_by",
                  "to_company",
                  "updated_at",
                ].map((key) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className="p-2 border-b cursor-pointer hover:bg-gray-200"
                  >
                    {key
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                    {sortConfig.key === key && (
                      <span>
                        {sortConfig.direction === "asc" ? " ▲" : " ▼"}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-2">{row.id}</td>
                  <td className="p-2">{row.spare_id}</td>
                  <td className="p-2">{row.spare_number}</td>
                  <td className="p-2">{row.spare_name}</td>
                  {/* <td className="p-2">{row.specification}</td> */}
                  <td className="p-2">{row.quantity}</td>
                  <td className="p-2">{row.total}</td>
                  <td className="p-2">{row.delhi}</td>
                  <td className="p-2">{row.south}</td>
                  <td className="p-2">{row.godown_location || "---"}</td>
                  <td className="p-2">{row.net_amount}</td>
                  <td className="p-2">{row.godown}</td>
                  <td className="p-2">{row.stock_status}</td>
                  <td className="p-2">{row.added_by}</td>
                  <td className="p-2">{row.to_company}</td>
                  <td className="p-2">
                    {new Date(row.updated_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
