"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Pencil } from "lucide-react";
import Link from "next/link";

function SpareLists() {
  const [rows, setRows] = useState([]);
  const [stockTotals, setStockTotals] = useState({ totalQty: 0, totalValue: 0 });
  const [q, setQ] = useState("");
  const [editingSpare, setEditingSpare] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [availableData, setAvailableData] = useState([]);
  const [txData, setTxData] = useState([]);
  const [summaryData, setSummaryData] = useState([]);
  const [availableSearch, setAvailableSearch] = useState("");
  const [txSearch, setTxSearch] = useState("");
  const [summarySearch, setSummarySearch] = useState("");
  const [txStatusFilter, setTxStatusFilter] = useState(null);
  const [summaryStatusFilter, setSummaryStatusFilter] = useState(null);
  const [openSection, setOpenSection] = useState("list");
  const [editingLocation, setEditingLocation] = useState({ key: null, value: "" });
  const [savingLocation, setSavingLocation] = useState(false);

  useEffect(() => {
    fetchSpareStock();
    fetchStockTotals();
    fetchAvailableStock();
    fetchTxData();
    fetchSummaryData();
  }, []);

  const fetchSpareStock = async () => {
    try {
      const res = await fetch("/api/spare/list");
      const data = await res.json();
      setRows(data || []);
    } catch (err) {
      console.error("Error fetching spare stock:", err);
    }
  };

  const fetchStockTotals = async () => {
    try {
      const res = await fetch("/api/spare/total-value");
      const data = await res.json();
      setStockTotals({ totalQty: data.totalQty || 0, totalValue: data.totalValue || 0 });
    } catch (err) {
      console.error("Error fetching stock totals:", err);
      setStockTotals({ totalQty: 0, totalValue: 0 });
    }
  };

  const fetchAvailableStock = async () => {
    try {
      const res = await fetch("/api/spare/available-stock");
      const data = await res.json();
      setAvailableData(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching available stock:", err);
      setAvailableData([]);
    }
  };

  const fetchTxData = async () => {
    try {
      const res = await fetch("/api/spare/modelsummary");
      const data = await res.json();
      setTxData(data || []);
    } catch (err) {
      console.error("Error fetching transactions:", err);
      setTxData([]);
    }
  };

  const fetchSummaryData = async () => {
    try {
      const res = await fetch("/api/spare/modelsummaryspare");
      const data = await res.json();
      setSummaryData(data || []);
    } catch (err) {
      console.error("Error fetching summary:", err);
      setSummaryData([]);
    }
  };

  const handleSaveLocation = async (row) => {
    if (!editingLocation.key || savingLocation) return;
    try {
      setSavingLocation(true);
      const res = await fetch("/api/stock/update-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "spare",
          code: row.spare_id,
          location: editingLocation.value || "",
        }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        console.error("Failed to update location", data.error || data.message);
        return;
      }
      setAvailableData((prev) =>
        Array.isArray(prev)
          ? prev.map((r) =>
            r.spare_id === row.spare_id
              ? { ...r, location: editingLocation.value || "" }
              : r
          )
          : prev
      );
      setEditingLocation({ key: null, value: "" });
    } catch (e) {
      console.error("Error updating location", e);
    } finally {
      setSavingLocation(false);
    }
  };

  const handleEditClick = (spare) => {
    setEditingSpare({ ...spare });
    setIsModalOpen(true);
  };

  const handleSaveSpare = async () => {
    try {
      const formData = new FormData();
      formData.append('id', editingSpare.id);
      formData.append('spare_number', editingSpare.spare_number);
      formData.append('item_name', editingSpare.item_name);
      formData.append('min_qty', editingSpare.min_qty);
      formData.append('price', editingSpare.price);
      formData.append('last_negotiation_price', editingSpare.last_negotiation_price);
      formData.append('specification', editingSpare.specification);
      if (editingSpare.newImageFile) {
        formData.append('image', editingSpare.newImageFile);
      }

      const res = await fetch('/api/spare/update', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to update spare');
        return;
      }

      // Refresh the list
      fetchSpareStock();

      setIsModalOpen(false);
      setEditingSpare(null);
    } catch (error) {
      console.error('Error saving spare:', error);
      alert('Failed to update spare');
    }
  };

  const filteredRows = useMemo(() => {
    if (!q) return rows;
    const lowerQ = q.toLowerCase();
    return rows.filter(row =>
      (row.item_name || "").toLowerCase().includes(lowerQ) ||
      (row.spare_number || "").toLowerCase().includes(lowerQ)
    );
  }, [rows, q]);

  const filteredAvailable = useMemo(() => {
    const rows = Array.isArray(availableData) ? [...availableData] : [];
    if (!availableSearch) return rows;
    return rows.filter((item) => Object.values(item).some((v) => String(v ?? "").toLowerCase().includes(availableSearch.toLowerCase())));
  }, [availableData, availableSearch]);

  const filteredTx = useMemo(() => {
    let rows = Array.isArray(txData) ? [...txData] : [];
    if (txStatusFilter) rows = rows.filter((r) => String(r.stock_status || "").toUpperCase() === txStatusFilter);
    if (txSearch) rows = rows.filter((r) => Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(txSearch.toLowerCase())));
    return rows;
  }, [txData, txSearch, txStatusFilter]);

  const filteredSummary = useMemo(() => {
    let rows = Array.isArray(summaryData) ? [...summaryData] : [];
    if (summaryStatusFilter) rows = rows.filter((r) => String(r.stock_status || "").toLowerCase() === summaryStatusFilter.toLowerCase());
    if (summarySearch) rows = rows.filter((r) => Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(summarySearch.toLowerCase())));
    return rows;
  }, [summaryData, summarySearch, summaryStatusFilter]);

  return (
    <div className="max-w-6xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Spare Stock Management</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/director-dashboard/add-spare" className="text-sm px-4 py-2 rounded text-white bg-blue-600 hover:bg-blue-700">Add New Spare</Link>
          <button onClick={() => setOpenSection("list")} className={`text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded text-white ${openSection === "list" ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-500 hover:bg-blue-600"}`}>List</button>
          <button onClick={() => setOpenSection("available")} className={`text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded text-white ${openSection === "available" ? "bg-teal-600" : "bg-teal-500 hover:bg-teal-600"}`}>Available Stock</button>
          <button onClick={() => setOpenSection("transactions")} className={`text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded text-white ${openSection === "transactions" ? "bg-indigo-600" : "bg-gray-500 hover:bg-gray-600"}`}>Stock Transactions</button>
          <button onClick={() => setOpenSection("summary")} className={`text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded text-white ${openSection === "summary" ? "bg-pink-600" : "bg-gray-500 hover:bg-gray-600"}`}>Stock Summary</button>
        </div>
      </div>

      {/* List Section */}
      <div className={`bg-white border rounded-lg shadow-sm mt-6 ${openSection === "list" ? "" : "hidden"}`}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 cursor-pointer hover:bg-gray-50" onClick={() => setOpenSection(openSection === "list" ? null : "list")}>
          <h3 className="text-base sm:text-lg font-semibold text-gray-800">List</h3>
          <span className="text-xl sm:text-2xl font-bold text-gray-500">{openSection === "list" ? "−" : "+"}</span>
        </div>
        {openSection === "list" && (
          <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-0">
            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                <div className="text-sm font-medium text-blue-600">Total Stock Qty</div>
                <div className="text-2xl font-bold text-blue-800">{stockTotals.totalQty.toLocaleString()}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                <div className="text-sm font-medium text-green-600">Total Stock Value</div>
                <div className="text-2xl font-bold text-green-800">₹{stockTotals.totalValue.toLocaleString()}</div>
              </div>
            </div>

            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-800">Spare Parts Inventory</h1>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search spare parts..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Image
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Spare No
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Min Qty
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Neg. Price
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Specification
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.image ? (
                          <img
                            src={row.image}
                            alt={row.item_name}
                            className="h-12 w-12 object-cover rounded"
                          />
                        ) : (
                          <div className="h-12 w-12 bg-gray-200 rounded flex items-center justify-center text-gray-400">
                            No Image
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {row.spare_number}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.item_name}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.min_qty}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₹{row.price?.toLocaleString() || 0}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₹{row.last_negotiation_price?.toLocaleString() || 0}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.specification}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <button
                          onClick={() => handleEditClick(row)}
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Available Stock Section */}
      <div className={`bg-white border rounded-lg shadow-sm mt-6 ${openSection === "available" ? "" : "hidden"}`}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 cursor-pointer hover:bg-gray-50" onClick={() => setOpenSection(openSection === "available" ? null : "available")}>
          <h3 className="text-base sm:text-lg font-semibold text-gray-800">Available Stock</h3>
          <span className="text-xl sm:text-2xl font-bold text-gray-500">{openSection === "available" ? "−" : "+"}</span>
        </div>
        {openSection === "available" && (
          <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                <input type="text" placeholder="Search..." value={availableSearch} onChange={(e) => setAvailableSearch(e.target.value)} className="pl-8 pr-3 py-1.5 border rounded-md text-xs sm:text-sm w-full" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs sm:text-sm border border-gray-200 rounded">
                <thead className="bg-gray-100 text-left text-[11px] sm:text-xs">
                  <tr>
                    <th className="p-2 sm:p-3 border-b">Spare Number</th>
                    <th className="p-2 sm:p-3 border-b">Spare Image</th>
                    <th className="p-2 sm:p-3 border-b">Spare Name</th>
                    <th className="p-2 sm:p-3 border-b">Total Qty</th>
                    <th className="p-2 sm:p-3 border-b">Delhi Godown</th>
                    <th className="p-2 sm:p-3 border-b">South Godown</th>
                    <th className="p-2 sm:p-3 border-b">Storage Location</th>
                    <th className="p-2 sm:p-3 border-b">Updated At</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAvailable.length === 0 ? (
                    <tr><td colSpan="8" className="p-4 text-center text-gray-500">No stock data available</td></tr>
                  ) : (
                    filteredAvailable.map((row, idx) => (
                      <tr key={(row.spare_number || "spare") + "_" + idx} className="border-t hover:bg-gray-50">
                        <td className="p-2 sm:p-3">{row.spare_number}</td>
                        <td className="p-2 sm:p-3">{row.spare_image ? (<img src={row.spare_image} alt={row.spare_name || "Spare"} className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded" />) : (<span className="text-gray-400">No image</span>)}</td>
                        <td className="p-2 sm:p-3">{row.spare_name}</td>
                        <td className="p-2 sm:p-3 font-semibold">{row.total}</td>
                        <td className="p-2 sm:p-3">{row.delhi}</td>
                        <td className="p-2 sm:p-3">{row.south}</td>
                        <td className="p-2 sm:p-3">
                          {editingLocation.key === row.spare_id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editingLocation.value}
                                onChange={(e) =>
                                  setEditingLocation((prev) => ({
                                    ...prev,
                                    value: e.target.value,
                                  }))
                                }
                                className="border rounded px-2 py-1 text-[11px] sm:text-xs w-full"
                              />
                              <button
                                onClick={() => handleSaveLocation(row)}
                                disabled={savingLocation}
                                className="px-2 py-1 text-[11px] sm:text-xs bg-blue-600 text-white rounded disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingLocation({ key: null, value: "" })}
                                disabled={savingLocation}
                                className="px-2 py-1 text-[11px] sm:text-xs bg-gray-200 text-gray-700 rounded disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span>{row.location || "--"}</span>
                              <button
                                onClick={() =>
                                  setEditingLocation({
                                    key: row.spare_id,
                                    value: row.location || "",
                                  })
                                }
                                className="text-gray-500 hover:text-blue-600"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="p-2 sm:p-3 whitespace-nowrap">{row.updated_at ? new Date(row.updated_at).toLocaleString() : ""}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Stock Transactions Section */}
      <div className={`bg-white border rounded-lg shadow-sm mt-6 ${openSection === "transactions" ? "" : "hidden"}`}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 cursor-pointer hover:bg-gray-50" onClick={() => setOpenSection(openSection === "transactions" ? null : "transactions")}>
          <h3 className="text-base sm:text-lg font-semibold text-gray-800">Stock Transactions</h3>
          <span className="text-xl sm:text-2xl font-bold text-gray-500">{openSection === "transactions" ? "−" : "+"}</span>
        </div>
        {openSection === "transactions" && (
          <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-0">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                <input type="text" placeholder="Search..." value={txSearch} onChange={(e) => setTxSearch(e.target.value)} className="pl-8 pr-3 py-1.5 border rounded-md text-xs sm:text-sm w-full" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setTxStatusFilter("IN")} className={`px-3 py-1.5 text-xs sm:text-sm rounded ${txStatusFilter === "IN" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-800 hover:bg-gray-300"}`}>IN</button>
                <button onClick={() => setTxStatusFilter("OUT")} className={`px-3 py-1.5 text-xs sm:text-sm rounded ${txStatusFilter === "OUT" ? "bg-red-600 text-white" : "bg-gray-200 text-gray-800 hover:bg-gray-300"}`}>OUT</button>
                <button onClick={() => setTxStatusFilter(null)} className={`px-3 py-1.5 text-xs sm:text-sm rounded ${txStatusFilter === null ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800 hover:bg-gray-300"}`}>All</button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs sm:text-sm border border-gray-200 rounded">
                <thead className="bg-gray-100 text-left text-[11px] sm:text-xs">
                  <tr>
                    <th className="p-2 sm:p-3 border-b">Spare ID</th>
                    <th className="p-2 sm:p-3 border-b">Spare Number</th>
                    <th className="p-2 sm:p-3 border-b">Spare Name</th>
                    <th className="p-2 sm:p-3 border-b">Latest Qty</th>
                    <th className="p-2 sm:p-3 border-b">From Company</th>
                    <th className="p-2 sm:p-3 border-b">Location</th>
                    <th className="p-2 sm:p-3 border-b">Godown</th>
                    <th className="p-2 sm:p-3 border-b">Added By</th>
                    <th className="p-2 sm:p-3 border-b">Sold To</th>
                    <th className="p-2 sm:p-3 border-b">Sold Address</th>
                    <th className="p-2 sm:p-3 border-b">Net Amount</th>
                    <th className="p-2 sm:p-3 border-b">Status</th>
                    <th className="p-2 sm:p-3 border-b">Updated At</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTx.length === 0 ? (
                    <tr><td colSpan="13" className="p-4 text-center text-gray-500">No stock transactions available</td></tr>
                  ) : (
                    filteredTx.map((row, idx) => (
                      <tr key={(row.spare_id || "spare") + "_" + idx} className="border-t hover:bg-gray-50">
                        <td className="p-2 sm:p-3">{row.spare_id}</td>
                        <td className="p-2 sm:p-3">{row.spare_number}</td>
                        <td className="p-2 sm:p-3">{row.spare_name}</td>
                        <td className="p-2 sm:p-3 font-semibold">{row.quantity}</td>
                        <td className="p-2 sm:p-3">{row.from_company || "--"}</td>
                        <td className="p-2 sm:p-3">{row.location || "--"}</td>
                        <td className="p-2 sm:p-3">{row.godown || "--"}</td>
                        <td className="p-2 sm:p-3">{row.added_by || "--"}</td>
                        <td className="p-2 sm:p-3">{row.to_company || "--"}</td>
                        <td className="p-2 sm:p-3">{row.delivery_address || "--"}</td>
                        <td className="p-2 sm:p-3">{row.net_amount}</td>
                        <td className="p-2 sm:p-3">
                          <span className={`font-semibold ${row.stock_status === "IN" ? "text-green-600" : "text-red-600"}`}>
                            {row.stock_status}
                          </span>
                        </td>
                        <td className="p-2 sm:p-3 whitespace-nowrap">{row.updated_at ? new Date(row.updated_at).toLocaleString() : ""}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Stock Summary Section */}
      <div className={`bg-white border rounded-lg shadow-sm mt-6 ${openSection === "summary" ? "" : "hidden"}`}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 cursor-pointer hover:bg-gray-50" onClick={() => setOpenSection(openSection === "summary" ? null : "summary")}>
          <h3 className="text-base sm:text-lg font-semibold text-gray-800">Stock Summary</h3>
          <span className="text-xl sm:text-2xl font-bold text-gray-500">{openSection === "summary" ? "−" : "+"}</span>
        </div>
        {openSection === "summary" && (
          <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-0">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                <input type="text" placeholder="Search..." value={summarySearch} onChange={(e) => setSummarySearch(e.target.value)} className="pl-8 pr-3 py-1.5 border rounded-md text-xs sm:text-sm w-full" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setSummaryStatusFilter("IN")} className={`px-3 py-1.5 rounded-md text-xs sm:text-sm ${summaryStatusFilter === "IN" ? "bg-blue-700 text-white" : "bg-gray-200 text-black"}`}>IN</button>
                <button onClick={() => setSummaryStatusFilter("OUT")} className={`px-3 py-1.5 rounded-md text-xs sm:text-sm ${summaryStatusFilter === "OUT" ? "bg-blue-700 text-white" : "bg-gray-200 text-black"}`}>OUT</button>
                <button onClick={() => setSummaryStatusFilter(null)} className="px-3 py-1.5 rounded-md text-xs sm:text-sm bg-gray-100">Reset</button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs sm:text-sm border border-gray-200 rounded">
                <thead className="bg-gray-100 text-left text-[11px] sm:text-xs">
                  <tr>
                    <th className="p-2 sm:p-3 border-b">Spare Number</th>
                    <th className="p-2 sm:p-3 border-b">Spare Name</th>
                    <th className="p-2 sm:p-3 border-b">Total Quantity</th>
                    <th className="p-2 sm:p-3 border-b">Delhi</th>
                    <th className="p-2 sm:p-3 border-b">South</th>
                    <th className="p-2 sm:p-3 border-b">Status</th>
                    <th className="p-2 sm:p-3 border-b">Updated At</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSummary.length === 0 ? (
                    <tr><td colSpan="7" className="p-4 text-center text-gray-500">No stock summary available</td></tr>
                  ) : (
                    filteredSummary.map((row, idx) => {
                      const status = row.last_status || row.stock_status || "";
                      return (
                        <tr key={(row.spare_id || "spare") + "_" + idx} className="border-t hover:bg-gray-50">
                          <td className="p-2 sm:p-3">{row.spare_number}</td>
                          <td className="p-2 sm:p-3">{row.spare_name}</td>
                          <td className="p-2 sm:p-3 font-semibold">{row.total_quantity}</td>
                          <td className="p-2 sm:p-3">{row.Delhi}</td>
                          <td className="p-2 sm:p-3">{row.South}</td>
                          <td className="p-2 sm:p-3">
                            <span className={`font-semibold ${status === "IN" ? "text-green-600" : "text-red-600"}`}>
                              {status}
                            </span>
                          </td>
                          <td className="p-2 sm:p-3 whitespace-nowrap">{row.updated_at ? new Date(row.updated_at).toLocaleString() : ""}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      {isModalOpen && editingSpare && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">Edit Spare</h3>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingSpare(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Spare Number */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">Spare No</label>
                <input
                  type="text"
                  value={editingSpare.spare_number || ""}
                  onChange={(e) => setEditingSpare({ ...editingSpare, spare_number: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              {/* Item Name */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editingSpare.item_name || ""}
                  onChange={(e) => setEditingSpare({ ...editingSpare, item_name: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              {/* Min Qty */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">Min Qty</label>
                <input
                  type="number"
                  value={editingSpare.min_qty || 0}
                  onChange={(e) => setEditingSpare({ ...editingSpare, min_qty: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              {/* Price */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">Price</label>
                <input
                  type="number"
                  value={editingSpare.price || 0}
                  onChange={(e) => setEditingSpare({ ...editingSpare, price: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                  step="0.01"
                />
              </div>
              {/* Last Negotiation Price */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">Last Neg. Price</label>
                <input
                  type="number"
                  value={editingSpare.last_negotiation_price || 0}
                  onChange={(e) => setEditingSpare({ ...editingSpare, last_negotiation_price: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                  step="0.01"
                />
              </div>
              {/* Specification */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">Specification</label>
                <textarea
                  value={editingSpare.specification || ""}
                  onChange={(e) => setEditingSpare({ ...editingSpare, specification: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                  rows={4}
                />
              </div>
              {/* Image Upload */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">Image</label>
                {editingSpare.image && (
                  <img
                    src={editingSpare.image}
                    className="w-24 h-24 object-cover rounded mb-2"
                    alt="Current"
                  />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setEditingSpare({
                        ...editingSpare,
                        newImageFile: file,
                        imagePreview: URL.createObjectURL(file)
                      });
                    }
                  }}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
                {editingSpare.imagePreview && (
                  <img
                    src={editingSpare.imagePreview}
                    className="w-24 h-24 object-cover rounded mt-2"
                    alt="Preview"
                  />
                )}
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingSpare(null);
                }}
                className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSpare}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SparePage() {
  return <SpareLists />;
}
