"use client";

import { formatCrmDateOnly } from "@/lib/crmDateFormat";

import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  INVENTORY_SIDEBAR_SORT_OPTIONS,
  sortInventorySidebarRows,
} from "@/lib/inventorySidebarSort";
import { Search } from "lucide-react";
import Link from "next/link";
import InventoryPriceEditMenu from "@/components/inventory/InventoryPriceEditMenu";

async function fetchJson(url, { timeoutMs = 120_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return await res.json().catch(() => null);
  } finally {
    clearTimeout(timer);
  }
}

function asArray(data) {
  return Array.isArray(data) ? data : [];
}

function typeColor(type) {
  switch (type) {
    case "Purchase":
      return "bg-green-100 text-green-800";
    case "Sale":
      return "bg-red-100 text-red-800";
    case "Order":
      return "bg-cyan-100 text-cyan-800";
    case "Transfer":
      return "bg-yellow-100 text-yellow-800";
    case "Invoice":
      return "bg-purple-100 text-purple-800";
    case "Quotation":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export default function SparesNewContent() {
  const [spares, setSpares] = useState([]);
  const [search, setSearch] = useState("");
  const [sidebarSort, setSidebarSort] = useState("min_qty_desc");
  const [selectedSpare, setSelectedSpare] = useState(null);
  const [loading, setLoading] = useState(true);
  const [listLoadError, setListLoadError] = useState("");
  const [listReloadKey, setListReloadKey] = useState(0);
  const [availableStock, setAvailableStock] = useState([]);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [combinedSearch, setCombinedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setListLoadError("");
      try {
        const listJson = await fetchJson("/api/spare/list", {
          timeoutMs: 90_000,
        });
        if (!cancelled) {
          if (listJson?.error) {
            setSpares([]);
            setListLoadError(listJson.error);
          } else {
            setSpares(asArray(listJson));
          }
        }
      } catch (err) {
        console.error("Spares list load error:", err);
        if (!cancelled) {
          setSpares([]);
          setListLoadError(
            err?.name === "AbortError"
              ? "Request timed out. Try Retry or refresh the page."
              : "Could not load spares list."
          );
        }
      } finally {
        setLoading(false);
      }
    })();

    (async () => {
      try {
        const stockJson = await fetchJson("/api/spare/available-stock");
        if (!cancelled) setAvailableStock(asArray(stockJson));
      } catch (err) {
        console.error("Spare stock load error:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [listReloadKey]);

  useEffect(() => {
    if (!selectedSpare?.id) {
      setHistoryRows([]);
      setHistoryError("");
      return;
    }

    let cancelled = false;
    (async () => {
      setHistoryLoading(true);
      setHistoryError("");
      try {
        const data = await fetchJson(
          `/api/spare/item-history?spare_id=${encodeURIComponent(selectedSpare.id)}`
        );
        if (cancelled) return;
        if (data?.error) {
          setHistoryRows([]);
          setHistoryError(data.error);
          return;
        }
        setHistoryRows(asArray(data?.rows));
      } catch (err) {
        console.error("Spare history load error:", err);
        if (!cancelled) {
          setHistoryRows([]);
          setHistoryError("Failed to load history");
        }
      } finally {
        setHistoryLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedSpare?.id]);

  const getAvailableQty = useCallback(
    (spare) => {
      if (!spare) return { total: 0, delhi: 0, south: 0 };
      const row = availableStock.find(
        (s) => Number(s.spare_id) === Number(spare.id)
      );
      if (!row) {
        const t = Number(spare.total_qty) || 0;
        return { total: t, delhi: 0, south: 0 };
      }
      return {
        total: (Number(row.delhi) || 0) + (Number(row.south) || 0),
        delhi: Number(row.delhi) || 0,
        south: Number(row.south) || 0,
      };
    },
    [availableStock]
  );

  const getPurchaseNetAmount = useCallback(
    (spare) => {
      if (!spare) return 0;
      const purch = historyRows.find((r) => r.type === "Purchase" && r.amount);
      if (purch?.amount) {
        const qty = Number(purch.quantity) || 1;
        const amt = Number(purch.amount) || 0;
        return qty > 1 ? amt / qty : amt;
      }
      return Number(spare.purchase_price) || 0;
    },
    [historyRows]
  );

  const getSalesNetAmount = useCallback(
    (spare) => {
      if (!spare) return 0;
      const sale = historyRows.find(
        (r) => (r.type === "Sale" || r.type === "Order") && r.amount
      );
      if (sale?.amount) {
        const qty = Number(sale.quantity) || 1;
        const amt = Number(sale.amount) || 0;
        return qty > 1 ? amt / qty : amt;
      }
      return Number(spare.sale_price) || 0;
    },
    [historyRows]
  );

  const handleSparePricesSaved = useCallback((updated) => {
    if (!updated?.id) return;
    setSpares((prev) =>
      prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)),
    );
    setSelectedSpare((prev) =>
      prev?.id === updated.id ? { ...prev, ...updated } : prev,
    );
  }, []);

  const filteredSpares = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = spares.filter((s) => {
      return (
        String(s.spare_number ?? "").toLowerCase().includes(q) ||
        String(s.item_name ?? "").toLowerCase().includes(q) ||
        String(s.specification ?? "").toLowerCase().includes(q) ||
        String(s.make ?? "").toLowerCase().includes(q) ||
        String(s.model ?? "").toLowerCase().includes(q)
      );
    });
    return sortInventorySidebarRows(filtered, sidebarSort);
  }, [spares, search, sidebarSort]);

  const filteredCombined = useMemo(() => {
    return historyRows
      .filter((item) => {
        if (!combinedSearch) return true;
        const s = combinedSearch.toLowerCase();
        return (
          item.type.toLowerCase().includes(s) ||
          String(item.ref || "").toLowerCase().includes(s) ||
          String(item.name || "").toLowerCase().includes(s)
        );
      })
      .filter((item) => typeFilter === "all" || item.type === typeFilter)
      .filter((item) => {
        if (!fromDate && !toDate) return true;
        const itemDate = item.date ? new Date(item.date) : null;
        if (!itemDate) return false;
        if (fromDate && itemDate < new Date(fromDate)) return false;
        if (toDate && itemDate > new Date(toDate)) return false;
        return true;
      });
  }, [historyRows, combinedSearch, typeFilter, fromDate, toDate]);

  const getStockColor = (spareNumber) => {
    const colors = [
      "bg-blue-100 text-blue-800",
      "bg-green-100 text-green-800",
      "bg-purple-100 text-purple-800",
      "bg-orange-100 text-orange-800",
      "bg-pink-100 text-pink-800",
      "bg-yellow-100 text-yellow-800",
      "bg-red-100 text-red-800",
      "bg-indigo-100 text-indigo-800",
    ];
    const key = String(spareNumber ?? "");
    const index =
      key.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) %
      colors.length;
    return colors[index];
  };

  return (
    <div className="flex h-full flex-col bg-gray-50 md:flex-row">
      <div className="w-full md:w-80 bg-white border-b md:border-b-0 md:border-r border-gray-200 flex flex-col md:h-full h-64">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-800">Spares List</h2>
            <Link
              href="/admin-dashboard/add-spare"
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              + Add New
            </Link>
          </div>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search spares..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <select
            value={sidebarSort}
            onChange={(e) => setSidebarSort(e.target.value)}
            className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            aria-label="Sort spares list"
          >
            {INVENTORY_SIDEBAR_SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Sort: {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Loading spares…</div>
          ) : listLoadError ? (
            <div className="p-4 text-center space-y-2">
              <p className="text-sm text-red-600">{listLoadError}</p>
              <button
                type="button"
                onClick={() => setListReloadKey((k) => k + 1)}
                className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          ) : filteredSpares.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No spares found</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredSpares.map((spare) => {
                const qty = getAvailableQty(spare);
                return (
                  <div
                    key={spare.id}
                    onClick={() => setSelectedSpare(spare)}
                    className={`p-4 cursor-pointer hover:bg-blue-50 transition-colors flex items-center justify-between ${
                      selectedSpare?.id === spare.id
                        ? "bg-blue-100 border-l-4 border-blue-500"
                        : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-800 text-sm truncate">
                        {spare.item_name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        #{spare.spare_number ?? spare.id}
                      </div>
                      <div className="text-xs text-gray-400 mt-1 truncate">
                        {spare.type || spare.make || "—"}
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-2 flex items-center gap-1">
                      <InventoryPriceEditMenu
                        kind="spare"
                        row={spare}
                        onSaved={handleSparePricesSaved}
                      />
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${getStockColor(spare.spare_number)}`}
                      >
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

      <div className="flex-1 p-4 md:p-6 overflow-y-auto">
        {selectedSpare ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 max-w-4xl">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-4">
                <h3 className="text-base font-semibold text-gray-800 mb-3">
                  Prices
                </h3>
                <div className="space-y-3 text-sm">
                  <p className="text-gray-500">
                    Purchase Price:{" "}
                    <span className="text-lg font-bold text-gray-900">
                      ₹
                      {getPurchaseNetAmount(selectedSpare).toLocaleString(
                        "en-IN",
                        { maximumFractionDigits: 0 }
                      )}
                    </span>
                  </p>
                  <p className="text-gray-500">
                    Sales Price:{" "}
                    <span className="text-lg font-bold text-gray-900">
                      ₹
                      {getSalesNetAmount(selectedSpare).toLocaleString("en-IN", {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-4">
                <h3 className="text-base font-semibold text-gray-800 mb-3">
                  Stock
                </h3>
                <div className="space-y-2 text-sm">
                  <p>
                    Total:{" "}
                    <span className="font-bold">
                      {getAvailableQty(selectedSpare).total}
                    </span>
                    <span className="text-gray-500 ml-2">
                      (Delhi {getAvailableQty(selectedSpare).delhi} · South{" "}
                      {getAvailableQty(selectedSpare).south})
                    </span>
                  </p>
                  <p>
                    Stock value:{" "}
                    <span className="font-bold">
                      ₹
                      {(
                        getAvailableQty(selectedSpare).total *
                        getPurchaseNetAmount(selectedSpare)
                      ).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 mb-6 max-w-4xl">
              <h3 className="text-base font-semibold text-gray-800 mb-4">
                Spare Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 font-medium">Spare Number</p>
                  <p className="font-semibold">
                    {selectedSpare.spare_number ?? selectedSpare.id}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 font-medium">Name</p>
                  <p className="font-semibold">{selectedSpare.item_name}</p>
                </div>
                <div>
                  <p className="text-gray-600 font-medium">Type / Make</p>
                  <p className="font-semibold">
                    {[selectedSpare.type, selectedSpare.make]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 font-medium">Model</p>
                  <p className="font-semibold">{selectedSpare.model || "—"}</p>
                </div>
                <div>
                  <p className="text-gray-600 font-medium">GST / Tax</p>
                  <p className="font-semibold">{selectedSpare.tax ?? "—"}</p>
                </div>
                <div>
                  <p className="text-gray-600 font-medium">Min Qty</p>
                  <p className="font-semibold">{selectedSpare.min_qty ?? "0"}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-gray-600 font-medium">Specification</p>
                  <p className="font-semibold">
                    {selectedSpare.specification || "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
              {historyLoading ? (
                <p className="text-sm text-gray-500 mb-3">
                  Loading purchase, sales, orders, quotations…
                </p>
              ) : null}
              {historyError ? (
                <p className="text-sm text-red-600 mb-3">{historyError}</p>
              ) : null}

              <div className="mb-4 flex flex-col sm:flex-row gap-3 flex-wrap">
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
                  <option value="Order">Order</option>
                  <option value="Transfer">Transfer</option>
                  <option value="Invoice">Invoice</option>
                  <option value="Quotation">Quotation</option>
                </select>
                <TypeableDateFilterInput
                  value={fromDate}
                  onChange={setFromDate}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <TypeableDateFilterInput
                  value={toDate}
                  onChange={setToDate}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border border-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-3 border-b text-left font-semibold">Type</th>
                      <th className="p-3 border-b text-left font-semibold">
                        Invoice/Ref.No
                      </th>
                      <th className="p-3 border-b text-left font-semibold">Name</th>
                      <th className="p-3 border-b text-left font-semibold">
                        Price/Unit
                      </th>
                      <th className="p-3 border-b text-left font-semibold">
                        Quantity
                      </th>
                      <th className="p-3 border-b text-left font-semibold">Date</th>
                      <th className="p-3 border-b text-left font-semibold">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyLoading ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-gray-500">
                          Loading records…
                        </td>
                      </tr>
                    ) : filteredCombined.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-gray-500">
                          No records found for this spare
                        </td>
                      </tr>
                    ) : (
                      filteredCombined.map((item, idx) => (
                        <tr key={`${item.type}-${item.ref}-${idx}`} className="border-t hover:bg-gray-50">
                          <td className="p-3">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${typeColor(item.type)}`}
                            >
                              {item.type}
                            </span>
                          </td>
                          <td className="p-3 font-semibold">{item.ref}</td>
                          <td className="p-3">{item.name}</td>
                          <td className="p-3">
                            ₹{(Number(item.amount) || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="p-3">
                            {item.quantity !== undefined ? item.quantity : "—"}
                          </td>
                          <td className="p-3">
                            {item.date
                              ? formatCrmDateOnly(item.date)
                              : "—"}
                          </td>
                          <td className="p-3">
                            {item.link ? (
                              <button
                                type="button"
                                onClick={() => window.open(item.link, "_blank")}
                                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                              >
                                View
                              </button>
                            ) : (
                              <span className="text-gray-400 text-sm">—</span>
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
              <div className="text-6xl mb-4">🔧</div>
              <div className="text-lg">
                Select a spare from the sidebar to view details
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
