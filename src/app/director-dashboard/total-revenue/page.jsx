"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Search, TrendingDown, IndianRupee } from "lucide-react";
import { useRouter } from "next/navigation";

export default function TotalRevenuePage() {
  const router = useRouter();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewType, setViewType] = useState("purchase");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    fetchData();
  }, [viewType, fromDate, toDate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const apiUrl = viewType === "purchase" ? "/api/stock-request" : "/api/sales";
      const url = new URL(apiUrl, window.location.origin);
      if (fromDate) url.searchParams.append("fromDate", fromDate);
      if (toDate) url.searchParams.append("toDate", toDate);
      
      const response = await fetch(url.toString());
      const result = await response.json();
      console.log(`${viewType} data:`, result);
      if (result.length > 0) {
        console.log("First item:", result[0]);
        console.log("First item fields:", Object.keys(result[0]));
      }
      setData(result);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = data.filter((item) =>
    (item.product_name || item.specification || item.product_code || "")?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totals = filteredData.reduce(
    (acc, item) => ({
      totalPurchase: acc.totalPurchase + Number(item.net_amount || 0),
      totalQty: acc.totalQty + Number(item.quantity || 0),
    }),
    { totalPurchase: 0, totalQty: 0 }
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Total Revenue</h1>
              <p className="text-slate-500 text-sm mt-1">{viewType === "purchase" ? "Purchase data analysis" : "Sales data analysis"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewType("purchase")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewType === "purchase"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Purchase
            </button>
            <button
              onClick={() => setViewType("sales")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewType === "sales"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Sales
            </button>
          </div>
        </div>

        {/* Date Filters */}
        <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600">From Date:</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600">To Date:</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {(fromDate || toDate) && (
            <button
              onClick={() => { setFromDate(""); setToDate(""); }}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">Total Quantity</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{totals.totalQty}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <IndianRupee size={20} className="text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">{viewType === "purchase" ? "Total Purchase" : "Total Revenue"}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  ₹{totals.totalPurchase.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <TrendingDown size={20} className="text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search by item name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Item</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">{viewType === "purchase" ? "Purchase Price" : "Sales Price"}</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Qty</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Net Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                      Loading...
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                      No data found
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, index) => (
                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{item.product_name || item.specification || item.product_code || "-"}</td>
                      <td className="px-6 py-4 text-sm text-right text-slate-600">
                        ₹{Number(item.price_per_unit || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-slate-600">{Number(item.quantity || 0)}</td>
                      <td className="px-6 py-4 text-sm text-right text-slate-600">
                        ₹{Number(item.net_amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {!loading && filteredData.length > 0 && (
                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                  <tr>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">TOTAL</td>
                    <td className="px-6 py-4"></td>
                    <td className="px-6 py-4 text-sm text-right font-bold text-slate-900">{totals.totalQty}</td>
                    <td className="px-6 py-4 text-sm text-right font-bold text-slate-900">
                      ₹{totals.totalPurchase.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}