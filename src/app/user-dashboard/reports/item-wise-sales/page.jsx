"use client";

import { useState, useEffect } from "react";
import dayjs from "dayjs";

export default function ItemWiseSalesPage() {
  const [from, setFrom] = useState(dayjs().startOf('month').format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().endOf('month').format("YYYY-MM-DD"));
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/item-wise-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      if (res.ok) {
        const result = await res.json();
        setData(result);
      } else {
        console.error("Failed to fetch data");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    fetchData();
  };

  const totalSale = data.reduce((acc, curr) => acc + (parseFloat(curr.total_sale_amount) || 0), 0);
  const totalProfit = data.reduce((acc, curr) => acc + (parseFloat(curr.profit_loss) || 0), 0);
  const totalQty = data.reduce((acc, curr) => acc + (parseInt(curr.qty) || 0), 0);
  const profitMargin = totalSale > 0 ? (totalProfit / totalSale) * 100 : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 bg-gray-50 min-h-screen">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Item Wise Sale Report</h1>
          <p className="text-sm text-gray-500 mt-1">Detailed breakdown of sales performance and profitability</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500">Total Revenue</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">₹{totalSale.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500">Total Profit</p>
          <p className={`text-2xl font-bold mt-2 ${totalProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            ₹{totalProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500">Profit Margin</p>
          <p className={`text-2xl font-bold mt-2 ${profitMargin >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {profitMargin.toFixed(2)}%
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500">Total Quantity</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{totalQty}</p>
        </div>
      </div>

      {/* Filters */}
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium block mb-2 text-gray-700">From Date</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium block mb-2 text-gray-700">To Date</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          Apply Filters
        </button>
      </form>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-hidden rounded-xl shadow-sm border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product & Specification</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Financials</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">P/L</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.length > 0 ? (
                    data.map((row, index) => (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {dayjs(row.date).format("DD MMM YYYY")}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="font-medium">{row.customer_name}</div>
                          <div className="text-gray-500 text-xs">{row.company_name}</div>
                          <div className="text-gray-400 text-xs mt-1">Rep: {row.employee_name}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="font-medium">{row.product_name}</div>
                          <div className="text-gray-500 text-xs truncate max-w-xs" title={row.model}><span className="font-medium">Spec:</span> {row.model}</div>
                          <div className="text-gray-500 text-xs mt-1">Qty: {row.qty}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          <div className="text-gray-900">Sale: ₹{parseFloat(row.sale_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                          <div className="text-gray-500 text-xs">Buy: ₹{parseFloat(row.purchase_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                          <div className="text-gray-400 text-xs">Tax: ₹{parseFloat(row.tax).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-semibold ${row.profit_loss >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          ₹{parseFloat(row.profit_loss).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                        No sales records found for the selected period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="sm:hidden space-y-4">
            {data.length > 0 ? (
              data.map((row, index) => (
                <div key={index} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-gray-500">{dayjs(row.date).format("DD MMM YYYY")}</p>
                      <h3 className="font-medium text-gray-900">{row.customer_name}</h3>
                      <p className="text-xs text-gray-500">{row.company_name}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${row.profit_loss >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {row.profit_loss >= 0 ? "Profit" : "Loss"}
                    </span>
                  </div>
                  
                  <div className="pt-3 border-t border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{row.product_name}</p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{row.model}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Sale Price</p>
                      <p className="font-medium">₹{parseFloat(row.sale_price).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Profit/Loss</p>
                      <p className={`font-bold ${row.profit_loss >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        ₹{parseFloat(row.profit_loss).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-200">
                No sales records found.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
