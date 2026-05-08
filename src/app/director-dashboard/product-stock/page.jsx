"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, ArrowRightLeft, History } from "lucide-react";
import Link from "next/link";

function ProductStockList() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [openSection, setOpenSection] = useState("list");
  const [availableStockData, setAvailableStockData] = useState([]);
  const [stockTransactionsData, setStockTransactionsData] = useState([]);
  const [stockSummaryData, setStockSummaryData] = useState([]);
  const [transactionsStatusFilter, setTransactionsStatusFilter] = useState(null);
  const [summarySearch, setSummarySearch] = useState("");
  const [summaryStatusFilter, setSummaryStatusFilter] = useState(null);
  const [transactionsSearch, setTransactionsSearch] = useState("");
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [transferQuantity, setTransferQuantity] = useState("");
  const [fromGodown, setFromGodown] = useState("");
  const [toGodown, setToGodown] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [showTransferHistoryModal, setShowTransferHistoryModal] = useState(false);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState(null);
  const [transferHistoryData, setTransferHistoryData] = useState([]);
  const [loadingTransferHistory, setLoadingTransferHistory] = useState(false);

  useEffect(() => {
    fetchProductStock();
    fetchAvailableStock();
    fetchStockTransactions();
    fetchStockSummary();
  }, []);

  const fetchProductStock = async () => {
    try {
      const res = await fetch("/api/products/list");
      const data = await res.json();
      setRows(data || []);
    } catch (err) {
      console.error("Error fetching product stock:", err);
    }
  };

  const fetchAvailableStock = async () => {
    try {
      const res = await fetch("/api/available-stock");
      const data = await res.json();
      setAvailableStockData(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching available stock:", err);
      setAvailableStockData([]);
    }
  };

  const fetchStockTransactions = async () => {
    try {
      const res = await fetch("/api/product-stock-summary");
      const data = await res.json();
      setStockTransactionsData(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching stock transactions:", err);
      setStockTransactionsData([]);
    }
  };

  const fetchStockSummary = async () => {
    try {
      const res = await fetch("/api/product-stock-status");
      const data = await res.json();
      setStockSummaryData(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching stock summary:", err);
      setStockSummaryData([]);
    }
  };

  const openTransferModal = (product) => {
    setSelectedProduct(product);
    setShowTransferModal(true);
  };

  const closeTransferModal = () => {
    setShowTransferModal(false);
    setSelectedProduct(null);
    setTransferQuantity("");
    setFromGodown("");
    setToGodown("");
  };

  const handleTransfer = async () => {
    if (!selectedProduct || !transferQuantity || !fromGodown || !toGodown) {
      alert("Please fill all fields");
      return;
    }

    if (fromGodown === toGodown) {
      alert("Source and destination godowns cannot be the same");
      return;
    }

    const quantity = parseInt(transferQuantity);
    const availableQuantity = fromGodown === "delhi" ? (selectedProduct.delhi || 0) : (selectedProduct.south || 0);

    if (quantity > availableQuantity) {
      alert(`Insufficient stock in ${fromGodown}. Available: ${availableQuantity}`);
      return;
    }

    try {
      setTransferring(true);
      const res = await fetch("/api/stock/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_code: selectedProduct.product_code,
          from_godown: fromGodown,
          to_godown: toGodown,
          quantity: quantity
        })
      });
      
      const data = await res.json();
      
      if (!res.ok || data.success === false) {
        alert(data.error || "Transfer failed");
        return;
      }
      
      // Update local state
      setAvailableStockData(prev => 
        prev.map(item => 
          item.product_code === selectedProduct.product_code 
            ? { ...item, delhi: data.newDelhi, south: data.newSouth }
            : item
        )
      );
      
      alert(data.message);
      closeTransferModal();
    } catch (error) {
      console.error("Transfer error:", error);
      alert("Transfer failed. Please try again.");
    } finally {
      setTransferring(false);
    }
  };

  const fetchTransferHistory = async (productCode) => {
    try {
      setLoadingTransferHistory(true);
      const res = await fetch(`/api/stock/transfer-history?product_code=${productCode}`);
      const data = await res.json();
      
      if (!res.ok || data.success === false) {
        console.error("Failed to fetch transfer history", data.error);
        alert("Failed to fetch transfer history");
        return;
      }
      
      setTransferHistoryData(data.data || []);
    } catch (error) {
      console.error("Error fetching transfer history:", error);
      alert("Error fetching transfer history");
    } finally {
      setLoadingTransferHistory(false);
    }
  };

  const openTransferHistoryModal = (product) => {
    setSelectedProductForHistory(product);
    setShowTransferHistoryModal(true);
    fetchTransferHistory(product.product_code);
  };

  const closeTransferHistoryModal = () => {
    setShowTransferHistoryModal(false);
    setSelectedProductForHistory(null);
    setTransferHistoryData([]);
  };

  const totalMinQty = rows.reduce((sum, row) => sum + (row.min_qty || 0), 0);
  const totalPrice = rows.reduce((sum, row) => sum + ((row.min_qty || 0) * (row.price_per_unit || 0)), 0);

  const filteredAvailableStock = useMemo(() => {
    const rows = Array.isArray(availableStockData) ? [...availableStockData] : [];
    return q
      ? rows.filter((item) =>
        Object.values(item).some((val) =>
          String(val ?? "").toLowerCase().includes(q.toLowerCase())
        )
      )
      : rows;
  }, [availableStockData, q]);

  const filteredTransactions = useMemo(() => {
    const rows = Array.isArray(stockTransactionsData) ? [...stockTransactionsData] : [];
    return rows.filter((row) => {
      const matchesSearch = transactionsSearch
        ? Object.values(row).some((val) =>
          String(val ?? "").toLowerCase().includes(transactionsSearch.toLowerCase())
        )
        : true;
      const matchesStatus = transactionsStatusFilter
        ? row.stock_status === transactionsStatusFilter
        : true;
      return matchesSearch && matchesStatus;
    });
  }, [transactionsSearch, transactionsStatusFilter, stockTransactionsData]);

  const filteredSummary = useMemo(() => {
    const rows = Array.isArray(stockSummaryData) ? [...stockSummaryData] : [];
    return rows.filter((row) => {
      const matchesSearch = summarySearch
        ? Object.values(row).some((val) =>
          String(val ?? "").toLowerCase().includes(summarySearch.toLowerCase())
        )
        : true;
      const matchesStatus = summaryStatusFilter
        ? (row.last_status || row.stock_status) === summaryStatusFilter
        : true;
      return matchesSearch && matchesStatus;
    });
  }, [summarySearch, summaryStatusFilter, stockSummaryData]);

  const filteredRows = useMemo(() => {
    if (!q) return rows;
    const lowerQ = q.toLowerCase();
    return rows.filter(row =>
      (row.item_name || "").toLowerCase().includes(lowerQ) ||
      (row.item_code || "").toLowerCase().includes(lowerQ) ||
      (row.product_number || "").toLowerCase().includes(lowerQ)
    );
  }, [rows, q]);

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Product Stock Management</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin-dashboard/add-assets" className="text-sm px-4 py-2 rounded text-white bg-blue-600 hover:bg-blue-700">
            Add New Product
          </Link>
          {/* Section Toggle Buttons */}
          <button
            onClick={() => setOpenSection("list")}
            className={`text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded text-white ${openSection === "list"
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-blue-500 hover:bg-blue-600"
              }`}
          >
            List
          </button>
          <button
            onClick={() => setOpenSection("available")}
            className={`text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded text-white ${openSection === "available"
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "bg-gray-500 hover:bg-gray-600"
              }`}
          >
            Available Stock
          </button>
          <button
            onClick={() => setOpenSection("transactions")}
            className={`text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded text-white ${openSection === "transactions"
              ? "bg-indigo-600 hover:bg-indigo-700"
              : "bg-gray-500 hover:bg-gray-600"
              }`}
          >
            Stock Transactions
          </button>
          <button
            onClick={() => setOpenSection("summary")}
            className={`text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded text-white ${openSection === "summary"
              ? "bg-pink-600 hover:bg-pink-700"
              : "bg-gray-500 hover:bg-gray-600"
              }`}
          >
            Stock Summary
          </button>
        </div>
      </div>

      {/* List Section */}
      {openSection === "list" && (
        <>
          <div className="flex justify-between items-center mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search products..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-10 pr-4 py-2 border rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <div className="text-sm font-medium text-blue-600">Total Min Qty</div>
              <div className="text-2xl font-bold text-blue-800">{totalMinQty.toLocaleString()}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-100">
              <div className="text-sm font-medium text-green-600">Total Price</div>
              <div className="text-2xl font-bold text-green-800">₹{totalPrice.toLocaleString()}</div>
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
                    Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product No
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
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRows.map((row) => (
                  <tr key={row.id || row.item_code} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.image_path || row.product_image ? (
                        <img
                          src={row.image_path || row.product_image}
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
                      {row.item_code}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.item_name}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.product_number}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.min_qty}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₹{row.price_per_unit?.toLocaleString() || 0}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₹{row.last_negotiation_price?.toLocaleString() || 0}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.specification}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Available Stock Section */}
      {openSection === "available" && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Available Stock</h2>
          <div className="flex justify-between items-center mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search available stock..."
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
                    Product Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product Image
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Qty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Delhi Godown
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    South Godown
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Storage Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Updated At
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAvailableStock.map((row, idx) => (
                  <tr key={row.product_code || idx} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      {row.product_code}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.image || row.product_image ? (
                        <img
                          src={row.image || row.product_image}
                          alt={row.product_name || row.item_name}
                          className="h-12 w-12 object-cover rounded"
                        />
                      ) : (
                        <div className="h-12 w-12 bg-gray-200 rounded flex items-center justify-center text-gray-400">
                          No Image
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      {row.product_name || row.item_name}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      {(row.delhi || 0) + (row.south || 0)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      {row.delhi || 0}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      {row.south || 0}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      {row.location || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      {row.updated_at ? new Date(row.updated_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openTransferModal(row)}
                          className="p-1 text-blue-600 hover:text-blue-800"
                          title="Transfer Stock"
                        >
                          <ArrowRightLeft size={16} />
                        </button>
                        <button
                          onClick={() => openTransferHistoryModal(row)}
                          className="p-1 text-green-600 hover:text-green-800"
                          title="Transfer History"
                        >
                          <History size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredAvailableStock.length === 0 && (
                  <tr>
                    <td colSpan="9" className="px-4 py-8 text-center text-gray-500">
                      No available stock data found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock Transactions Section */}
      {openSection === "transactions" && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Stock Transactions</h2>
          <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search..."
                value={transactionsSearch}
                onChange={(e) => setTransactionsSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 border rounded-md text-xs sm:text-sm w-full"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setTransactionsStatusFilter("IN")}
                className={`px-3 py-1.5 text-xs sm:text-sm rounded ${transactionsStatusFilter === "IN"
                  ? "bg-green-600 text-white"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                  }`}
              >
                IN
              </button>
              <button
                onClick={() => setTransactionsStatusFilter("OUT")}
                className={`px-3 py-1.5 text-xs sm:text-sm rounded ${transactionsStatusFilter === "OUT"
                  ? "bg-red-600 text-white"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                  }`}
              >
                OUT
              </button>
              <button
                onClick={() => setTransactionsStatusFilter(null)}
                className={`px-3 py-1.5 text-xs sm:text-sm rounded ${transactionsStatusFilter === null
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                  }`}
              >
                All
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product UID No</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Latest Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From Company</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Godown</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Added By</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sold To</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sold Address</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Net Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Updated At</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan="13" className="px-4 py-8 text-center text-gray-500">
                      No stock transactions available
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((row, idx) => (
                    <tr key={row.product_code + "_" + idx} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{row.product_code}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{row.product_number}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{row.item_name}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{row.quantity}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{row.from_company || "--"}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{row.location}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{row.godown || "--"}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{row.added_by || "--"}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{row.to_company || "--"}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{row.delivery_address || "--"}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{row.net_amount}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <span className={`font-semibold ${row.stock_status === "IN" ? "text-green-600" : "text-red-600"}`}>
                          {row.stock_status}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.updated_at ? new Date(row.updated_at).toLocaleString() : "--"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock Summary Section */}
      {openSection === "summary" && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Stock Summary</h2>
          <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search..."
                value={summarySearch}
                onChange={(e) => setSummarySearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 border rounded-md text-xs sm:text-sm w-full"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSummaryStatusFilter("IN")}
                className={`px-3 py-1.5 rounded-md text-xs sm:text-sm ${summaryStatusFilter === "IN"
                  ? "bg-blue-700 text-white"
                  : "bg-gray-200 text-black"
                  }`}
              >
                IN
              </button>
              <button
                onClick={() => setSummaryStatusFilter("OUT")}
                className={`px-3 py-1.5 rounded-md text-xs sm:text-sm ${summaryStatusFilter === "OUT"
                  ? "bg-blue-700 text-white"
                  : "bg-gray-200 text-black"
                  }`}
              >
                OUT
              </button>
              <button
                onClick={() => setSummaryStatusFilter(null)}
                className="px-3 py-1.5 rounded-md text-xs sm:text-sm bg-gray-100"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Spare Number</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Quantity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delhi</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">South</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Updated At</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSummary.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                      No stock summary available
                    </td>
                  </tr>
                ) : (
                  filteredSummary.map((row, idx) => {
                    const status = row.last_status || row.stock_status || "";
                    return (
                      <tr key={(row.spare_id || "spare") + "_" + idx} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{row.spare_number}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{row.item_name}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{row.total_quantity}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{row.Delhi}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{row.South}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          <span className={`font-semibold ${status === "IN" ? "text-green-600" : "text-red-600"}`}>
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {row.updated_at ? new Date(row.updated_at).toLocaleString() : "--"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Transfer Stock</h3>
              <button
                onClick={closeTransferModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-500">Product Code</label>
                <p className="text-sm font-semibold">{selectedProduct.product_code}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Item Name</label>
                <p className="text-sm">{selectedProduct.product_name || selectedProduct.item_name}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Delhi Stock</label>
                <p className="text-sm">{selectedProduct.delhi || 0}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">South Stock</label>
                <p className="text-sm">{selectedProduct.south || 0}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Godown</label>
                <select
                  value={fromGodown}
                  onChange={(e) => setFromGodown(e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="">Select source</option>
                  <option value="delhi">Delhi Godown ({selectedProduct.delhi || 0})</option>
                  <option value="south">South Godown ({selectedProduct.south || 0})</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Godown</label>
                <select
                  value={toGodown}
                  onChange={(e) => setToGodown(e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="">Select destination</option>
                  <option value="delhi">Delhi Godown ({selectedProduct.delhi || 0})</option>
                  <option value="south">South Godown ({selectedProduct.south || 0})</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  value={transferQuantity}
                  onChange={(e) => setTransferQuantity(e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="Enter quantity"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={closeTransferModal}
                className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                disabled={transferring}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {transferring ? "Transferring..." : "Transfer Stock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer History Modal */}
      {showTransferHistoryModal && selectedProductForHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Transfer History</h3>
              <button
                onClick={closeTransferHistoryModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Product: {selectedProductForHistory.product_name || selectedProductForHistory.item_name} ({selectedProductForHistory.product_code})
            </p>
            {loadingTransferHistory ? (
              <p className="text-center text-gray-500">Loading...</p>
            ) : transferHistoryData.length === 0 ? (
              <p className="text-center text-gray-500">No transfer history found</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">From/To Godown</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Note</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Added By</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock After Transfer</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transferHistoryData.map((history, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 text-sm">{new Date(history.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm">{history.quantity}</td>
                      <td className="px-4 py-3 text-sm">{history.from_godown} → {history.to_godown}</td>
                      <td className="px-4 py-3 text-sm">{history.note || '-'}</td>
                      <td className="px-4 py-3 text-sm">{history.added_by || '-'}</td>
                      <td className="px-4 py-3 text-sm">{history.stock_after_transfer || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductStockPage() {
  return <ProductStockList />;
}
