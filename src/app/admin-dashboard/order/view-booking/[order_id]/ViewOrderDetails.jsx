"use client";

import Image from "next/image";

export default function ViewOrderDetails({ data }) {
  const {
    orderDetails,
    items,
    stages,
    currentStage,
    currentIndex,
    progressPercent,
  } = data;

  const currency = (val) =>
    `₹${parseFloat(val || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
    })}`;

  const files = [
    { label: "Payment Proof", key: "payment_proof" },
    { label: "Purchase Order", key: "po_file" },
    { label: "Invoice", key: "report_file" },
    { label: "E-way Bill", key: "ewaybill_file" },
    { label: "E-invoice", key: "einvoice_file" },
    { label: "Delivery Challan", key: "deliverchallan" },
    { label: "Delivery Proof", key: "delivery_proof" },
  ];

  const formatValue = (val) => {
    if (val instanceof Date) return val.toLocaleDateString();
    return val || "-";
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4 text-center">
        View Order by Quotation
      </h1>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="h-2 bg-gray-300 rounded-full relative">
          <div
            className="absolute h-2 bg-green-500 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs mt-2">
          {stages.map((label, idx) => (
            <div className="text-center flex-1" key={label}>
              <div
                className={`w-6 h-6 mx-auto rounded-full text-white flex items-center justify-center font-bold text-[10px] ${idx <= currentIndex ? "bg-green-600" : "bg-gray-400"
                  }`}
              >
                {idx + 1}
              </div>
              <div className="text-gray-700 mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Order Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-white p-4 shadow rounded-lg">
        {/* Return Status Badge */}
        {(orderDetails.is_returned === 1 || orderDetails.is_returned === 2) && (
          <div className="md:col-span-2">
            <p className="text-sm text-gray-500">Return Status</p>
            <div className="mt-1">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${orderDetails.is_returned === 1
                  ? "bg-red-100 text-red-800"
                  : "bg-orange-100 text-orange-800"
                  }`}
              >
                {orderDetails.is_returned === 1 ? "Fully Returned" : "Partially Returned"}
              </span>
            </div>
          </div>
        )}

        {[
          ["Quotation Number", orderDetails.quote_number],
          ["Company Name", orderDetails.company_name],
          ["Company Address", orderDetails.company_address],
          ["State", orderDetails.state],
          ["Ship To", orderDetails.ship_to],
          ["Client Name", orderDetails.client_name],
          ["Contact Number", orderDetails.contact],
          ["Email", orderDetails.email],
          ["Delivery Location", orderDetails.delivery_location],
          ["Client Delivery Date", formatValue(orderDetails.client_delivery_date)],
          ["Invoice Number", orderDetails.invoice_number],
          ["Total Tax", currency(orderDetails.taxamt)],
          ["Total Amount", currency(orderDetails.totalamt)],
          ["Due Date", formatValue(orderDetails.duedate)],
          ["Booking ID", orderDetails.booking_id],
          ["Booking Date", formatValue(orderDetails.booking_date)],
          ["Dispatch Person Name", orderDetails.dispatch_person],
          ["Expected Delivery Date", formatValue(orderDetails.delivery_date)],
          ["Actual Delivery Date", formatValue(orderDetails.delivered_on)],
        ].map(([label, value], idx) => (
          <div key={`${label}-${idx}`}>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="font-medium text-gray-900">{value || "-"}</p>
          </div>
        ))}
      </div>

      {/* Product Table */}
      <h2 className="text-lg font-semibold mb-2">Product Items</h2>
      <div className="overflow-x-auto mb-6 rounded-lg shadow border border-gray-200">
        <table className="min-w-full text-sm text-center table-auto">
          <thead className="bg-gray-800 text-white text-sm uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Image</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Specification</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Price/Unit</th>
              <th className="px-4 py-3">Taxable</th>
              <th className="px-4 py-3">GST</th>
              <th className="px-4 py-3">Total</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {items.length > 0 ? (
              items.map((item, i) => (
                <tr
                  key={i}
                  className="hover:bg-gray-50 transition duration-150 ease-in-out"
                >
                  <td className="px-4 py-3 font-medium text-gray-700">
                    {i + 1}
                  </td>
                  <td className="px-4 py-3">
                    <img
                      src={item.img_url}
                      alt="Product"
                      width={40}
                      height={40}
                      className="mx-auto rounded object-contain"
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-800">{item.item_name}</td>
                  <td className="px-4 py-3 text-gray-700">{item.item_code}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {item.specification}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{item.quantity}</td>
                  <td className="px-4 py-3 text-gray-700">{item.unit}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {currency(item.price_per_unit)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {currency(item.taxable_price)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {currency(item.gst)}
                  </td>
                  <td className="px-4 py-3 text-gray-900 font-semibold">
                    {currency(item.total_price)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={11}
                  className="text-center px-4 py-6 text-gray-500 italic"
                >
                  No items found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Admin Remark */}
      <div className="mb-6">
        <label className="text-sm text-gray-600">Remark:</label>
        <textarea
          value={orderDetails.admin_remark || ""}
          readOnly
          className="mt-1 w-full border rounded-lg p-2 text-sm bg-gray-100 resize-none"
          rows={3}
        />
      </div>

      {/* Files */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {files.map(({ label, key }) => (
          <div key={key} className="p-4 border rounded-lg">
            <h4 className="text-sm font-semibold mb-2">{label}</h4>
            {orderDetails[key] ? (
              <div className="flex gap-2">
                <a
                  href={orderDetails[key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm"
                >
                  View
                </a>
                <a
                  href={orderDetails[key]}
                  download
                  className="text-green-600 hover:underline text-sm"
                >
                  Download
                </a>
              </div>
            ) : (
              <p className="text-gray-500 text-xs">Not uploaded</p>
            )}
          </div>
        ))}

        {orderDetails.booking_url && (
          <div className="p-4 border rounded-lg">
            <h4 className="text-sm font-semibold mb-2">Booking URL</h4>
            <a
              href={orderDetails.booking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-sm"
            >
              Open URL
            </a>
          </div>
        )}
      </div>

      <div className="mt-8 text-center">
        <a
          href="/admin-dashboard/order"
          className="inline-block text-sm px-4 py-2 border rounded hover:bg-gray-100"
        >
          ← Back to Order List
        </a>
      </div>
    </div>
  );
}
