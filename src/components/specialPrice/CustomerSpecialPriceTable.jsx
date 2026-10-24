"use client";

import { formatCrmDateOnly } from "@/lib/crmDateFormat";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ApprovedPriceListPdfButton from "@/components/specialPrice/ApprovedPriceListPdfButton";

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All status" },
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Rejected" },
];

function rowKey(row) {
  return String(row.product_id);
}

function normalizeRowStatus(row) {
  const s = String(row?.status ?? "").trim().toLowerCase();
  if (s === "approved") return "approved";
  if (s === "rejected") return "rejected";
  return "pending";
}

export default function CustomerSpecialPriceTable({
  customerId,
  customerName,
  rows = [],
  initialStatusFilter = "",
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(
    () => searchParams.get("status") || initialStatusFilter || "",
  );
  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => {
    const fromUrl = searchParams.get("status") || "";
    setStatusFilter(fromUrl);
  }, [searchParams]);

  const filteredRows = useMemo(() => {
    if (!statusFilter) return rows;
    return rows.filter((r) => normalizeRowStatus(r) === statusFilter);
  }, [rows, statusFilter]);

  const allSelected =
    filteredRows.length > 0 &&
    filteredRows.every((r) => selected.has(rowKey(r)));

  const selectedRows = useMemo(
    () => filteredRows.filter((r) => selected.has(rowKey(r))),
    [filteredRows, selected],
  );

  const handleStatusFilterChange = (value) => {
    setStatusFilter(value);
    setSelected(new Set());
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (value) params.set("status", value);
    else params.delete("status");
    const query = params.toString();
    router.replace(
      query
        ? `/admin-dashboard/special-pricing/${customerId}?${query}`
        : `/admin-dashboard/special-pricing/${customerId}`,
      { scroll: false },
    );
  };

  const toggleRow = (row) => {
    const key = rowKey(row);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(filteredRows.map((r) => rowKey(r))));
  };

  if (rows.length === 0) {
    return (
      <div className="bg-gray-100 p-4 rounded">No special prices available.</div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
        <div className="min-w-[140px]">
          <label className="block text-xs text-gray-600 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className="w-full sm:w-44 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-gray-500 sm:pb-2">
          Showing {filteredRows.length} of {rows.length}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
        <label
          className={`inline-flex items-center gap-2 text-sm ${
            filteredRows.length === 0 ? "opacity-50" : "cursor-pointer"
          }`}
        >
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-400 text-blue-600 accent-blue-600"
            checked={allSelected}
            onChange={toggleSelectAll}
            disabled={filteredRows.length === 0}
          />
          {statusFilter ? "Select all shown" : "Select all"}
        </label>
        <span className="text-sm text-gray-500">
          {selectedRows.length} selected
        </span>
        <ApprovedPriceListPdfButton
          customerId={customerId}
          customerName={customerName}
          selectedRows={selectedRows}
          buttonLabel={
            selectedRows.length > 0
              ? `Download PDF (${selectedRows.length})`
              : "Download selected PDF"
          }
          disabled={selectedRows.length === 0}
        />
      </div>

      {filteredRows.length === 0 ? (
        <div className="bg-gray-100 p-4 rounded text-sm text-gray-600">
          No special prices match this status filter.
        </div>
      ) : (
      <div className="overflow-x-auto">
        <table className="w-full border border-gray-200 rounded-lg">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-center w-12">
                <span className="sr-only">Select</span>
              </th>
              <th className="p-3 text-left">Image</th>
              <th className="p-3 text-left">Code</th>
              <th className="p-3 text-left">Product</th>
              <th className="p-3 text-left">Product No</th>
              <th className="p-3 text-right">Original Price</th>
              <th className="p-3 text-right">Special Price</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-left">Set By</th>
              <th className="p-3 text-left">Set Date</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.map((row) => {
              const imageUrl = row.image_path || row.product_image || null;
              const key = rowKey(row);
              const status = normalizeRowStatus(row);
              const isApproved = status === "approved";
              const isRejected = status === "rejected";
              const badgeClass = isApproved
                ? "bg-green-100 text-green-700"
                : isRejected
                  ? "bg-red-100 text-red-700"
                  : "bg-yellow-100 text-yellow-700";
              const label = isApproved
                ? "approved"
                : isRejected
                  ? "rejected"
                  : "pending";

              return (
                <tr key={key} className="hover:bg-gray-50">
                  <td className="p-3 text-center align-middle">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-400 text-blue-600 accent-blue-600"
                      checked={selected.has(key)}
                      onChange={() => toggleRow(row)}
                      aria-label={`Select ${row.item_name || row.item_code}`}
                    />
                  </td>
                  <td className="p-3">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl}
                        alt={row.item_name || "Product"}
                        className="w-10 h-10 object-cover rounded"
                      />
                    ) : (
                      <span className="text-gray-400 text-xs">No image</span>
                    )}
                  </td>
                  <td className="p-3 text-sm text-gray-700">
                    {row.item_code || "-"}
                  </td>
                  <td className="p-3">{row.item_name}</td>
                  <td className="p-3 text-sm text-gray-700">
                    {row.product_number || "-"}
                  </td>
                  <td className="p-3 text-right text-gray-500">
                    ₹ {row.price_per_unit}
                  </td>
                  <td className="p-3 text-right font-semibold text-green-600">
                    ₹ {row.special_price}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-3 py-1 text-xs rounded-full capitalize ${badgeClass}`}
                    >
                      {label}
                    </span>
                  </td>
                  <td className="p-3">{row.set_by_name || row.set_by}</td>
                  <td className="p-3 text-sm text-gray-500">
                    {row.set_date
                      ? formatCrmDateOnly(row.set_date)
                      : "—"}
                  </td>
                  <td className="p-3 text-center">
                    <Link
                      href={`/admin-dashboard/special-pricing/${customerId}/${row.product_id}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
