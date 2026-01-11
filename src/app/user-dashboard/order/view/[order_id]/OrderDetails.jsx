"use client";

import Image from "next/image";

export default function OrderDetails({ data }) {
  const {
    orderDetails,
    items,
    stages,
    currentStage,
    progressPercent,
    currentIndex,
  } = data;

  const currency = (n) =>
    `₹${parseFloat(n).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
    })}`;

  const formatDate = (d) => {
    if (!d) return "-";
    const date = new Date(d);
    return isNaN(date) ? d : date.toLocaleDateString("en-IN");
  };

  const files = [
    { label: "Payment Proof", key: "payment_proof" },
    { label: "Purchase Order", key: "po_file" },
    { label: "Invoice", key: "report_file" },
    { label: "E-way Bill", key: "ewaybill_file" },
    { label: "E-invoice", key: "einvoice_file" },
    { label: "Delivery Challan", key: "deliverchallan" },
    { label: "Delivery Proof", key: "delivery_proof" },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6 text-center">Order Details</h1>

      {/* Progress Bar */}
      <div className="flex items-center mb-8">
        <div className="flex-1 h-2 bg-gray-300 rounded-full relative">
          <div
            className="absolute h-2 bg-green-500 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
      <div className="flex justify-between text-sm mb-6">
        {stages.map((label, idx) => (
          <div key={`stage-${idx}`} className="text-center flex-1">
            <div
              className={`w-6 h-6 mx-auto rounded-full text-white flex items-center justify-center text-xs font-bold ${idx <= currentIndex ? "bg-green-500" : "bg-gray-300"
                }`}
            >
              {idx + 1}
            </div>
            <div className="mt-1 text-xs text-gray-700">{label}</div>
          </div>
        ))}
      </div>

      {/* Order Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 bg-white p-4 rounded-lg shadow">
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
          ["Client Delivery Date", formatDate(orderDetails.client_delivery_date)],
          ["Invoice Number", orderDetails.invoice_number],
          ["Total Tax", currency(orderDetails.taxamt)],
          ["Total Amount", currency(orderDetails.totalamt)],
          ["Due Date", formatDate(orderDetails.duedate)],
          ["Booking ID", orderDetails.booking_id],
          ["Dispatch Person", orderDetails.dispatch_person],
          ["Booking Date", formatDate(orderDetails.booking_date)],
          ["Expected Delivery Date", formatDate(orderDetails.delivery_date)],
          ["Actual Delivery Date", formatDate(orderDetails.delivered_on)],
        ].map(([label, value], i) => (
          <div key={`${label}-${i}`}>
            <p className="text-gray-500 text-sm">{label}</p>
            <p className="font-medium text-gray-800">{value || "-"}</p>
          </div>
        ))}
      </div>

      {/* Product Table */}
      <h2 className="text-lg font-semibold mb-2">Product Items</h2>
      <div className="overflow-auto shadow-md rounded-lg border border-gray-200">
        <table className="min-w-full text-sm text-center table-auto">
          <thead className="bg-gray-800 text-white text-sm uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Image</th>
              <th className="px-4 py-3">Item Name</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Specification</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Unit Price</th>
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
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {i + 1}
                  </td>
                  <td className="px-4 py-3">
                    <img
                      src={item.img_url}
                      width={40}
                      height={40}
                      alt="Product"
                      className="mx-auto rounded object-contain"
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-700">{item.item_name}</td>
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
                  No items found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Remark */}
      <div className="mt-6">
        <label className="text-sm font-medium text-gray-600">Remark:</label>
        <textarea
          value={orderDetails.account_remark || ""}
          readOnly
          className="mt-1 w-full border rounded-lg p-2 text-sm bg-gray-100 resize-none"
          rows={3}
        />
      </div>

      {/* File Downloads */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          href="/user-dashboard/order"
          className="inline-block text-sm px-4 py-2 border rounded hover:bg-gray-100"
        >
          ← Back to Order List
        </a>
      </div>
    </div>
  );
}
