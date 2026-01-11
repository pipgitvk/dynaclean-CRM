// "use client";

// import { useEffect, useMemo, useState } from "react";
// import { Download, Search } from "lucide-react";
// import ExcelJS from "exceljs";
// import jsPDF from "jspdf";
// import autoTable from "jspdf-autotable";

// export default function StockStatusModal({ isOpen, onClose }) {
//   const [data, setData] = useState([]);
//   const [search, setSearch] = useState("");
//   const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
//   const [showExportOptions, setShowExportOptions] = useState(false);
//   const [statusFilter, setStatusFilter] = useState(null);

//   useEffect(() => {
//     if (isOpen) {
//       fetch("/api/spare/modelsummaryspare")
//         .then((res) => res.json())
//         .then((result) => {
//           if (Array.isArray(result)) {
//             setData(result);
//           } else {
//             console.error("API response is not an array:", result);
//             setData([]);
//           }
//         })
//         .catch((error) => {
//           console.error("Failed to fetch stock data:", error);
//           setData([]);
//         });
//     }
//   }, [isOpen]);

//   function handleSort(key) {
//     setSortConfig((prev) => ({
//       key,
//       direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
//     }));
//   }

//   async function exportToXLS() {
//     const workbook = new ExcelJS.Workbook();
//     const worksheet = workbook.addWorksheet("Stock Summary");

//     worksheet.columns = [
//       { header: "Spare ID", key: "spare_id", width: 20 },
//       { header: "Spare Number", key: "spare_number", width: 20 }, // Added spare_number
//       { header: "Item Name", key: "item_name", width: 25 },
//       { header: "Specification", key: "specification", width: 25 },
//       { header: "Latest Qty", key: "quantity", width: 15 },
//       { header: "Total Qty", key: "total_quantity", width: 15 },
//       { header: "From Company", key: "from_company", width: 20 },
//       { header: "Location", key: "location", width: 15 },
//       { header: "Added By", key: "added_by", width: 20 },
//       { header: "Sold To", key: "to_company", width: 20 },
//       { header: "Sold Address", key: "delivery_address", width: 25 },
//       { header: "Net Amount", key: "net_amount", width: 15 },
//       { header: "Stock Status", key: "stock_status", width: 15 },
//       { header: "Update Date", key: "updated_at", width: 25 },
//     ];

//     filteredData.forEach((row) => {
//       worksheet.addRow({
//         ...row,
//         updated_at: new Date(row.updated_at).toLocaleString(),
//       });
//     });

//     const buffer = await workbook.xlsx.writeBuffer();
//     const blob = new Blob([buffer], {
//       type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//     });
//     const url = window.URL.createObjectURL(blob);

//     const link = document.createElement("a");
//     link.href = url;
//     link.download = "stock_summary.xlsx";
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
//     window.URL.revokeObjectURL(url);
//   }

//   function exportToPDF() {
//     const doc = new jsPDF();
//     autoTable(doc, {
//       head: [
//         [
//           "Spare ID",
//           "Spare Number", // Added spare_number
//           "Item Name",
//           "Specification",
//           "Latest Qty",
//           "Total Qty",
//           "From Company",
//           "Location",
//           "Added BY",
//           "Sold to",
//           "Sold Address",
//           "Net Amount",
//           "Update Date",
//         ],
//       ],
//       body: filteredData.map((row) => [
//         row.spare_id,
//         row.spare_number, // Added spare_number
//         row.item_name,
//         row.specification,
//         row.quantity,
//         row.total_quantity,
//         row.from_company,
//         row.location,
//         row.added_by,
//         row.to_company,
//         row.delivery_address,
//         row.net_amount,
//         new Date(row.updated_at).toLocaleString(),
//       ]),
//     });
//     doc.save("stock_summary.pdf");
//   }

//   const filteredData = useMemo(() => {
//     let filtered = Array.isArray(data) ? data : [];

//     if (statusFilter) {
//       filtered = filtered.filter(
//         (item) =>
//           item.stock_status?.toLowerCase() === statusFilter.toLowerCase()
//       );
//     }

//     filtered = filtered.filter((item) =>
//       Object.values(item).some((val) =>
//         String(val).toLowerCase().includes(search.toLowerCase())
//       )
//     );

//     if (sortConfig.key) {
//       filtered.sort((a, b) => {
//         const aVal = a[sortConfig.key] ?? "";
//         const bVal = b[sortConfig.key] ?? "";

