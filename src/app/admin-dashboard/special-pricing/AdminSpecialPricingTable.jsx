"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useActionState } from "react";
import SpecialPriceDetailsModal from "@/components/specialPrice/SpecialPriceDetailsModal";
import SpecialPriceApproveRejectButtons from "@/components/specialPrice/SpecialPriceApproveRejectButtons";
import {
  canAutoApproveDealerPrice,
  dealerApprovalNoteForTerm,
  isDealerPricePending,
  resolveDealerPriceFromProductStock,
  resolveSpecialPriceTerm,
  resolveSpecialPriceType,
} from "@/lib/specialPriceDefaults";
import { bulkApproveSpecialPrices } from "./_actions";

function rowKey(row) {
  return `${row.item_type}-${row.id}`;
}

function isPendingRow(row) {
  const status = (row.status || "").toLowerCase();
  return status !== "approved" && status !== "rejected";
}

export default function AdminSpecialPricingTable({
  rows,
  currentPage,
  totalPages,
  searchQuery,
  statusFilter,
  typeFilter,
  priceTypeFilter,
  updateSpecialPrice,
  deleteSpecialPrice,
}) {
  const [selected, setSelected] = useState(() => new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkState, bulkAction, bulkPending] = useActionState(
    bulkApproveSpecialPrices,
    null,
  );

  const pendingOnPage = useMemo(
    () => rows.filter((r) => isPendingRow(r)),
    [rows],
  );

  const selectablePending = useMemo(
    () =>
      pendingOnPage.filter(
        (r) => !isDealerPricePending(r) || canAutoApproveDealerPrice(r),
      ),
    [pendingOnPage],
  );

  const allSelectableSelected =
    selectablePending.length > 0 &&
    selectablePending.every((r) => selected.has(rowKey(r)));

  const toggleRow = (row) => {
    const key = rowKey(row);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAllOnPage = () => {
    if (allSelectableSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(selectablePending.map((r) => rowKey(r))));
  };

  const selectedIds = useMemo(() => {
    const ids = [];
    for (const row of rows) {
      if (selected.has(rowKey(row))) ids.push(row.id);
    }
    return ids;
  }, [rows, selected]);

  const paginationQuery = (page) =>
    new URLSearchParams({
      ...(searchQuery && { search: searchQuery }),
      ...(statusFilter && { status: statusFilter }),
      ...(typeFilter && { type: typeFilter }),
      ...(priceTypeFilter && { priceType: priceTypeFilter }),
      page: String(page),
    }).toString();

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden min-w-0">
      {pendingOnPage.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b bg-gray-50 text-sm">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-gray-300"
              checked={allSelectableSelected}
              onChange={toggleSelectAllOnPage}
              disabled={selectablePending.length === 0}
            />
            <span>Select all on this page</span>
          </label>
          <span className="text-gray-500">
            {selectedIds.length} selected
            {selectablePending.length < pendingOnPage.length && (
              <span className="ml-1">
                (set DP / DP No-Warranty on product stock to bulk-approve dealer
                requests)
              </span>
            )}
          </span>
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={() => setBulkOpen(true)}
            className="px-3 py-1.5 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-40"
          >
            Approve selected
          </button>
        </div>
      )}

      <div
        className="overflow-x-scroll w-full min-w-0 touch-pan-x"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <table className="min-w-[1000px] w-full border-collapse text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 w-10 text-center">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={allSelectableSelected}
                  onChange={toggleSelectAllOnPage}
                  disabled={selectablePending.length === 0}
                  aria-label="Select all on this page"
                  title="Select all on this page"
                />
              </th>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-left">Customer</th>
              <th className="p-3 text-left">Image</th>
              <th className="p-3 text-left">Product/Spare</th>
              <th className="p-3 text-right">Original Price</th>
              <th className="p-3 text-right">Last Neg. Price</th>
              <th className="p-3 text-right">Special Price</th>
              <th className="p-3 text-left">Price Type</th>
              <th className="p-3 text-left">Price Term</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-left">Set By</th>
              <th className="p-3 text-left">Set Date</th>
              <th className="p-3 text-left min-w-[160px] sm:sticky sm:right-0 sm:bg-gray-100 sm:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.1)]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={14}
                  className="p-4 text-center text-gray-500 text-sm"
                >
                  {searchQuery || statusFilter || typeFilter || priceTypeFilter
                    ? "No data found"
                    : "No special prices found."}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const status = (row.status || "").toLowerCase();
                const isApproved = status === "approved";
                const isRejected = status === "rejected";
                const pending = isPendingRow(row);
                const dealerPending = isDealerPricePending(row);
                const autoDealerPrice = dealerPending
                  ? resolveDealerPriceFromProductStock(row.price_term, {
                      dp: row.stock_dp,
                      dp_no_warranty: row.stock_dp_no_warranty,
                    })
                  : null;
                const autoApprovalNote = dealerPending
                  ? dealerApprovalNoteForTerm(row.price_term)
                  : "";
                const canSelect =
                  pending && (!dealerPending || canAutoApproveDealerPrice(row));
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
                const approvedMeta =
                  isApproved && row.approved_by
                    ? `Approved by ${row.approved_by}${
                        row.approved_date
                          ? ` on ${new Date(row.approved_date).toLocaleString()}`
                          : ""
                      }`
                    : null;
                const rejectedMeta =
                  isRejected && row.approved_by
                    ? `Rejected by ${row.approved_by}${
                        row.approved_date
                          ? ` on ${new Date(row.approved_date).toLocaleString()}`
                          : ""
                      }`
                    : null;
                const key = rowKey(row);

                return (
                  <tr key={key} className="border-t">
                    <td className="p-3 text-center align-middle">
                      {canSelect ? (
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={selected.has(key)}
                          onChange={() => toggleRow(row)}
                          aria-label={`Select row ${row.id}`}
                        />
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          row.item_type === "product"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {row.item_type === "product" ? "Product" : "Spare"}
                      </span>
                    </td>
                    <td className="p-3">
                      {row.first_name} {row.last_name || ""}
                      <div className="text-xs text-gray-500">
                        ID: {row.customer_id}
                      </div>
                    </td>
                    <td className="p-3">
                      {row.product_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.product_image}
                          alt={row.item_name || "Item"}
                          className="w-10 h-10 object-cover rounded"
                        />
                      ) : (
                        <span className="text-gray-400 text-xs">No image</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div>{row.item_name}</div>
                      <div className="text-xs text-gray-500">
                        Code: {row.product_code}
                      </div>
                    </td>
                    <td className="p-3 text-right text-gray-600">
                      ₹ {row.price_per_unit}
                    </td>
                    <td className="p-3 text-right text-gray-600">
                      ₹ {row.last_negotiation_price ?? 0}
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {dealerPending ? (
                        <span className="text-gray-400 italic text-sm font-normal">
                          Enter on approve
                        </span>
                      ) : (
                        `₹ ${row.special_price}`
                      )}
                    </td>
                    <td className="p-3 text-sm capitalize">
                      {resolveSpecialPriceType(row.price_type)}
                    </td>
                    <td className="p-3 text-sm capitalize">
                      {resolveSpecialPriceTerm(row.price_term)}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`px-3 py-1 rounded text-xs capitalize ${badgeClass}`}
                        >
                          {label}
                        </span>
                        {approvedMeta && (
                          <span className="text-[11px] text-gray-500">
                            {approvedMeta}
                          </span>
                        )}
                        {rejectedMeta && (
                          <span className="text-[11px] text-gray-500">
                            {rejectedMeta}
                          </span>
                        )}
                        {(isApproved || isRejected) && row.approval_note && (
                          <div className="text-[11px] text-gray-700 max-w-[min(240px,28vw)] text-center leading-snug border-t border-gray-200/80 pt-1.5 mt-0.5">
                            <span className="font-semibold text-gray-600">
                              Note:{" "}
                            </span>
                            <span className="whitespace-pre-wrap break-words">
                              {row.approval_note}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-sm">{row.set_by}</td>
                    <td className="p-3 text-xs text-gray-600">
                      {row.set_date
                        ? new Date(row.set_date).toLocaleString()
                        : "-"}
                    </td>
                    <td className="p-3 space-y-2 min-w-[160px] sm:sticky sm:right-0 sm:bg-white sm:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.1)]">
                      <div className="flex flex-wrap gap-2">
                        <SpecialPriceDetailsModal
                          details={{
                            id: row.id,
                            itemType: row.item_type,
                            customerId: row.customer_id,
                            customerName: `${row.first_name || ""} ${row.last_name || ""}`.trim(),
                            productName: row.item_name,
                            productCode: row.product_code,
                            originalPrice: row.price_per_unit,
                            specialPrice: row.special_price,
                            priceType: row.price_type,
                            priceTerm: row.price_term,
                            status: row.status,
                            setBy: row.set_by,
                            setDate: row.set_date,
                            approvedBy: row.approved_by,
                            approvedDate: row.approved_date,
                            approvalNote: row.approval_note,
                          }}
                          onUpdate={updateSpecialPrice}
                          onDelete={deleteSpecialPrice}
                        />
                      </div>
                      {pending && (
                        <SpecialPriceApproveRejectButtons
                          id={row.id}
                          itemType={row.item_type}
                          needsDealerPrice={dealerPending}
                          autoDealerPrice={autoDealerPrice}
                          autoApprovalNote={autoApprovalNote}
                        />
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 p-4 border-t text-sm">
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <div className="flex gap-2">
          {currentPage > 1 && (
            <Link
              href={`/admin-dashboard/special-pricing?${paginationQuery(currentPage - 1)}`}
              className="px-3 py-1.5 border rounded hover:bg-gray-50"
            >
              Previous
            </Link>
          )}
          {currentPage < totalPages && (
            <Link
              href={`/admin-dashboard/special-pricing?${paginationQuery(currentPage + 1)}`}
              className="px-3 py-1.5 border rounded hover:bg-gray-50"
            >
              Next
            </Link>
          )}
        </div>
      </div>

      {bulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-4 space-y-3">
            <h2 className="text-sm font-semibold">
              Approve {selectedIds.length} special price
              {selectedIds.length === 1 ? "" : "s"}
            </h2>
            <form action={bulkAction} className="space-y-3">
              <input
                type="hidden"
                name="ids"
                value={JSON.stringify(selectedIds)}
              />
              <div>
                <label
                  htmlFor="bulk-approval-note"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Note <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="bulk-approval-note"
                  name="note"
                  required
                  rows={4}
                  disabled={bulkPending}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="Enter a note for all selected approvals…"
                />
              </div>
              {bulkState?.error && (
                <p className="text-sm text-red-600">{bulkState.error}</p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBulkOpen(false)}
                  disabled={bulkPending}
                  className="px-4 py-2 border rounded-md text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bulkPending}
                  className="px-4 py-2 rounded-md bg-green-600 text-white text-sm font-medium disabled:opacity-50"
                >
                  {bulkPending ? "Approving…" : "Approve all selected"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
