"use client";

import { useMemo, useState } from "react";
import dayjs from "dayjs";
import Image from "next/image";
import OrderApprovalActions from "../OrderApprovalActions";
import OrderDocumentFileCard from "@/components/orders/OrderDocumentFileCard";
import {
  ORDER_PIPELINE_STAGES,
  deriveOrderPipelineProgress,
} from "@/lib/orderPipelineStage";
import OrderDelhiveryTrackingPanel from "@/components/orders/OrderDelhiveryTrackingPanel";
import {
  formatOrderPaymentAmountInr,
  formatOrderRequestedAmountInr,
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
    <div className="mx-auto w-full min-w-0 max-w-[1920px] space-y-4 sm:space-y-6">
      {delhiveryLr ? (
        <OrderDelhiveryTrackingPanel
          lrNumber={delhiveryLr}
          orderId={orderDetails.order_id ?? orderId}
          shipmentLabel="Outbound shipment"
        />
      ) : null}
      {returnDelhiveryLr ? (
        <OrderDelhiveryTrackingPanel
          lrNumber={returnDelhiveryLr}
          orderId={orderDetails.order_id ?? orderId}
          shipmentLabel="Return shipment"
          variant="return"
        />
      ) : null}

      {/* Progress Bar */}
      <div className="min-w-0 space-y-2">
        <div className="relative h-2.5 w-full rounded-full bg-gray-300 sm:h-3">
          <div
            className="absolute left-0 top-0 h-2.5 rounded-full bg-blue-600 sm:h-3"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="-mx-1 overflow-x-auto px-1 pb-1 md:mx-0 md:overflow-visible md:px-0 [scrollbar-width:thin]">
          <div className="flex min-w-[40rem] justify-between gap-1 text-[10px] md:min-w-0 md:text-xs lg:text-sm">
            {stages.map((stage, i) => (
              <div
                key={i}
                className="min-w-[4.25rem] flex-1 shrink-0 px-0.5 text-center sm:min-w-0"
              >
                <div
                  className={`mx-auto mb-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white sm:h-6 sm:w-6 sm:text-xs ${
                    stepCompleted[i] ? "bg-blue-600" : "bg-gray-400"
                  }`}
                >
                  {i + 1}
                </div>
                <div className="leading-tight break-words">{stage}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Info Fields */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
        <Input
          label="Requested Amount"
          value={formatOrderRequestedAmountInr(orderDetails)}
        />
        <Input
          label="Payment Amount"
          value={formatOrderPaymentAmountInr(orderDetails)}
        />
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
                      <Image
                      width={200}
                      height={200}
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
        <div className="space-y-4 md:hidden">
          {items.length === 0 ? (
            <p className="rounded-md border bg-white py-6 text-center text-sm italic text-gray-500">
              No items found.
            </p>
          ) : (
            items.map((item, idx) => (
            <div
              key={idx}
              className="border rounded-md p-4 shadow-sm bg-white space-y-1"
            >
              <div className="flex items-center gap-4">
                <Image
                width={200}
                height={200}
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
            ))
          )}
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
        <div className="rounded border bg-white p-4">
          <h3 className="mb-3 font-semibold">Return Booking Details</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 sm:flex sm:flex-col sm:items-center sm:p-4">
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
    <div className="min-w-0">
      <label className="mb-1 block text-sm font-medium">{label}:</label>
      <input
        type="text"
        value={value || ""}
        readOnly
        className="w-full min-w-0 rounded border px-3 py-2 text-sm break-words"
      />
    </div>
  );
}

function TextArea({ label, value }) {
  return (
    <div className="col-span-full min-w-0">
      <label className="mb-1 block text-sm font-medium">{label}:</label>
      <textarea
        readOnly
        value={value || ""}
        className="w-full min-w-0 rounded border px-3 py-2 text-sm"
        rows="3"
      />
    </div>
  );
}
