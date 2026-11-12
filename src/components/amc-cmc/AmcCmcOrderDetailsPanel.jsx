"use client";

import Link from "next/link";

function Row({ label, value, children }) {
  if (children) {
    return (
      <div className="text-sm">
        <span className="font-medium text-gray-600">{label}: </span>
        {children}
      </div>
    );
  }
  const v = value != null && String(value).trim() !== "" ? String(value) : "—";
  return (
    <div className="text-sm">
      <span className="font-medium text-gray-600">{label}: </span>
      <span className="text-gray-900">{v}</span>
    </div>
  );
}

export default function AmcCmcOrderDetailsPanel({
  orderDetails,
  loading,
  dashboardBase = "admin-dashboard",
  title,
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 md:col-span-2">
        <p className="text-sm text-blue-800">Loading order details…</p>
      </div>
    );
  }

  if (!orderDetails) {
    return null;
  }

  if (!orderDetails.found) {
    const notFoundMsg =
      orderDetails.source === "order"
        ? "Order ID not found or has no dispatched serial yet."
        : "No dispatch / order found for this serial.";
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 md:col-span-2">
        <p className="text-sm font-medium text-amber-900">Linked order</p>
        <p className="text-sm text-amber-800 mt-1">
          {notFoundMsg} You can still create AMC/CMC manually.
        </p>
      </div>
    );
  }

  const o = orderDetails.order || {};
  const orderHref = o.order_id
    ? `/${dashboardBase}/order/${encodeURIComponent(o.order_id)}`
    : null;
  const quoteHref = o.quote_number
    ? `/${dashboardBase}/quotations/${encodeURIComponent(o.quote_number)}`
    : null;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-4 md:col-span-2 space-y-2">
      <p className="text-sm font-semibold text-blue-900">
        {title || "Linked order"}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
        <Row label="Order ID">
          {orderHref ? (
            <Link
              href={orderHref}
              className="text-blue-700 hover:underline font-medium"
              target="_blank"
              rel="noopener noreferrer"
            >
              {o.order_id}
            </Link>
          ) : (
            <span className="text-gray-900">{o.order_id || "—"}</span>
          )}
        </Row>
        <Row label="Quotation no.">
          {quoteHref ? (
            <Link
              href={quoteHref}
              className="text-blue-700 hover:underline font-medium"
              target="_blank"
              rel="noopener noreferrer"
            >
              {o.quote_number}
            </Link>
          ) : (
            <span className="text-gray-900">{o.quote_number || "—"}</span>
          )}
        </Row>
        <Row label="Invoice no." value={o.invoice_number} />
        <Row
          label="Invoice date"
          value={
            o.invoice_date
              ? new Date(o.invoice_date).toLocaleDateString("en-GB")
              : ""
          }
        />
        {o.quote_date ? (
          <Row
            label="Quote date"
            value={new Date(o.quote_date).toLocaleDateString("en-GB")}
          />
        ) : null}
        {o.grand_total != null && o.grand_total !== "" ? (
          <Row label="Quote total" value={o.grand_total} />
        ) : null}
        {o.product_name ? <Row label="Product" value={o.product_name} /> : null}
      </div>
    </div>
  );
}
