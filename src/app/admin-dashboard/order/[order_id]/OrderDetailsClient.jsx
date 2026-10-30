"use client";

import { useMemo, useState } from "react";
import dayjs from "dayjs";
import OrderApprovalActions from "../OrderApprovalActions";
import OrderBookingDetailLinks from "@/components/orders/OrderBookingDetailLinks";
import OrderDocumentFileCard from "@/components/orders/OrderDocumentFileCard";
import OrderDelhiveryTrackingSection from "@/components/orders/OrderDelhiveryTrackingSection";
import {
  ORDER_PIPELINE_STAGES,
  deriveOrderPipelineProgress,
} from "@/lib/orderPipelineStage";
import {
  formatOrderPaymentAmountInr,
  formatOrderRequestedAmountInr,
  getSalesOrderAmountFieldDisplay,
} from "@/lib/orderPaymentHistory";

const DOCUMENT_FIELDS = [
  { label: "E-way Bill", key: "ewaybill_file" },
  { label: "E-invoice", key: "einvoice_file" },
  { label: "Invoice PDF", key: "report_file" },
  { label: "Delivery Challan", key: "deliverchallan" },
  { label: "Purchase Order", key: "po_file" },
  { label: "Payment Proof", key: "payment_proof" },
  { label: "Delivery Proof", key: "delivery_proof" },
];

const stages = ORDER_PIPELINE_STAGES;

