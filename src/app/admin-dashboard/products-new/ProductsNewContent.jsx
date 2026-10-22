"use client";

import { formatCrmDateOnly } from "@/lib/crmDateFormat";

import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import { useCallback, useEffect, useState } from "react";
import React from "react";
import { Search } from "lucide-react";
import Link from "next/link";
import InventoryPriceEditMenu from "@/components/inventory/InventoryPriceEditMenu";

async function fetchJson(url, { timeoutMs = 120_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return { res, data: await res.json().catch(() => null) };
  } finally {
    clearTimeout(timer);
  }
}

export default function ProductsNewContent() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [listLoadError, setListLoadError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailReloadKey, setDetailReloadKey] = useState(0);
  const [combinedData, setCombinedData] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [purchasePricePerUnit, setPurchasePricePerUnit] = useState(0);
  const [salePricePerUnit, setSalePricePerUnit] = useState(0);
  const [combinedSearch, setCombinedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [transferHistory, setTransferHistory] = useState([]);
  const [transferQuantity, setTransferQuantity] = useState("");
  const [fromGodown, setFromGodown] = useState("");
  const [toGodown, setToGodown] = useState("");
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setListLoadError("");
      try {
        const { res, data } = await fetchJson("/api/products/list", {
          timeoutMs: 90_000,
        });
        if (cancelled) return;
        if (!res.ok || data?.error) {
          setProducts([]);
          setListLoadError(data?.error || "Could not load products");
          return;
        }
        setProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) {
          setProducts([]);
          setListLoadError(
            err?.name === "AbortError"
              ? "Products list timed out. Refresh and try again."
              : "Could not load products list.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedProduct?.item_code) {
      setCombinedData([]);
      setSelectedStock(null);
      setPurchasePricePerUnit(0);
      setSalePricePerUnit(0);
      setDetailError("");
      return;
    }

    let cancelled = false;
    const code = encodeURIComponent(selectedProduct.item_code);
    const name = encodeURIComponent(selectedProduct.item_name || "");

    (async () => {
      setDetailLoading(true);
      setDetailError("");
      try {
        const { res, data } = await fetchJson(
          `/api/products/item-history?product_code=${code}&item_name=${name}`,
          { timeoutMs: 120_000 },
        );
        if (cancelled) return;
        if (!res.ok || data?.error) {
          setCombinedData([]);
          setDetailError(data?.error || "Failed to load product details");
          return;
        }
        setCombinedData(Array.isArray(data.combined) ? data.combined : []);
        setSelectedStock(data.stock || null);
        setPurchasePricePerUnit(Number(data.purchasePricePerUnit) || 0);
        setSalePricePerUnit(Number(data.salePricePerUnit) || 0);
      } catch (err) {
        if (!cancelled) {
          setCombinedData([]);
          setDetailError(
            err?.name === "AbortError"
              ? "Request timed out. Click the product again to retry."
              : "Failed to load product details",
          );
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedProduct?.item_code, selectedProduct?.item_name, detailReloadKey]);

  const reloadProductDetail = useCallback(() => {
    setDetailReloadKey((k) => k + 1);
  }, []);

  const handleProductPricesSaved = useCallback((updated) => {
    if (!updated?.item_code) return;
    setProducts((prev) =>
      prev.map((p) =>
        p.item_code === updated.item_code ? { ...p, ...updated } : p,
      ),
    );
    setSelectedProduct((prev) =>
      prev?.item_code === updated.item_code ? { ...prev, ...updated } : prev,
    );
  }, []);

  const fetchProductsListQuiet = useCallback(async () => {
    try {
      const { res, data } = await fetchJson("/api/products/list", {
        timeoutMs: 90_000,
      });
      if (res.ok && Array.isArray(data)) setProducts(data);
    } catch {
      /* keep existing list */
    }
  }, []);

  const getAvailableQty = (productCode) => {
    if (
      selectedProduct?.item_code === productCode &&
      selectedStock &&
      (selectedStock.delhi || selectedStock.south || selectedStock.total)
    ) {
      return {
        total: Number(selectedStock.total) || 0,
        delhi: Number(selectedStock.delhi) || 0,
        south: Number(selectedStock.south) || 0,
      };
    }
    const row = products.find((p) => p.item_code === productCode);
    const total = Number(row?.total_qty) || 0;
    return { total, delhi: 0, south: 0 };
  };

  const getStockColor = (productCode) => {
    const colors = [
      'bg-blue-100 text-blue-800',
      'bg-green-100 text-green-800',
      'bg-purple-100 text-purple-800',
      'bg-orange-100 text-orange-800',
      'bg-pink-100 text-pink-800',
      'bg-yellow-100 text-yellow-800',
      'bg-red-100 text-red-800',
      'bg-indigo-100 text-indigo-800',
      'bg-teal-100 text-teal-800',
      'bg-cyan-100 text-cyan-800',
    ];
    // Generate a consistent color based on product code
    const index = productCode.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
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

    const qty = parseInt(transferQuantity);
    const availableQty = fromGodown === "Delhi" ? getAvailableQty(selectedProduct.item_code).delhi : getAvailableQty(selectedProduct.item_code).south;

    if (qty > availableQty) {
      alert(`Insufficient stock in ${fromGodown}. Available: ${availableQty}`);
      return;
    }

    try {
      setTransferring(true);
      const res = await fetch("/api/stock/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_code: selectedProduct.item_code,
          from_godown: fromGodown,
          to_godown: toGodown,
          quantity: qty
        })
      });

      const data = await res.json();

      if (!res.ok || data.success === false) {
        alert(data.error || "Transfer failed");
        return;
      }

      alert(data.message || "Transfer successful");
      setShowTransferModal(false);
      setTransferQuantity("");
      setFromGodown("");
      setToGodown("");
      reloadProductDetail();
      fetchProductsListQuiet();
    } catch (error) {
      console.error("Transfer error:", error);
      alert("Transfer failed. Please try again.");
    } finally {
      setTransferring(false);
    }
  };

  const fetchTransferHistory = async () => {
    if (!selectedProduct) return;
    try {
      const res = await fetch(`/api/stock/transfer-history?product_code=${selectedProduct.item_code}`);
      const data = await res.json();
      if (!res.ok || data.success === false) {
        console.error("Failed to fetch transfer history", data.error);
        setTransferHistory([]);
        return;
      }
      setTransferHistory(data.data || []);
    } catch (error) {
      console.error("Error fetching transfer history:", error);
      setTransferHistory([]);
    }
  };

  const openHistoryModal = () => {
    setShowHistoryModal(true);
    fetchTransferHistory();
  };

  const filteredProducts = products.filter((product) => {
    const searchLower = search.toLowerCase();
    return (
      (product.item_code || "").toLowerCase().includes(searchLower) ||
      (product.item_name || "").toLowerCase().includes(searchLower) ||
      String(product.product_number || "").toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="flex h-full flex-col bg-gray-50 md:flex-row">
      {/* Sidebar */}
      <div className="w-full md:w-80 bg-white border-b md:border-b-0 md:border-r border-gray-200 flex flex-col md:h-full h-64">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-800">Products List</h2>
            <Link
              href="/admin-dashboard/add-assets"
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              + Add New
            </Link>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Loading...</div>
          ) : listLoadError ? (
            <div className="p-4 text-center text-red-600 text-sm">{listLoadError}</div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No products found</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredProducts.map((product) => {
                const qty = getAvailableQty(product.item_code);
                return (
                  <div
                    key={product.item_code}
                    onClick={() => setSelectedProduct(product)}
                    className={`p-4 cursor-pointer hover:bg-blue-50 transition-colors flex items-center justify-between ${
                      selectedProduct?.item_code === product.item_code ? "bg-blue-100 border-l-4 border-blue-500" : ""
                    }`}
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-gray-800 text-sm">{product.item_name}</div>
                      <div className="text-xs text-gray-500 mt-1">{product.item_code}</div>
                      <div className="text-xs text-gray-400 mt-1">{product.product_number || "-"}</div>
                    </div>
                    <div className="flex-shrink-0 ml-2 flex items-center gap-1">
                      <InventoryPriceEditMenu
                        kind="product"
                        row={product}
                        onSaved={handleProductPricesSaved}
                      />
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${getStockColor(product.item_code)}`}>
                        {qty.total}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-6 overflow-y-auto">
        {selectedProduct ? (
          <>
            {detailLoading && (
              <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                Loading product history…
              </div>
            )}
            {detailError && !detailLoading && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {detailError}
              </div>
            )}
            {/* Purchase and Sales Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 max-w-4xl">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-4">
                <h3 className="text-base font-semibold text-gray-800 mb-3">Prices</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-xs font-medium">Purchase Price: <span className="text-lg font-bold text-gray-900">₹{purchasePricePerUnit.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span></p>
                    </div>
                    <div className="p-2 bg-green-100 rounded-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-xs font-medium">Sales Price: <span className="text-lg font-bold text-gray-900">₹{salePricePerUnit.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span></p>
                    </div>
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-4">
                <h3 className="text-base font-semibold text-gray-800 mb-3">Pricing Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">GEM Price:</span>
                    <span className="font-semibold">₹{parseFloat(selectedProduct.gem_price) || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">GEM Last Neg. Price:</span>
                    <span className="font-semibold">₹{parseFloat(selectedProduct.gem_last_negotiation_price) || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Dealer Price:</span>
                    <span className="font-semibold">₹{parseFloat(selectedProduct.dealer_price) || 0}</span>
                  </div>
                  <div className="flex justify-between items-center border-t pt-2">
                    <span className="text-gray-600">Last Neg. Price:</span>
                    <span className="font-semibold">₹{parseFloat(selectedProduct.last_negotiation_price) || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Product Information Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 mb-6 max-w-4xl">
              <h3 className="text-base font-semibold text-gray-800 mb-4">Product Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Item Code</p>
                  <p className="text-gray-900 font-semibold">{selectedProduct.item_code}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm font-medium">Item Name</p>
                  <p className="text-gray-900 font-semibold">{selectedProduct.item_name}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm font-medium">GST Rate</p>
                  <p className="text-gray-900 font-semibold">{selectedProduct.gst_rate}%</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm font-medium">DP NO-warranty</p>
                  <p className="text-gray-900 font-semibold">{selectedProduct.dp_no_warranty || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm font-medium">DP</p>
                  <p className="text-gray-900 font-semibold">{selectedProduct.dp || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm font-medium">Min Qty</p>
                  <p className="text-gray-900 font-semibold">{selectedProduct.min_qty || '0'}</p>
                </div>
              </div>
            </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-4">
                <h3 className="text-base font-semibold text-gray-800 mb-3">Stock</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-xs font-medium">Total Quantity: <span className="text-lg font-bold text-gray-900">{getAvailableQty(selectedProduct.item_code).total}</span></p>
                    </div>
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-xs font-medium">Stock Value: <span className="text-lg font-bold text-gray-900">₹{(getAvailableQty(selectedProduct.item_code).total * purchasePricePerUnit).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span></p>
                    </div>
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12 a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            

            {/* Combined Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
              <div className="mb-4 flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Search all records..."
                  value={combinedSearch}
                  onChange={(e) => setCombinedSearch(e.target.value)}
                  className="max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Types</option>
                  <option value="Purchase">Purchase</option>
                  <option value="Sale">Sale</option>
                  <option value="Transfer">Transfer</option>
                  <option value="Invoice">Invoice</option>
                  <option value="Quotation">Quotation</option>
                </select>
                <TypeableDateFilterInput value={fromDate} onChange={setFromDate} className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                <TypeableDateFilterInput value={toDate} onChange={setToDate} className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border border-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-3 border-b text-left font-semibold">Type</th>
                      <th className="p-3 border-b text-left font-semibold">Invoice/Ref.No</th>
                      <th className="p-3 border-b text-left font-semibold">Name</th>
                      <th className="p-3 border-b text-left font-semibold">Price/Unit</th>
                      <th className="p-3 border-b text-left font-semibold">Quantity</th>
                      <th className="p-3 border-b text-left font-semibold">Date</th>
                      <th className="p-3 border-b text-left font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {combinedData
                      .filter(item => {
                        if (!combinedSearch) return true;
                        const searchLower = combinedSearch.toLowerCase();
                        return (
                          item.type.toLowerCase().includes(searchLower) ||
                          item.display.main.toLowerCase().includes(searchLower) ||
                          item.display.sub1.toLowerCase().includes(searchLower) ||
                          item.display.sub2.toLowerCase().includes(searchLower)
                        );
                      })
                      .filter(item => {
                        if (typeFilter === "all") return true;
                        return item.type === typeFilter;
                      })
                      .filter(item => {
                        if (!fromDate && !toDate) return true;
                        const itemDate = item.display.date ? new Date(item.display.date) : null;
                        if (!itemDate) return false;
                        
                        if (fromDate && itemDate < new Date(fromDate)) return false;
                        if (toDate && itemDate > new Date(toDate)) return false;
                        
                        return true;
                      })
                      .length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-4 text-center text-gray-500">
                          No records found for this product
                        </td>
                      </tr>
                    ) : (
                      combinedData
                        .filter(item => {
                          if (!combinedSearch) return true;
                          const searchLower = combinedSearch.toLowerCase();
                          return (
                            item.type.toLowerCase().includes(searchLower) ||
                            item.display.main.toLowerCase().includes(searchLower) ||
                            item.display.sub1.toLowerCase().includes(searchLower) ||
                            item.display.sub2.toLowerCase().includes(searchLower)
                          );
                        })
                        .filter(item => {
                          if (typeFilter === "all") return true;
                          return item.type === typeFilter;
                        })
                        .filter(item => {
                          if (!fromDate && !toDate) return true;
                          const itemDate = item.display.date ? new Date(item.display.date) : null;
                          if (!itemDate) return false;
                          
                          if (fromDate && itemDate < new Date(fromDate)) return false;
                          if (toDate && itemDate > new Date(toDate)) return false;
                          
                          return true;
                        })
                        .map((item, idx) => (
                          <tr key={idx} className="border-t hover:bg-gray-50">
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${item.typeColor}`}>
                                {item.type}
                              </span>
                            </td>
                            <td className="p-3 font-semibold">{item.display.main}</td>
                            <td className="p-3">{item.display.sub1}</td>
                            <td className="p-3">{item.display.sub2}</td>
                            <td className="p-3">{item.display.quantity !== undefined ? item.display.quantity : '-'}</td>
                            <td className="p-3">
                              {item.display.date
                                ? formatCrmDateOnly(item.display.date)
                                : "-"}
                            </td>
                            <td className="p-3">
                              {(item.type === 'Invoice' || item.type === 'Quotation') && item.display.id ? (
                                <button
                                  onClick={() => window.open(
                                    item.type === 'Invoice'
                                      ? `/admin-dashboard/invoices/${encodeURIComponent(item.display.id)}`
                                      : `/admin-dashboard/quotations/${encodeURIComponent(item.display.id)}`,
                                    '_blank'
                                  )}
                                  className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                                >
                                  View
                                </button>
                              ) : (
                                <span className="text-gray-400 text-sm">-</span>
                              )}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <div className="text-6xl mb-4">📦</div>
              <div className="text-lg">Select a product from the sidebar to view details</div>
            </div>
          </div>
        )}
      </div>

      {/* Transfer Modal */}
      {showTransferModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-4 md:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-4">Transfer Stock</h3>
            <p className="text-sm text-gray-600 mb-4">
              Product: <span className="font-semibold">{selectedProduct.item_name}</span> ({selectedProduct.item_code})
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Godown</label>
                <select
                  value={fromGodown}
                  onChange={(e) => setFromGodown(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Godown</option>
                  <option value="Delhi">Delhi Godown</option>
                  <option value="South">South Godown</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Godown</label>
                <select
                  value={toGodown}
                  onChange={(e) => setToGodown(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Godown</option>
                  <option value="Delhi">Delhi Godown</option>
                  <option value="South">South Godown</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  value={transferQuantity}
                  onChange={(e) => setTransferQuantity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter quantity"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleTransfer}
                disabled={transferring}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
              >
                {transferring ? "Transferring..." : "Transfer"}
              </button>
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setTransferQuantity("");
                  setFromGodown("");
                  setToGodown("");
                }}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-4 md:p-6 max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg md:text-xl font-bold text-gray-800">Transfer History</h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {transferHistory.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No transfer history found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border border-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-3 border-b text-left font-semibold">Date</th>
                      <th className="p-3 border-b text-left font-semibold">Quantity</th>
                      <th className="p-3 border-b text-left font-semibold">Godown</th>
                      <th className="p-3 border-b text-left font-semibold">Note</th>
                      <th className="p-3 border-b text-left font-semibold">Added By</th>
                      <th className="p-3 border-b text-left font-semibold">Total</th>
                      <th className="p-3 border-b text-left font-semibold">Delhi</th>
                      <th className="p-3 border-b text-left font-semibold">South</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transferHistory.map((history, idx) => (
                      <tr key={idx} className="border-t hover:bg-gray-50">
                        <td className="p-3">
                          {history.added_date
                            ? new Date(history.added_date).toLocaleString()
                            : "-"}
                        </td>
                        <td className="p-3 font-semibold">{history.quantity || 0}</td>
                        <td className="p-3">{history.godown || "-"}</td>
                        <td className="p-3">{history.note || "-"}</td>
                        <td className="p-3">{history.added_by || "-"}</td>
                        <td className="p-3">{history.total || 0}</td>
                        <td className="p-3">{history.delhi || 0}</td>
                        <td className="p-3">{history.south || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-full px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
