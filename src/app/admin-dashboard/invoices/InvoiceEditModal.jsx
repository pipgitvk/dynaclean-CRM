"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import InvoiceItemsTable from "./new/invoice-table";
import TaxAndSummary from "./new/Tax-invoice";
import PaymentLinkModal from "@/app/user-dashboard/invoices/new/PaymentLinkModal";

const emptyItem = () => ({
  item_name: "",
  description: "",
  hsn_code: "",
  quantity: 1,
  rate: 0,
  discount_percent: 0,
  discount_amount: 0,
  taxable_value: 0,
  cgst_percent: 9,
  sgst_percent: 9,
  igst_percent: 0,
});

function dateInputValue(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function normalizeStateCode(v, gstin) {
  const raw = v != null ? String(v).trim() : "";
  if (/^\d{2}$/.test(raw)) return raw;
  const g = gstin != null ? String(gstin).trim() : "";
  const code = g.slice(0, 2);
  return /^\d{2}$/.test(code) ? code : raw;
}

function toDatetimeLocalValue(v) {
  if (!v) return "";
  const dt = new Date(v);
  if (Number.isNaN(dt.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

function parseLinkedTransIds(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapItemFromDb(row) {
  return {
    ...emptyItem(),
    ...row,
    quantity: Number(row.quantity) || 0,
    rate: Number(row.rate) || 0,
    discount_percent: Number(row.discount_percent) || 0,
    discount_amount: Number(row.discount_amount) || 0,
    taxable_value: Number(row.taxable_value) || 0,
    cgst_percent: Number(row.cgst_percent) || 0,
    sgst_percent: Number(row.sgst_percent) || 0,
    igst_percent: Number(row.igst_percent) || 0,
  };
}

export default function InvoiceEditModal({
  open,
  invoiceId,
  onClose,
  onSaved,
  viewHrefBase = "/admin-dashboard/invoices",
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [createdAtLocal, setCreatedAtLocal] = useState("");
  const [items, setItems] = useState([emptyItem()]);
  const [form, setForm] = useState({
    customer_id: "",
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    billing_address: "",
    shipping_address: "",
    Consignee: "",
    Consignee_Contact: "",
    gst_number: "",
    state: "",
    state_code: "",
    due_date: "",
    amount_paid: 0,
    payment_status: "UNPAID",
    quotation_id: "",
    buyers_order_no: "",
    eway_bill_no: "",
    delivery_challan_no: "",
    order_date: "",
  });
  const [notes, setNotes] = useState("");
  const [editableTerms, setEditableTerms] = useState("");
  const [cgstRate, setCgstRate] = useState(9);
  const [sgstRate, setSgstRate] = useState(9);
  const [igstRate, setIgstRate] = useState(0);
  const [roundOff, setRoundOff] = useState(0);
  const [isAutoRoundOff, setIsAutoRoundOff] = useState(true);
  const [showPaymentLinkModal, setShowPaymentLinkModal] = useState(false);
  const [linkedTransIds, setLinkedTransIds] = useState([]);

  const taxSummary = useMemo(() => {
    let subtotal = 0;
    items.forEach((item) => {
      const qty = item.quantity || 0;
      const rate = item.rate || 0;
      const discountAmount = item.discount_amount || 0;
      const itemTotal = qty * rate - discountAmount;
      subtotal += itemTotal;
    });
    const cgst = (subtotal * cgstRate) / 100;
    const sgst = (subtotal * sgstRate) / 100;
    const igst = (subtotal * igstRate) / 100;
    const totalTax = cgst + sgst + igst;
    
    const totalBeforeRound = subtotal + totalTax;
    let finalRoundOff = parseFloat(roundOff) || 0;
    
    if (isAutoRoundOff) {
      finalRoundOff = Math.round(totalBeforeRound) - totalBeforeRound;
    }
    
    const grandTotal = totalBeforeRound + finalRoundOff;
    
    return { subtotal, cgst, sgst, igst, totalTax, grandTotal, finalRoundOff };
  }, [items, cgstRate, sgstRate, igstRate, roundOff, isAutoRoundOff]);

  useEffect(() => {
    if (isAutoRoundOff) {
      setRoundOff(parseFloat(taxSummary.finalRoundOff.toFixed(2)));
    }
  }, [taxSummary.finalRoundOff, isAutoRoundOff]);

  useEffect(() => {
    if (!open || !invoiceId) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(`/api/invoices/${invoiceId}`);
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || data.detail || "Failed to load invoice");
        }
        if (cancelled) return;

        const inv = data.invoice;
        setInvoiceNumber(inv.invoice_number || "");
        // Invoice date should reflect when the invoice record was created.
        // Order date is the editable business date.
        setInvoiceDate(dateInputValue(inv.created_at || inv.invoice_date) || "");
        setCreatedAtLocal(toDatetimeLocalValue(inv.created_at) || "");
        setLinkedTransIds(parseLinkedTransIds(inv.linked_trans_ids));
        setForm({
          customer_id: inv.customer_id != null ? String(inv.customer_id) : "",
          customer_name: inv.customer_name || "",
          customer_email: inv.customer_email || "",
          customer_phone: inv.customer_phone || "",
          billing_address: inv.billing_address || "",
          shipping_address: inv.shipping_address || "",
          Consignee: inv.Consignee || "",
          Consignee_Contact: inv.Consignee_Contact || "",
          gst_number: inv.gst_number || "",
          state: inv.state || "",
          state_code: normalizeStateCode(inv.state_code, inv.gst_number),
          due_date: dateInputValue(inv.due_date) || "",
          amount_paid: Number(inv.amount_paid) || 0,
          payment_status: inv.payment_status || "UNPAID",
          quotation_id:
            inv.quotation_id != null && inv.quotation_id !== ""
              ? String(inv.quotation_id)
              : "",
          buyers_order_no: inv.buyers_order_no ?? "",
          eway_bill_no: inv.eway_bill_no ?? "",
          delivery_challan_no: inv.delivery_challan_no ?? "",
          order_date: dateInputValue(inv.order_date) || "",
        });
        setShowPaymentLinkModal(false);
        setNotes(inv.notes || "");
        setEditableTerms(inv.terms_conditions || "");
        setRoundOff(Number(inv.round_off) || 0);
        // setIsAutoRoundOff(false); // Keep it true by default as requested

        const loadedItems =
          Array.isArray(data.items) && data.items.length
            ? data.items.map(mapItemFromDb)
            : [emptyItem()];
        setItems(loadedItems);

        const st = Number(inv.subtotal) || 0;
        if (st > 0) {
          setCgstRate(
            Math.round(((Number(inv.cgst) || 0) / st) * 10000) / 100,
          );
          setSgstRate(
            Math.round(((Number(inv.sgst) || 0) / st) * 10000) / 100,
          );
          setIgstRate(
            Math.round(((Number(inv.igst) || 0) / st) * 10000) / 100,
          );
        } else {
          setCgstRate(9);
          setSgstRate(9);
          setIgstRate(0);
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(e?.message || "Failed to load invoice");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, invoiceId]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!invoiceNumber.trim() || !form.customer_name.trim()) {
      toast.error("Invoice number and buyer name are required");
      return;
    }
    setSaving(true);
    try {
      const itemsWithTotals = items.map((item) => {
        const qty = item.quantity || 0;
        const rate = item.rate || 0;
        const discountAmount = item.discount_amount || 0;
        const taxableValue = qty * rate - discountAmount;
        const cgstAmount = (taxableValue * (cgstRate || 0)) / 100;
        const sgstAmount = (taxableValue * (sgstRate || 0)) / 100;
        const igstAmount = (taxableValue * (igstRate || 0)) / 100;
        const totalAmount =
          taxableValue + cgstAmount + sgstAmount + igstAmount;
        return {
          ...item,
          cgst_percent: cgstRate,
          sgst_percent: sgstRate,
          igst_percent: igstRate,
          taxable_value: taxableValue,
          cgst_amount: cgstAmount,
          sgst_amount: sgstAmount,
          igst_amount: igstAmount,
          total_amount: totalAmount,
        };
      });

      const amountPaid = Number(form.amount_paid || 0);
      const balanceAmount = Math.max(0, taxSummary.grandTotal - amountPaid);

      const qRef = String(form.quotation_id || "").trim();
      const qNum = Number(qRef);
      const payload = {
        quotation_id:
          qRef !== "" && Number.isFinite(qNum) ? qNum : null,
        invoice_number: invoiceNumber.trim(),
        invoice_date: invoiceDate,
        order_date: form.order_date || null,
        due_date: form.due_date || null,
        customer_name: form.customer_name,
        customer_email: form.customer_email || null,
        customer_phone: form.customer_phone || null,
        billing_address: form.billing_address,
        shipping_address: form.shipping_address || null,
        Consignee: form.Consignee || null,
        Consignee_Contact: form.Consignee_Contact || null,
        gst_number: form.gst_number || null,
        state: form.state || null,
        state_code: form.state_code || null,
        items: itemsWithTotals,
        subtotal: taxSummary.subtotal,
        cgst: taxSummary.cgst,
        sgst: taxSummary.sgst,
        igst: taxSummary.igst,
        total_tax: taxSummary.totalTax,
        round_off: parseFloat(roundOff) || 0,
        grand_total: taxSummary.grandTotal,
        amount_paid: amountPaid,
        balance_amount: balanceAmount,
        payment_status: form.payment_status,
        notes: notes || null,
        terms_conditions: editableTerms || null,
        buyers_order_no: form.buyers_order_no?.trim() || null,
        eway_bill_no: form.eway_bill_no?.trim() || null,
        delivery_challan_no: form.delivery_challan_no?.trim() || null,
        created_at: createdAtLocal || null,
        customer_id: String(form.customer_id || "").trim() || null,
        linked_trans_ids: linkedTransIds,
      };

      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const out = await res.json();
      if (!res.ok || !out.success) {
        throw new Error(out.error || "Save failed");
      }
      if (linkedTransIds.length > 0 && invoiceNumber.trim()) {
        const invoiceStatusForStmt =
          form.payment_status === "PAID"
            ? "Settled"
            : form.payment_status === "PARTIAL"
              ? "Partial Paid"
              : "Unsettled";
        try {
          await fetch("/api/statements", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              trans_ids: linkedTransIds,
              invoice_number: invoiceNumber.trim(),
              invoice_status: invoiceStatusForStmt,
            }),
          });
        } catch (patchErr) {
          console.error("Failed to link statements:", patchErr);
        }
      }
      toast.success("Invoice updated");
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const viewHref = `${viewHrefBase}/${encodeURIComponent(invoiceNumber || "_")}`;

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-gray-50 shrink-0">
          <h2 className="text-lg font-semibold text-gray-800">Edit invoice</h2>
          <div className="flex items-center gap-2">
            {invoiceNumber ? (
              <Link
                href={viewHref}
                className="text-sm bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open print view
              </Link>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-100"
            >
              Close
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-3">
          {loading ? (
            <p className="text-center py-12 text-gray-600">Loading…</p>
          ) : (
            <form onSubmit={handleSave} className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentLinkModal(true)}
                  className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
                >
                  Payment Link
                </button>
              </div>
              {linkedTransIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 bg-blue-50 border border-blue-200 rounded p-3">
                  <span className="text-xs font-semibold text-blue-700 mr-1">
                    Linked Trans IDs:
                  </span>
                  {linkedTransIds.map((tid) => (
                    <span
                      key={tid}
                      className="bg-blue-100 text-blue-800 text-xs font-mono px-2 py-1 rounded-full"
                    >
                      {tid}
                    </span>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-gray-600 mb-1">Invoice no.</label>
                  <input
                    readOnly
                    tabIndex={-1}
                    className="w-full border rounded px-2 py-1.5 bg-gray-100 text-gray-800 cursor-default"
                    value={invoiceNumber}
                    title="Invoice number cannot be changed"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Invoice date</label>
                  <input
                    type="date"
                    className="w-full border rounded px-2 py-1.5 bg-gray-100 cursor-not-allowed"
                    value={invoiceDate}
                    readOnly
                    tabIndex={-1}
                    title="Invoice date is the creation date"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Order date</label>
                  <input
                    type="date"
                    className="w-full border rounded px-2 py-1.5"
                    value={form.order_date}
                    onChange={(e) =>
                      setForm({ ...form, order_date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Due date</label>
                  <input
                    type="date"
                    className="w-full border rounded px-2 py-1.5"
                    value={form.due_date}
                    onChange={(e) =>
                      setForm({ ...form, due_date: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 mb-1">Buyer *</label>
                  <input
                    className="w-full border rounded px-2 py-1.5"
                    value={form.customer_name}
                    onChange={(e) =>
                      setForm({ ...form, customer_name: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full border rounded px-2 py-1.5"
                    value={form.customer_email}
                    onChange={(e) =>
                      setForm({ ...form, customer_email: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Phone</label>
                  <input
                    className="w-full border rounded px-2 py-1.5"
                    value={form.customer_phone}
                    onChange={(e) =>
                      setForm({ ...form, customer_phone: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">
                    Customer ID (payment link)
                  </label>
                  <input
                    className="w-full border rounded px-2 py-1.5 font-mono text-xs"
                    value={form.customer_id}
                    onChange={(e) =>
                      setForm({ ...form, customer_id: e.target.value })
                    }
                    placeholder="Optional — for statement filter"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Quotation ref.</label>
                  <input
                    className="w-full border rounded px-2 py-1.5"
                    value={form.quotation_id}
                    onChange={(e) =>
                      setForm({ ...form, quotation_id: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">
                    Buyer&apos;s order
                  </label>
                  <input
                    className="w-full border rounded px-2 py-1.5"
                    value={form.buyers_order_no}
                    onChange={(e) =>
                      setForm({ ...form, buyers_order_no: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">
                    E-way bill no.
                  </label>
                  <input
                    className="w-full border rounded px-2 py-1.5"
                    value={form.eway_bill_no}
                    onChange={(e) =>
                      setForm({ ...form, eway_bill_no: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">
                    Delivery challan no.
                  </label>
                  <input
                    className="w-full border rounded px-2 py-1.5"
                    value={form.delivery_challan_no}
                    onChange={(e) =>
                      setForm({ ...form, delivery_challan_no: e.target.value })
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-gray-600 mb-1">
                    Billing address *
                  </label>
                  <input
                    className="w-full border rounded px-2 py-1.5"
                    value={form.billing_address}
                    onChange={(e) =>
                      setForm({ ...form, billing_address: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-gray-600 mb-1">
                    Shipping address
                  </label>
                  <input
                    className="w-full border rounded px-2 py-1.5"
                    value={form.shipping_address}
                    onChange={(e) =>
                      setForm({ ...form, shipping_address: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Consignee</label>
                  <input
                    className="w-full border rounded px-2 py-1.5"
                    value={form.Consignee}
                    onChange={(e) =>
                      setForm({ ...form, Consignee: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">
                    Consignee contact
                  </label>
                  <input
                    className="w-full border rounded px-2 py-1.5"
                    value={form.Consignee_Contact}
                    onChange={(e) =>
                      setForm({ ...form, Consignee_Contact: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">GSTIN</label>
                  <input
                    className="w-full border rounded px-2 py-1.5"
                    value={form.gst_number}
                    onChange={(e) =>
                      setForm({ ...form, gst_number: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">State</label>
                  <input
                    className="w-full border rounded px-2 py-1.5"
                    value={form.state}
                    onChange={(e) =>
                      setForm({ ...form, state: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">State code</label>
                  <input
                    className="w-full border rounded px-2 py-1.5"
                    value={form.state_code}
                    onChange={(e) =>
                      setForm({ ...form, state_code: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Amount paid</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full border rounded px-2 py-1.5 bg-gray-100 cursor-not-allowed"
                    value={form.amount_paid}
                    readOnly
                    tabIndex={-1}
                    title="Set via Payment Link"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">
                    Payment status
                  </label>
                  <select
                    className="w-full border rounded px-2 py-1.5"
                    value={form.payment_status}
                    onChange={(e) =>
                      setForm({ ...form, payment_status: e.target.value })
                    }
                  >
                    <option value="UNPAID">Unpaid</option>
                    <option value="PARTIAL">Partial</option>
                    <option value="PAID">Paid</option>
                  </select>
                </div>
              </div>

              <InvoiceItemsTable items={items} setItems={setItems} />

              <TaxAndSummary
                items={items}
                subtotal={taxSummary.subtotal}
                cgst={taxSummary.cgst}
                sgst={taxSummary.sgst}
                igst={taxSummary.igst}
                roundOff={roundOff}
                setRoundOff={setRoundOff}
                isAutoRoundOff={isAutoRoundOff}
                setIsAutoRoundOff={setIsAutoRoundOff}
                grandTotal={taxSummary.grandTotal}
                cgstRate={cgstRate}
                sgstRate={sgstRate}
                igstRate={igstRate}
                setCgstRate={setCgstRate}
                setSgstRate={setSgstRate}
                setIgstRate={setIgstRate}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 mb-1 font-medium">
                    Notes
                  </label>
                  <textarea
                    rows={5}
                    className="w-full border rounded px-2 py-1.5 resize-y"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1 font-medium">
                    Terms &amp; conditions
                  </label>
                  <textarea
                    rows={5}
                    className="w-full border rounded px-2 py-1.5 resize-y"
                    value={editableTerms}
                    onChange={(e) => setEditableTerms(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
    <PaymentLinkModal
      open={showPaymentLinkModal}
      onClose={() => setShowPaymentLinkModal(false)}
      defaultCustomerId={form.customer_id}
      defaultAmount={taxSummary.grandTotal}
      lockedTransIds={linkedTransIds}
      onApply={(transIds, paymentStatus, amountPaid) => {
        setLinkedTransIds((prev) => [
          ...prev,
          ...transIds.filter((t) => !prev.includes(t)),
        ]);
        if (amountPaid > 0) {
          setForm((prev) => ({
            ...prev,
            amount_paid: amountPaid,
            payment_status:
              paymentStatus === "Settled"
                ? "PAID"
                : paymentStatus === "Partial Paid"
                  ? "PARTIAL"
                  : prev.payment_status,
          }));
        }
      }}
    />
    </>
  );
}