export default function OrderDetailsClient({
  orderDetails,
  items,
  statuses,
  orderId,
  gstin,
  userRole,
  showDualPaymentAmountFields = false,
  delhiveryLr = null,
  returnDelhiveryLr = null,
}) {
  const formatDate = (value) => {
    if (!value) return "";
    const d = dayjs(value);
    if (!d.isValid()) return String(value);
    return d.format("ddd MMM DD YYYY");
  };
  const { totalQty, totalTaxable, totalGst, totalAmount } = useMemo(() => {
    let totalQty = 0,
      totalTaxable = 0,
      totalGst = 0,
      totalAmount = 0;

    items.forEach((item) => {
      const base = Number(item.total_taxable_amt || item.taxable_price || 0);
      const tax = Number(item.total_price || 0) - base;
      totalQty += Number(item.quantity || 0);
      totalTaxable += base;
      totalGst += tax;
      totalAmount += Number(item.total_price || 0);
    });

    return { totalQty, totalTaxable, totalGst, totalAmount };
  }, [items]);

  const { progressPercent, stepCompleted } = useMemo(
    () => deriveOrderPipelineProgress(orderDetails, statuses),
    [orderDetails, statuses],
  );

  const salesAmountField = useMemo(
    () => getSalesOrderAmountFieldDisplay(orderDetails),
    [orderDetails],
  );

  const [fileValues, setFileValues] = useState(() => {
    const initial = {};
    DOCUMENT_FIELDS.forEach(({ key }) => {
      initial[key] = orderDetails[key] || "";
    });
    return initial;
  });

  const handleFilesUploaded = (fieldKey, newValue) => {
    setFileValues((prev) => ({ ...prev, [fieldKey]: newValue }));
  };

  const orderForDocRules = useMemo(
    () => ({
      dispatch_status: orderDetails.dispatch_status,
      delivery_status: orderDetails.delivery_status,
      delivered_on: orderDetails.delivered_on,
    }),
    [
      orderDetails.dispatch_status,
      orderDetails.delivery_status,
      orderDetails.delivered_on,
    ],
  );

  return (
    <div className="p-4 space-y-6">
      <OrderBookingDetailLinks order={orderDetails} userRole={userRole} />
      <OrderDelhiveryTrackingSection
        orderId={orderDetails.order_id ?? orderId}
        delhiveryLr={delhiveryLr}
        returnDelhiveryLr={returnDelhiveryLr}
      />

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="relative w-full h-3 bg-gray-300 rounded-full">
          <div
            className="absolute top-0 left-0 h-3 bg-blue-600 rounded-full"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-xs sm:text-sm">
          {stages.map((stage, i) => (
            <div key={i} className="text-center flex-1">
              <div
                className={`w-6 h-6 mx-auto mb-1 rounded-full text-white text-xs flex items-center justify-center ${
                  stepCompleted[i] ? "bg-blue-600" : "bg-gray-400"
                }`}
              >
                {i + 1}
              </div>
              <div>{stage}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Info Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Quotation Number" value={orderDetails.quote_number} />
        <Input label="Company Name" value={orderDetails.company_name} />
        <Input label="Company Address" value={orderDetails.company_address} />
        <Input label="State" value={orderDetails.state} />
        <Input label="GSTIN" value={gstin} />
        <Input label="Ship To" value={orderDetails.ship_to} />
        <Input label="Client Name" value={orderDetails.client_name} />
        <Input label="Contact Number" value={orderDetails.contact} />
        <Input label="Email" value={orderDetails.email} />
        <Input
          label="Delivery Location"
          value={orderDetails.delivery_location}
        />
        <Input label="PO Number / Gem Order Number" value={orderDetails.po_number} />
        <Input label="Payment Date" value={formatDate(orderDetails.payment_date)} />
        <Input label="Transaction ID" value={orderDetails.transaction_id} />
        {showDualPaymentAmountFields ? (
          <>
            <Input
              label="Requested Amount"
              value={formatOrderRequestedAmountInr(orderDetails)}
            />
            <Input
              label="Payment Amount"
              value={formatOrderPaymentAmountInr(orderDetails)}
            />
          </>
        ) : (
          <Input
            label={salesAmountField.label}
            value={salesAmountField.value}
          />
        )}
        <TextArea label="Remark" value={orderDetails.sales_remark} />
      </div>

      {/* Items Table / Card */}
      <div className="space-y-4">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full border text-sm text-center">
            <thead className="bg-gray-100 text-gray-700 uppercase text-sm">
              <tr>
                <th>#</th>
                <th>Image</th>
                <th>Item Name</th>
                <th>Item Code</th>
                <th>Specification</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Price/Unit</th>
                <th>Taxable</th>
                <th>GST</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? (
                items.map((item, idx) => (
                  <tr key={idx} className="bg-white hover:bg-gray-50">
                    <td>{idx + 1}</td>
                    <td>
                      <img
                        src={item.img_url}
                        alt="Item"
                        className="h-10 w-10 object-contain mx-auto rounded"
                      />
                    </td>
                    <td>{item.item_name}</td>
                    <td>{item.item_code}</td>
                    <td>{item.specification}</td>
                    <td>{item.quantity}</td>
                    <td>{item.unit}</td>
                    <td>₹{Number(item.price_per_unit).toFixed(2)}</td>
                    <td>₹{Number(item.total_taxable_amt || item.taxable_price || 0).toFixed(2)}</td>
                    <td>{Number(item.gst || 0).toFixed(0)}%</td>
                    <td>₹{Number(item.total_price).toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="11"
                    className="text-center text-gray-500 italic py-4"
                  >
                    No items found.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-gray-100 font-semibold text-sm">
              <tr>
                <td colSpan="5" className="text-right px-4 py-2">
                  Total
                </td>
                <td>{totalQty}</td>
                <td></td>
                <td></td>
                <td>₹{totalTaxable.toFixed(2)}</td>
                <td>₹{totalGst.toFixed(2)}</td>
                <td>₹{totalAmount.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="border rounded-md p-4 shadow-sm bg-white space-y-1"
            >
              <div className="flex items-center gap-4">
                <img
                  src={item.img_url}
                  alt="Item"
                  className="h-12 w-12 object-contain rounded"
                />
                <div>
                  <p className="font-semibold">{item.item_name}</p>
                  <p className="text-sm text-gray-500">{item.item_code}</p>
                </div>
              </div>
              <p>
                <strong>Specification:</strong> {item.specification}
              </p>
              <p>
                <strong>Qty:</strong> {item.quantity} {item.unit}
              </p>
              <p>
                <strong>Price/Unit:</strong> ₹
                {Number(item.price_per_unit).toFixed(2)}
              </p>
              <p>
                <strong>Taxable:</strong> ₹
                {Number(item.total_taxable_amt || item.taxable_price || 0).toFixed(2)}
              </p>
              <p>
                <strong>GST:</strong> {Number(item.gst || 0).toFixed(0)}%
              </p>
              <p>
                <strong>Total:</strong> ₹{Number(item.total_price).toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Files */}
      {/* <FileSection label="Purchase Order" file={orderDetails.po_file} />
      <FileSection label="Payment Proof" file={orderDetails.payment_proof} />
      <FileSection label="Invoice" file={orderDetails.report_file} /> */}

      {/* Documents */}
      <div className="border rounded p-4 bg-white">
        <h3 className="font-semibold mb-1">Documents</h3>
        <p className="text-xs text-gray-500 mb-3">
          Invoice, e-way bill & e-invoice: up to 5 files each — add more anytime until limit.
          Delivery challan before delivered. Delivery proof within 24 hours of delivery.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {DOCUMENT_FIELDS.map(({ label, key }) => (
            <OrderDocumentFileCard
              key={key}
              label={label}
              fieldKey={key}
              file={fileValues[key]}
              orderId={orderDetails.order_id}
              order={orderForDocRules}
              onUploaded={handleFilesUploaded}
            />
          ))}
        </div>
      </div>

      {/* Accountant Details (if done) */}
      {Number(statuses?.account_status) === 1 && (
        <div className="border rounded p-4 bg-white">
          <h3 className="font-semibold mb-3">Accountant Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Invoice Number" value={orderDetails.invoice_number} />
            <Input
              label="Invoice Date"
              value={formatDate(orderDetails.payment_date || orderDetails.duedate)}
            />
            <Input label="Taxable Amount" value={orderDetails.baseAmount} />
            <Input label="Tax Amount" value={orderDetails.taxamt} />
            <Input label="Total Amount" value={orderDetails.totalamt} />
            <Input label="Payment Status" value={orderDetails.payment_status} />
            <TextArea label="Account Remark" value={orderDetails.account_remark} />
          </div>
        </div>
      )}

      {/* Admin Details (if done) */}
      {Number(statuses?.admin_status) === 1 && (
        <div className="border rounded p-4 bg-white">
          <h3 className="font-semibold mb-3">Admin / Booking Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Booking ID" value={orderDetails.booking_id} />
            <Input label="Booking Date" value={formatDate(orderDetails.booking_date)} />
            <Input label="Dispatch Person" value={orderDetails.dispatch_person} />
            <TextArea label="Admin Remark" value={orderDetails.admin_remark} />
            <div className="col-span-full">
              {orderDetails.booking_url ? (
                <a
                  href={orderDetails.booking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  View Booking
                </a>
              ) : (
                <span className="text-gray-500 italic">No booking URL</span>
              )}
            </div>
          </div>
        </div>
      )}

      {(String(orderDetails.return_booking_ref || "").trim() ||
        Number(orderDetails.return_booking_done) === 1) && (
        <div className="border rounded p-4 bg-white">
          <h3 className="font-semibold mb-3">Return Booking Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Return Booking Ref (LR)"
              value={orderDetails.return_booking_ref}
            />
            <Input
              label="Return Booking Date"
              value={formatDate(orderDetails.return_booking_date)}
            />
            <Input
              label="Expected Pickup Date"
              value={formatDate(orderDetails.expected_pickup_date)}
            />
            <Input label="Return Booking By" value={orderDetails.return_booking_by} />
            <TextArea
              label="Return Booking Remarks"
              value={orderDetails.return_booking_remarks}
            />
            <div className="col-span-full">
              {orderDetails.return_booking_url ? (
                <a
                  href={orderDetails.return_booking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  View Return Booking
                </a>
              ) : (
                <span className="text-gray-500 italic">No return booking URL</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approval Actions - only for Admin (SUPERADMIN) */}
      <div className="border rounded p-4 bg-white">
        <p className="mb-2 text-center text-sm text-gray-600">Approval status</p>
        <OrderApprovalActions
          orderId={orderId}
          approvalStatus={orderDetails.approval_status || "pending"}
          userRole={userRole}
          approvalDate={orderDetails.approval_date}
          dispatchStatus={orderDetails.dispatch_status}
        />
      </div>


      {/* Back Link */}
      <div className="text-center mt-6">
        <a
          href="/admin-dashboard/order"
          className="inline-block bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded"
        >
          ← Back to Order List
        </a>
      </div>
    </div>
  );
}

function Input({ label, value }) {
  return (
    <div>
      <label className="block font-medium text-sm mb-1">{label}:</label>
      <input
        type="text"
        value={value || ""}
        readOnly
        className="w-full border px-3 py-2 rounded"
      />
    </div>
  );
}

function TextArea({ label, value }) {
  return (
    <div className="col-span-full">
      <label className="block font-medium text-sm mb-1">{label}:</label>
      <textarea
        readOnly
        value={value || ""}
        className="w-full border px-3 py-2 rounded"
        rows="3"
      />
    </div>
  );
}
