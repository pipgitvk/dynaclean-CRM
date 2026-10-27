"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import dayjs from "dayjs";
import { useState } from "react";
import { Eye, Search, RotateCcw, ChevronUp, ChevronDown, Inbox, X, Calendar, Package, Edit } from "lucide-react";

export default function DeliveryChallanTable({ rows }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const filteredRows = rows.filter((row) => {
    const matchesSearch =
      !searchQuery ||
      Object.values(row)
        .join(" ")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (fromDate || toDate) {
      const rowDate = row.created_at ? dayjs(row.created_at).format("YYYY-MM-DD") : null;
      if (!rowDate) return false;
      if (fromDate && rowDate < fromDate) return false;
      if (toDate && rowDate > toDate) return false;
    }
    return true;
  });

  const handleSort = (key) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  };

  const sortedRows = [...filteredRows].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const dir = sortConfig.direction === "asc" ? 1 : -1;
    const key = sortConfig.key;

    const getVal = (row) => {
      switch (key) {
        case "id":
          return Number(row.id || 0);
        case "delivery_challan_for":
          return (row.delivery_challan_for || "").toLowerCase();
        case "ship_to":
          return (row.ship_to || "").toLowerCase();
        case "product_code":
          return (row.product_code || "").toLowerCase();
        case "product_name":
          return (row.product_name || "").toLowerCase();
        case "challan_no":
          return (row.challan_no || "").toLowerCase();
        case "delivery_date":
          return row.delivery_date ? dayjs(row.delivery_date).valueOf() : 0;
        case "challan_date":
          return row.challan_date ? dayjs(row.challan_date).valueOf() : 0;
        case "created_at":
          return row.created_at ? dayjs(row.created_at).valueOf() : 0;
        default:
          return 0;
      }
    };

    const va = getVal(a);
    const vb = getVal(b);
    if (typeof va === "string" || typeof vb === "string") {
      return va.localeCompare(vb) * dir;
    }
    return (va - vb) * dir;
  });

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return null;
    return sortConfig.direction === "asc" ? <ChevronUp className="inline w-4 h-4 ml-0.5" /> : <ChevronDown className="inline w-4 h-4 ml-0.5" />;
  };

  const handleReset = () => {
    setSearchQuery("");
    setFromDate("");
    setToDate("");
  };

  const renderRow = (row) => (
    <tr
      key={row.id}
      className="hover:bg-blue-50/50 transition-colors duration-150 border-b border-gray-100 last:border-0"
    >
      <td className="p-3 font-medium text-gray-600">{row.id}</td>
      <td className="p-3">{row.delivery_challan_for}</td>
      <td className="p-3 font-medium text-gray-800">{row.ship_to}</td>
      <td className="p-3">
        <div className="text-sm">
          {row.products && row.products.length > 0 ? (
            row.products.map((p, i) => (
              <div key={i} className="mb-1">
                <span className="font-medium">{p.code || "-"}</span>
                <span className="text-gray-500 ml-1">({p.qty || 1})</span>
              </div>
            ))
          ) : (
            "-"
          )}
        </div>
      </td>
      <td className="p-3 text-gray-600">
        {row.products && row.products.length > 0
          ? row.products.reduce((sum, p) => sum + (parseInt(p.qty) || 0), 0)
          : 0}
      </td>
      <td className="p-3 text-gray-600">{row.challan_no || "-"}</td>
      <td className="p-3 text-gray-600">{row.challan_date ? dayjs(row.challan_date).format("DD MMM YYYY") : "-"}</td>
      <td className="p-3 text-gray-600">{row.created_at ? dayjs(row.created_at).format("DD MMM YYYY") : "-"}</td>
      <td className="p-3">
        <div className="flex gap-1.5 items-center">
          <Link href={`/admin-dashboard/delivery-challan/${row.id}/edit`} className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700 transition-colors" title="Edit">
            <Edit size={16} />
          </Link>
          <Link href={`/admin-dashboard/delivery-challan/${row.id}`} className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition-colors" title="View">
            <Eye size={16} />
          </Link>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 shadow-sm hover:shadow transition-all w-full sm:w-auto"
            >
              <RotateCcw size={16} />
              Refresh
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full">
            <div className="relative w-full sm:w-[300px] sm:min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search anything..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="flex-1 min-w-0 w-full sm:w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
              <span className="text-gray-400 shrink-0">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="flex-1 min-w-0 w-full sm:w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
            </div>
            <button
              onClick={handleReset}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors w-full sm:w-auto shrink-0"
            >
              <X size={14} />
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="hidden lg:block bg-white shadow-lg rounded-xl border border-gray-200">
        <table className="w-full table-auto text-sm">
          <thead className="bg-gradient-to-r from-slate-700 to-slate-800 sticky top-0 z-10">
            <tr className="text-left font-medium text-white">
              <th onClick={() => handleSort("id")} className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors rounded-tl-xl">ID<SortIcon column="id" /></th>
              <th onClick={() => handleSort("delivery_challan_for")} className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors">Delivery Challan For<SortIcon column="delivery_challan_for" /></th>
              <th onClick={() => handleSort("ship_to")} className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors">Ship To<SortIcon column="ship_to" /></th>
              <th onClick={() => handleSort("product_code")} className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors">Product<SortIcon column="product_code" /></th>
              <th onClick={() => handleSort("product_quantity")} className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors">Qty<SortIcon column="product_quantity" /></th>
              <th onClick={() => handleSort("challan_no")} className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors">Challan No<SortIcon column="challan_no" /></th>
              <th onClick={() => handleSort("challan_date")} className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors">Challan Date<SortIcon column="challan_date" /></th>
              <th onClick={() => handleSort("created_at")} className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors">Created<SortIcon column="created_at" /></th>
              <th className="p-3 rounded-tr-xl">Action</th>
            </tr>
          </thead>
          <tbody className="text-gray-800 bg-white">
            {sortedRows.length > 0 ? (
              <>
                {sortedRows.map((row) => renderRow(row))}
              </>
            ) : (
              <tr>
                <td colSpan="9" className="p-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Inbox className="w-12 h-12 text-gray-300" />
                    <span className="font-medium">No delivery challans found.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="lg:hidden flex flex-col gap-4">
        {sortedRows.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-gray-500">
            <Inbox className="w-12 h-12 text-gray-300" />
            <span className="font-medium">No delivery challans found.</span>
          </div>
        )}
        {sortedRows.map((row) => (
          <div key={row.id} className="border border-gray-200 rounded-xl p-4 shadow-md bg-white text-sm space-y-2 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start gap-2">
              <div>
                <span className="text-xs font-medium text-gray-500">ID {row.id}</span>
                <div className="font-semibold text-gray-800 mt-0.5">{row.delivery_challan_for}</div>
              </div>
            </div>
            <div>
              <div className="font-medium text-gray-700 mb-1">Products:</div>
              {row.products && row.products.length > 0 ? (
                row.products.map((p, i) => (
                  <div key={i} className="text-gray-600 text-xs ml-2">
                    {p.code || "-"} (Qty: {p.qty || 1})
                  </div>
                ))
              ) : (
                <div className="text-gray-500 text-xs ml-2">-</div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600">
              <div><span className="text-gray-500">Ship To:</span> {row.ship_to}</div>
              <div><span className="text-gray-500">Total Qty:</span> {row.products && row.products.length > 0
          ? row.products.reduce((sum, p) => sum + (parseInt(p.qty) || 0), 0)
          : 0}</div>
              <div><span className="text-gray-500">Challan No:</span> {row.challan_no || "-"}</div>
              <div><span className="text-gray-500">Challan Date:</span> {row.challan_date ? dayjs(row.challan_date).format("DD MMM YYYY") : "-"}</div>
              <div className="col-span-2"><span className="text-gray-500">Created:</span> {row.created_at ? dayjs(row.created_at).format("DD MMM YYYY") : "-"}</div>
            </div>
            <div className="pt-3 border-t border-gray-100 flex justify-end items-center">
              <div className="flex gap-1.5">
                <Link href={`/admin-dashboard/delivery-challan/${row.id}/edit`} className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100" title="Edit"><Edit size={16} /></Link>
                <Link href={`/admin-dashboard/delivery-challan/${row.id}`} className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100" title="View"><Eye size={16} /></Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