//         return sortConfig.direction === "asc"
//           ? aVal > bVal
//             ? 1
//             : -1
//           : aVal < bVal
//           ? 1
//           : -1;
//       });
//     }

//     return filtered;
//   }, [data, search, sortConfig, statusFilter]);

//   if (!isOpen) return null;

//   return (
//     <div className="fixed inset-0 bg-opacity-40 flex items-center justify-center z-50 px-4">
//       <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-7xl max-h-[90vh] overflow-y-auto relative">
//         <div className="flex justify-between items-center mb-4">
//           <h3 className="text-lg font-semibold">Stock Summary</h3>
//           <button onClick={onClose} className="text-gray-600 hover:text-black">
//             ✕
//           </button>
//         </div>

//         <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
//           <div className="flex flex-wrap gap-2 items-center">
//             <div className="relative">
//               <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
//               <input
//                 type="text"
//                 placeholder="Search..."
//                 value={search}
//                 onChange={(e) => setSearch(e.target.value)}
//                 className="pl-8 pr-3 py-1.5 border rounded-md text-sm"
//               />
//             </div>

//             <button
//               onClick={() => setStatusFilter("IN")}
//               className={`px-3 py-1.5 rounded-md text-sm ${
//                 statusFilter === "IN"
//                   ? "bg-blue-700 text-white"
//                   : "bg-gray-200 text-black"
//               }`}
//             >
//               IN
//             </button>
//             <button
//               onClick={() => setStatusFilter("OUT")}
//               className={`px-3 py-1.5 rounded-md text-sm ${
//                 statusFilter === "OUT"
//                   ? "bg-blue-700 text-white"
//                   : "bg-gray-200 text-black"
//               }`}
//             >
//               OUT
//             </button>
//             <button
//               onClick={() => setStatusFilter(null)}
//               className="px-3 py-1.5 rounded-md text-sm bg-gray-100"
//             >
//               Reset
//             </button>

//             <div className="relative">
//               <button
//                 onClick={() => setShowExportOptions((prev) => !prev)}
//                 className="bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 flex items-center gap-1 text-sm"
//               >
//                 <Download className="w-4 h-4" /> Export
//               </button>

//               {showExportOptions && (
//                 <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded shadow-md z-10">
//                   <button
//                     onClick={() => {
//                       exportToPDF();
//                       setShowExportOptions(false);
//                     }}
//                     className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
//                   >
//                     Export as PDF
//                   </button>
//                   <button
//                     onClick={() => {
//                       exportToXLS();
//                       setShowExportOptions(false);
//                     }}
//                     className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
//                   >
//                     Export as XLS
//                   </button>
//                 </div>
//               )}
//             </div>
//           </div>
//         </div>

//         <div className="overflow-x-auto">
//           <table className="min-w-full text-sm border border-gray-300 rounded">
//             <thead className="bg-gray-100 text-left">
//               <tr>
//                 {[
//                   "spare_id",

//                   "item_name",
//                   "specification",

//                   "total_quantity",
//                   "from_company",
//                   "location",
//                   "added_by",

//                   "net_amount",
//                   "stock_status",
//                   "updated_at",
//                 ].map((key) => (
//                   <th
//                     key={key}
//                     onClick={() => handleSort(key)}
//                     className="p-2 border-b cursor-pointer hover:bg-gray-200"
//                   >
//                     {key
//                       .replace(/_/g, " ")
//                       .replace(/\b\w/g, (l) => l.toUpperCase())}
//                     {sortConfig.key === key && (
//                       <span>
//                         {sortConfig.direction === "asc" ? " ▲" : " ▼"}
//                       </span>
//                     )}
//                   </th>
//                 ))}
//               </tr>
//             </thead>
//             <tbody>
//               {filteredData.map((row, idx) => (
//                 <tr key={row.spare_id + "_" + idx} className="border-t">
//                   <td className="p-2">{row.spare_id}</td>
//                   {/* <td className="p-2">{row.spare_number}</td> */}
//                   <td className="p-2">{row.item_name}</td>
//                   <td className="p-2">{row.specification}</td>

//                   <td className="p-2">{row.total_quantity}</td>
//                   <td className="p-2">{row.from_company}</td>
//                   <td className="p-2">{row.location}</td>
//                   <td className="p-2">{row.added_by}</td>

