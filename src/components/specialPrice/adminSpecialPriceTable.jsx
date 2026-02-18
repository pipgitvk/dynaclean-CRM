"use client";

import Link from "next/link";

export default function AdminSpecialPriceTable({
  rows = [],
  currentPage,
  totalPages,
  userRole,
}) {
  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <table className="min-w-full border-collapse">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-3 text-left">Customer</th>
            <th className="p-3 text-left">Product</th>
            <th className="p-3 text-left">Price</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-left">Set By</th>
            <th className="p-3 text-left">Actions</th>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan="6" className="p-4 text-center text-gray-500">
                No special prices found
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-3">{row.first_name}</td>
                <td className="p-3">{row.item_name}</td>
                <td className="p-3 font-semibold">₹ {row.special_price}</td>
                <td className="p-3">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      row.status === "approved"
                        ? "bg-green-100 text-green-700"
                        : row.status === "rejected"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {row.status.toUpperCase()}
                  </span>
                </td>
                <td className="p-3">{row.set_by}</td>
                <td className="p-3 flex gap-2">
                  <Link
                    href={`/admin-dashboard/special-pricing/${row.customer_id}`}
                    className="text-green-600 hover:underline"
                  >
                    View
                  </Link>
                  <Link
                    href={`/admin-dashboard/special-pricing/${row.customer_id}/${row.product_id}`}
                    className="text-blue-600 hover:underline"
                  >
                    Modify
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="flex justify-between items-center p-4 border-t">
        <span>
          Page {currentPage} of {totalPages}
        </span>
      </div>
    </div>
  );
}
