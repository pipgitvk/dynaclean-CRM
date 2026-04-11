"use client";

import { useState, useEffect } from "react";
import dayjs from "dayjs";

function formatInr(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ItemWiseSalesPage() {
  const [from, setFrom] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().endOf("month").format("YYYY-MM-DD"));
  const [employee, setEmployee] = useState("");
  const [employees, setEmployees] = useState([]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/empcrm/employees");
        const json = await res.json();
        if (json.success && Array.isArray(json.employees)) {
          setEmployees(json.employees);
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/item-wise-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, employee: employee || undefined }),
      });
      if (res.ok) {
        const result = await res.json();
        setData(Array.isArray(result) ? result : []);
      } else {
        console.error("Failed to fetch data");
        setData([]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setData([]);
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

  const totalWithoutGst = data.reduce(
    (acc, curr) => acc + (parseFloat(curr.amount_without_gst) || 0),
    0,
  );
  const totalSale = data.reduce((acc, curr) => acc + (parseFloat(curr.total_sale_amount) || 0), 0);
  const totalProfit = data.reduce((acc, curr) => acc + (parseFloat(curr.profit_loss) || 0), 0);
  const totalQty = data.reduce((acc, curr) => acc + (parseInt(curr.qty, 10) || 0), 0);
  const profitMargin = totalSale > 0 ? (totalProfit / totalSale) * 100 : 0;

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-8 space-y-8 bg-gray-50 min-h-screen">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Item Wise Sale Report</h1>
          <p className="text-sm text-gray-500 mt-1">
            Line items with taxable amount, payment status, and profitability
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500">Total amount (without GST)</p>
          <p className="text-xl font-bold text-gray-900 mt-1">₹{formatInr(totalWithoutGst)}</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500">Total revenue</p>
          <p className="text-xl font-bold text-gray-900 mt-1">₹{formatInr(totalSale)}</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500">Total profit</p>
          <p className={`text-xl font-bold mt-1 ${totalProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            ₹{formatInr(totalProfit)}
          </p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500">Profit margin</p>
          <p className={`text-xl font-bold mt-1 ${profitMargin >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {profitMargin.toFixed(2)}%
          </p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500">Total quantity</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{totalQty}</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap gap-4 items-end bg-white p-6 rounded-xl shadow-sm border border-gray-100"
      >
        <div className="flex-1 min-w-[160px]">
          <label className="text-sm font-medium block mb-2 text-gray-700">From date</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
          />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="text-sm font-medium block mb-2 text-gray-700">To date</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium block mb-2 text-gray-700">Employee</label>
          <select
            value={employee}
            onChange={(e) => setEmployee(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors bg-white"
          >
            <option value="">All employees</option>
            {employees.map((empRow) => (
              <option key={empRow.username} value={empRow.username}>
                {empRow.username}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          Apply filters
        </button>
      </form>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          <div className="hidden lg:block overflow-hidden rounded-xl shadow-sm border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer ID
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lead source
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order date
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Model
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amt (w/o GST)
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Financials
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      P/L
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.length > 0 ? (
                    data.map((row, index) => (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-3 whitespace-nowrap text-gray-900">
                          {row.customer_id != null ? row.customer_id : "—"}
                        </td>
                        <td className="px-3 py-3 text-gray-700 max-w-[120px] truncate" title={row.lead_source}>
                          {row.lead_source || "—"}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-gray-600">
                          {row.order_date ? dayjs(row.order_date).format("DD MMM YYYY") : "—"}
                        </td>
                        <td className="px-3 py-3 text-gray-900 max-w-[140px]">
                          <span className="line-clamp-2" title={row.model}>
                            {row.model || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-right text-gray-900">
                          ₹{formatInr(row.amount_without_gst)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-gray-700 capitalize">
                          {row.payment_status || "—"}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-gray-600 max-w-[100px] truncate" title={row.employee_name}>
                          {row.employee_name || "—"}
                        </td>
                        <td className="px-3 py-3 text-gray-900 min-w-[160px]">
                          <div className="font-medium">{row.customer_name || "—"}</div>
                          <div className="text-gray-500 text-xs">{row.company_name || ""}</div>
                          <div className="text-gray-400 text-xs mt-0.5">Rep: {row.employee_name || "—"}</div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-right">
                          <div className="text-gray-900">Qty: {row.qty ?? "—"}</div>
                          <div className="text-gray-900">Sale: ₹{formatInr(row.sale_price)}</div>
                          <div className="text-gray-500 text-xs">Buy: ₹{formatInr(row.purchase_price)}</div>
                          <div className="text-gray-400 text-xs">Tax: ₹{formatInr(row.tax)}</div>
                        </td>
                        <td
                          className={`px-3 py-3 whitespace-nowrap text-right font-semibold ${
                            row.profit_loss >= 0 ? "text-emerald-600" : "text-red-600"
                          }`}
                        >
                          ₹{formatInr(row.profit_loss)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="10" className="px-6 py-12 text-center text-gray-500">
                        No sales records found for the selected period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* md: simplified table without horizontal scroll nightmare */}
          <div className="hidden sm:block lg:hidden overflow-hidden rounded-xl shadow-sm border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium text-gray-500">Order</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-500">Details</th>
                    <th className="px-2 py-2 text-right font-medium text-gray-500">Fin.</th>
                    <th className="px-2 py-2 text-right font-medium text-gray-500">P/L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.length > 0 ? (
                    data.map((row, index) => (
                      <tr key={index}>
                        <td className="px-2 py-2 align-top whitespace-nowrap">
                          {row.order_date ? dayjs(row.order_date).format("DD MMM YY") : "—"}
                        </td>
                        <td className="px-2 py-2 align-top">
                          <div className="font-medium">{row.customer_name}</div>
                          <div className="text-gray-500">{row.model}</div>
                          <div className="text-gray-400 mt-0.5">ID {row.customer_id ?? "—"} · {row.payment_status}</div>
                        </td>
                        <td className="px-2 py-2 align-top text-right">
                          <div>₹{formatInr(row.amount_without_gst)}</div>
                          <div className="text-gray-500">Tax ₹{formatInr(row.tax)}</div>
                        </td>
                        <td
                          className={`px-2 py-2 align-top text-right font-semibold ${
                            row.profit_loss >= 0 ? "text-emerald-600" : "text-red-600"
                          }`}
                        >
                          ₹{formatInr(row.profit_loss)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                        No records
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="sm:hidden space-y-4">
            {data.length > 0 ? (
              data.map((row, index) => (
                <div key={index} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-3">
                  <div className="flex justify-between gap-2">
                    <span className="text-xs text-gray-500">
                      {row.order_date ? dayjs(row.order_date).format("DD MMM YYYY") : "—"}
                    </span>
                    <span className="text-xs font-medium text-gray-700 capitalize">
                      {row.payment_status || "—"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-900">
                    <span className="text-gray-500">Customer ID:</span>{" "}
                    {row.customer_id != null ? row.customer_id : "—"}
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="text-gray-500">Lead source:</span> {row.lead_source || "—"}
                  </p>
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Details</p>
                    <p className="text-sm font-medium text-gray-900">{row.customer_name || "—"}</p>
                    <p className="text-xs text-gray-500">{row.company_name}</p>
                    <p className="text-xs text-gray-400 mt-1">Rep: {row.employee_name || "—"}</p>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{row.model || "—"}</p>
                  <p className="text-sm text-gray-600">{row.employee_name || "—"}</p>
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Financials</p>
                    <p className="text-sm">
                      Qty {row.qty ?? "—"} · Sale ₹{formatInr(row.sale_price)} · Buy ₹{formatInr(row.purchase_price)}
                    </p>
                    <p className="text-xs text-gray-500">Tax ₹{formatInr(row.tax)}</p>
                    <p className="text-base font-semibold text-gray-900 mt-1">
                      Amt (w/o GST) ₹{formatInr(row.amount_without_gst)}
                    </p>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <span className="text-xs font-semibold text-gray-500 uppercase">P/L</span>
                    <span
                      className={`text-lg font-bold ${row.profit_loss >= 0 ? "text-emerald-600" : "text-red-600"}`}
                    >
                      ₹{formatInr(row.profit_loss)}
                    </span>
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