//                   <td className="p-2">{row.net_amount}</td>
//                   <td className="p-2">{row.stock_status}</td>
//                   <td className="p-2">
//                     {new Date(row.updated_at).toLocaleString()}
//                   </td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//       </div>
//     </div>
//   );
// }

// StockStatusModal.js
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

  // New state for editable column
  const [editingCell, setEditingCell] = useState({ id: null, key: null });
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetch("/api/spare/modelsummaryspare")
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

  // Handle double click to start editing
  function handleDoubleClick(id, key, value) {
    setEditingCell({ id, key });
    setEditValue(value);
  }

  // Handle saving the edited value
  async function handleSave(spareId) {
    if (editingCell.key === "min_qty" && editValue !== "") {
      try {
        const response = await fetch("/api/spare/update-min-qty", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            spareId: spareId,
            minQty: parseInt(editValue, 10),
          }),
        });

        if (response.ok) {
          const updatedData = data.map((item) =>
            item.spare_id === spareId
              ? { ...item, min_qty: parseInt(editValue, 10) }
              : item
          );
          setData(updatedData);
          console.log(`Min Qty for Spare ID ${spareId} updated successfully.`);
        } else {
          console.error("Failed to update min_qty.");
        }
      } catch (error) {
        console.error("Error updating min_qty:", error);
      }
    }
    setEditingCell({ id: null, key: null });
  }

  async function exportToXLS() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Stock Summary");

    worksheet.columns = [
      { header: "Spare ID", key: "spare_id", width: 20 },
      { header: "Spare Number", key: "spare_number", width: 20 },
      { header: "Item Name", key: "item_name", width: 25 },
      { header: "Specification", key: "specification", width: 25 },
      { header: "Latest Qty", key: "quantity", width: 15 },
      { header: "Total Qty", key: "total_quantity", width: 15 },
      { header: "Min Qty", key: "min_qty", width: 15 }, // Added
      { header: "From Company", key: "from_company", width: 20 },
      { header: "Location", key: "location", width: 15 },
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
    link.download = "stock_summary.xlsx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  function exportToPDF() {
    const doc = new jsPDF();
    autoTable(doc, {
      head: [
        [
          "Spare ID",
          "Spare Number",
          "Item Name",
          "Specification",
          "Latest Qty",
          "Total Qty",
          "Min Qty", // Added
          "From Company",
          "Location",
          "Added BY",
          "Sold to",
          "Sold Address",
          "Net Amount",
          "Update Date",
        ],
      ],
      body: filteredData.map((row) => [
        row.spare_id,
        row.spare_number,
        row.item_name,
        row.specification,
        row.quantity,
        row.total_quantity,
        row.min_qty, // Added
        row.from_company,
        row.location,
        row.added_by,
        row.to_company,
        row.delivery_address,
        row.net_amount,
        new Date(row.updated_at).toLocaleString(),
      ]),
    });
    doc.save("stock_summary.pdf");
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

        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
        }

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
          <h3 className="text-lg font-semibold">Stock Summary</h3>
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
                  "spare_id",
                  "item_name",
                  "specification",
                  "total_quantity",
                  "min_qty", // Added
                  "from_company",
                  "location",
                  "added_by",
                  "net_amount",
                  "stock_status",
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
              {filteredData.map((row, idx) => (
                <tr key={row.spare_id + "_" + idx} className="border-t">
                  <td className="p-2">{row.spare_id}</td>
                  <td className="p-2">{row.item_name}</td>
                  <td className="p-2">{row.specification}</td>
                  <td className="p-2">{row.total_quantity}</td>
                  {/* Min Qty Cell with Edit Functionality */}
                  <td
                    className="p-2"
                    onDoubleClick={() =>
                      handleDoubleClick(row.spare_id, "min_qty", row.min_qty)
                    }
                  >
                    {editingCell.id === row.spare_id &&
                    editingCell.key === "min_qty" ? (
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleSave(row.spare_id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleSave(row.spare_id);
                          }
                        }}
                        className="w-full text-center border-b-2 border-blue-500 focus:outline-none"
                        autoFocus
                      />
                    ) : (
                      <span className="cursor-pointer">{row.min_qty}</span>
                    )}
                  </td>
                  <td className="p-2">{row.from_company}</td>
                  <td className="p-2">{row.location}</td>
                  <td className="p-2">{row.added_by}</td>
                  <td className="p-2">{row.net_amount}</td>
                  <td className="p-2">{row.stock_status}</td>
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
