"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import InvoiceItemsTable from "./invoice-table";
import TaxAndSummary from "./Tax-invoice";
import PaymentLinkModal from "./PaymentLinkModal";
import { usePathname, useRouter } from "next/navigation";
import {
  navigateAfterInvoiceCreate,
  resolveOrderListRedirectAfterInvoiceCreate,
} from "@/lib/invoiceCreateRedirect";
import Image from "next/image";
import toast from "react-hot-toast";
import AddSpecialPriceModal from "@/components/specialPrice/AddSpecialPriceModal";
import dynacleanLogo from "@/components/logo1.jpg";
import { LetterheadCompanyInfo, LetterheadBankLine, LetterheadSignatoryLine } from "@/components/invoice/InvoiceLetterheadSection";
import {
  applyTaxPercentsToInvoiceItems,
  getStateCodeFromGstin,
  headerRatesForInterstate,
  isInterstateInvoiceSupply,
} from "@/lib/gstSupplyType";

export default function InvoiceForm({
  invoiceNumber,
  invoiceDate,
  invoiceType = "tax",
  onBack,
  onSuccessRedirect,
  initialQuotationNumber = "",
  initialOrderId = "",
}) {
  const router = useRouter();
  const pathname = usePathname();
  const autoFilledQuoteRef = useRef(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPaymentLinkModal, setShowPaymentLinkModal] = useState(false);
  const [linkedTransIds, setLinkedTransIds] = useState([]);
  const [invoicePaymentStatus, setInvoicePaymentStatus] = useState("Unsettled");

  // Determine the display label based on invoice type
  const invoiceTypeLabel = invoiceType === "performa" ? "Performa Invoice" : "Invoice";
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [quotationNumber, setQuotationNumber] = useState(
    String(initialQuotationNumber || "").trim(),
  );
  const [orderId, setOrderId] = useState(String(initialOrderId || "").trim());
  const [isFromQuotation, setIsFromQuotation] = useState(false);

  const [items, setItems] = useState([
    {
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
    },
  ]);

  const [form, setForm] = useState({
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
    customer_id: "",
    payment_status: "UNPAID",
    due_date: "",
    amount_paid: 0,
    buyers_order_no: "",
    eway_bill_no: "",
    delivery_challan_no: "",
    order_date: "",
  });

  const [cgstRate, setCgstRate] = useState(9);
  const [sgstRate, setSgstRate] = useState(9);
  const [igstRate, setIgstRate] = useState(0);
  const [roundOff, setRoundOff] = useState(0);

  const stateCodeToName = useMemo(() => ({
    "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
    "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana", "07": "Delhi",
    "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
    "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
    "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
    "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
    "24": "Gujarat", "25": "Daman & Diu", "26": "Dadra & Nagar Haveli",
    "27": "Maharashtra", "28": "Andhra Pradesh (Old)", "29": "Karnataka",
    "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
    "34": "Puducherry", "35": "Andaman & Nicobar Islands", "36": "Telangana",
    "37": "Andhra Pradesh", "97": "Other Territory", "99": "Centre Jurisdiction",
  }), []);

  const allStates = useMemo(
    () => Object.entries(stateCodeToName).map(([code, name]) => ({ code, name, display: `${name} (${code})` })),
    [stateCodeToName],
  );

  const getStateFromGSTIN = (gstin) => {
    if (!gstin || gstin.length < 2) return null;
    const code = gstin.slice(0, 2);
    const name = stateCodeToName[code];
    if (!name) return null;
    return { code, name, display: `${name} (${code})` };
  };

  const parseCodeFromDisplay = (display) => {
    if (!display) return null;
    const match = display.match(/\((\d{2})\)$/);
    return match ? match[1] : null;
  };

  const [stateSearch, setStateSearch] = useState("");
  const [stateSuggestions, setStateSuggestions] = useState([]);
  const [showStateSuggestions, setShowStateSuggestions] = useState(false);
  const [isAutoRoundOff, setIsAutoRoundOff] = useState(true);

  const taxSummary = useMemo(() => {
    let subtotal = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    items.forEach((item) => {
      const qty = item.quantity || 0;
      const rate = item.rate || 0;
      const discountAmount = item.discount_amount || 0;
      const itemSubtotal = qty * rate - discountAmount;
      subtotal += itemSubtotal;

      // Use per-item tax rates, not global rates
      cgst += (itemSubtotal * (item.cgst_percent || 0)) / 100;
      sgst += (itemSubtotal * (item.sgst_percent || 0)) / 100;
      igst += (itemSubtotal * (item.igst_percent || 0)) / 100;
    });

    const totalTax = cgst + sgst + igst;

    const totalBeforeRound = subtotal + totalTax;
    let finalRoundOff = parseFloat(roundOff) || 0;
    if (isAutoRoundOff) {
      finalRoundOff = Math.round(totalBeforeRound) - totalBeforeRound;
    }
    const grandTotal = totalBeforeRound + finalRoundOff;

    return { subtotal, cgst, sgst, igst, totalTax, grandTotal, finalRoundOff };
  }, [items, roundOff, isAutoRoundOff]);

  useEffect(() => {
    if (isAutoRoundOff) {
      setRoundOff(parseFloat(taxSummary.finalRoundOff.toFixed(2)));
    }
  }, [taxSummary.finalRoundOff, isAutoRoundOff]);

  // Auto-set state from GSTIN + CGST/SGST vs IGST (quotation: buyer GSTIN/state, not stored quote tax)
  useEffect(() => {
    const gstinValue = form.gst_number?.trim();

    if (gstinValue) {
      const st = getStateFromGSTIN(gstinValue);
      if (st) {
        setForm((prev) => {
          if (prev.state === st.display && prev.state_code === st.code) return prev;
          return { ...prev, state: st.display, state_code: st.code };
        });
        setStateSearch(st.display);
        setShowStateSuggestions(false);
      }
    }

    const interstate = isInterstateInvoiceSupply({
      buyerGstin: gstinValue,
      buyerStateCode: form.state_code,
      stateDisplay: form.state,
      parseCodeFromDisplay,
    });

    const { cgstRate: cR, sgstRate: sR, igstRate: iR } =
      headerRatesForInterstate(interstate);
    setCgstRate(cR);
    setSgstRate(sR);
    setIgstRate(iR);

    setItems((prev) => {
      const next = applyTaxPercentsToInvoiceItems(prev, interstate);
      const same =
        prev.length === next.length &&
        prev.every(
          (row, idx) =>
            row.cgst_percent === next[idx].cgst_percent &&
            row.sgst_percent === next[idx].sgst_percent &&
            row.igst_percent === next[idx].igst_percent,
        );
      return same ? prev : next;
    });
  }, [form.gst_number, form.state, form.state_code, stateCodeToName]);

  const [editableTerms, setEditableTerms] = useState(
    `1. Payment due within specified due date.
2. Late payment charges: Interest charges at the rate of 1.5% per month or as per MSME act 2006, whichever is higher will be charged on overdue amounts from the invoice due date.
3. All disputes subject to Delhi jurisdiction.
4. Goods once sold will not be taken back.

Thanks for doing business with us!`,
  );

  const [notes, setNotes] = useState("");
  const [formLogoSrc, setFormLogoSrc] = useState(dynacleanLogo.src);
  const [formLogoErrorStep, setFormLogoErrorStep] = useState(0);

  const handleFormLogoError = () => {
    if (formLogoErrorStep === 0) { setFormLogoSrc("/logo1.jpg"); setFormLogoErrorStep(1); return; }
    if (formLogoErrorStep === 1) { setFormLogoSrc("/logo.jpg"); setFormLogoErrorStep(2); return; }
    if (formLogoErrorStep === 2) { setFormLogoSrc("/logo.png"); setFormLogoErrorStep(3); return; }
    if (formLogoErrorStep === 3) { setFormLogoSrc("https://dynacleanindustries.com/logo1.jpg"); setFormLogoErrorStep(4); return; }
    setFormLogoSrc("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const itemsWithTotals = items.map((item) => {
        const qty = item.quantity || 0;
        const rate = item.rate || 0;
        const discountAmount = item.discount_amount || 0;
        const taxableValue = qty * rate - discountAmount;
        const cgstAmount = (taxableValue * (item.cgst_percent || 0)) / 100;
        const sgstAmount = (taxableValue * (item.sgst_percent || 0)) / 100;
        const igstAmount = (taxableValue * (item.igst_percent || 0)) / 100;
        const totalAmount = taxableValue + cgstAmount + sgstAmount + igstAmount;
        return { ...item, taxable_value: taxableValue, cgst_amount: cgstAmount, sgst_amount: sgstAmount, igst_amount: igstAmount, total_amount: totalAmount };
      });

      const amountPaid = Number(form.amount_paid || 0);
      const balanceAmount = taxSummary.grandTotal - amountPaid;

      let finalPaymentStatus = form.payment_status;
      if (balanceAmount === 0 && taxSummary.grandTotal > 0) finalPaymentStatus = "PAID";
      else if (balanceAmount > 0 && balanceAmount < taxSummary.grandTotal) finalPaymentStatus = "PARTIAL";
      else if (balanceAmount >= taxSummary.grandTotal) finalPaymentStatus = "UNPAID";

      const dataToSend = {
        ...form,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        invoice_type: invoiceType,
        items: itemsWithTotals,
        subtotal: taxSummary.subtotal,
        cgst: taxSummary.cgst,
        sgst: taxSummary.sgst,
        igst: taxSummary.igst,
        total_tax: taxSummary.totalTax,
        round_off: parseFloat(roundOff) || 0,
        grand_total: taxSummary.grandTotal,
        amount_paid: amountPaid,
        balance_amount: balanceAmount < 0 ? 0 : balanceAmount,
        payment_status: finalPaymentStatus,
        notes,
        terms_conditions: editableTerms,
        cgst_rate: cgstRate,
        sgst_rate: sgstRate,
        igst_rate: igstRate,
        linked_trans_ids: linkedTransIds.length > 0 ? linkedTransIds : null,
      };

      const res = await fetch("/api/invoice-table", {
        method: "POST",
        body: JSON.stringify(dataToSend),
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      const created = res.ok && (data.success || data.invoiceNumber);
      if (created) {
        if (linkedTransIds.length > 0 && data.invoiceNumber) {
          try {
            await fetch("/api/statements", {
              method: "PATCH",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                trans_ids: linkedTransIds,
                invoice_number: data.invoiceNumber,
                invoice_id: data.invoiceId,
                invoice_status: "Settled",
              }),
            });
          } catch (patchErr) {
            console.error("Failed to link statements:", patchErr);
          }
        }
        toast.success("Invoice created successfully");
        const redirectAfterOrder = resolveOrderListRedirectAfterInvoiceCreate({
          onSuccessRedirect,
          orderId,
          initialOrderId,
          buyersOrderNo: form.buyers_order_no,
          pathname,
        });
        if (redirectAfterOrder) {
          navigateAfterInvoiceCreate(router, redirectAfterOrder);
          return;
        }
        if (invoiceType === "performa") {
          router.push("/accounts-dashboard/performa-invoices");
        } else {
          router.push("/accounts-dashboard/invoices");
        }
      } else {
        alert("Error: " + (data.error || "Failed to create invoice"));
      }
    } catch (error) {
      console.error("Error submitting invoice:", error);
      toast.error("Failed to submit invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchQuotationAndFill = async (quoteNoArg) => {
    const raw =
      typeof quoteNoArg === "string" || typeof quoteNoArg === "number"
        ? quoteNoArg
        : quotationNumber;
    const qn = String(raw ?? "").trim();
    if (!qn) {
      toast.error("Enter quotation number");
      return;
    }

    try {
      const res = await fetch(
        `/api/get-quotation?quotation_number=${encodeURIComponent(qn)}`,
      );
      const data = await res.json();

      if (!data.success) { toast.error(data.error || "Quotation not found"); return; }

      const quotation = data.quotation;

      setIsFromQuotation(true);

      const nextForm = {
        customer_name: quotation.customer_name,
        customer_email: quotation.customer_email,
        customer_phone: quotation.customer_contact,
        billing_address: quotation.billing_address,
        shipping_address: quotation.shipping_address,
        gst_number: quotation.gst_number,
        state: quotation.state,
        state_code:
          quotation.state_code ||
          getStateCodeFromGstin(quotation.gst_number) ||
          "",
        customer_id: quotation.customer_id,
        quotation_id: quotation.quotation_id,
        due_date: quotation.due_date ? quotation.due_date.split("T")[0] : "",
      };

      setForm((prev) => ({ ...prev, ...nextForm }));

      const interstate = isInterstateInvoiceSupply({
        buyerGstin: nextForm.gst_number,
        buyerStateCode: nextForm.state_code,
        stateDisplay: nextForm.state,
        parseCodeFromDisplay,
      });

      const mappedItems = quotation.items.map((it) => {
        const cg = Number(it.cgst_percent) || 0;
        const sg = Number(it.sgst_percent) || 0;
        const ig = Number(it.igst_percent) || 0;
        return {
          item_name: it.item_name || "",
          item_code: it.item_code || "",
          description: it.specification || it.description || "",
          hsn_code: it.hsn_sac || it.hsn_code || "",
          quantity: it.quantity || 1,
          unit: it.unit || "",
          rate: it.rate || it.price_per_unit || 0,
          discount_percent: it.discount_percent || 0,
          discount_amount: it.discount_amount || 0,
          cgst_percent: cg,
          sgst_percent: sg,
          igst_percent: ig,
          gst: ig || cg + sg || 18,
          imageUrl: it.img_url || "",
        };
      });

      setItems(applyTaxPercentsToInvoiceItems(mappedItems, interstate));
      const rates = headerRatesForInterstate(interstate);
      setCgstRate(rates.cgstRate);
      setSgstRate(rates.sgstRate);
      setIgstRate(rates.igstRate);

      if (quotation.round_off) setRoundOff(Number(quotation.round_off) || 0);

      toast.success("Quotation loaded successfully");
      setShowQuotationModal(false);
      setQuotationNumber(qn);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load quotation");
    }
  };

  useEffect(() => {
    const qn = String(initialQuotationNumber || "").trim();
    if (!qn || autoFilledQuoteRef.current) return;
    autoFilledQuoteRef.current = true;
    void fetchQuotationAndFill(qn);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time autofill from order link
  }, [initialQuotationNumber]);

  useEffect(() => {
    const oid = String(initialOrderId || "").trim();
    if (!oid) return;
    setOrderId(oid);
    setForm((prev) => ({
      ...prev,
      buyers_order_no: prev.buyers_order_no || oid,
    }));
  }, [initialOrderId]);

  return (
    <>
      <div className="p-5 w-full flex justify-between items-center">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="bg-gray-600 px-4 py-2 rounded text-white cursor-pointer hover:bg-gray-700 transition-colors"
          >
            Back
          </button>
        )}
        <div className="flex flex-wrap gap-2 ml-auto">
          <button
            type="button"
            className="bg-blue-600 px-4 py-2 rounded text-white cursor-pointer hover:bg-blue-700"
            onClick={() => setShowPaymentLinkModal(true)}
          >
            Payment Link
          </button>
          <button
            type="button"
            className="bg-green-500 px-4 py-2 rounded text-white cursor-pointer hover:bg-green-600"
            onClick={() => setShowQuotationModal(true)}
          >
            Add with quotation number
          </button>
        </div>
      </div>

      {linkedTransIds.length > 0 && (
        <div className="mx-4 flex flex-wrap items-center gap-2 bg-blue-50 border border-blue-200 rounded p-3">
          <span className="text-xs font-semibold text-blue-700 mr-1">
            Linked payments:
          </span>
          {linkedTransIds.map((tid) => (
            <span
              key={tid}
              className="flex items-center gap-1 bg-blue-100 text-blue-800 text-xs font-mono px-2 py-1 rounded-full"
            >
              {tid}
              <button
                type="button"
                onClick={() =>
                  setLinkedTransIds((prev) => prev.filter((t) => t !== tid))
                }
                className="ml-1 text-blue-500 hover:text-red-500 font-bold leading-none"
              >
                &times;
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => setLinkedTransIds([])}
            className="text-xs text-red-500 hover:underline ml-auto"
          >
            Clear all
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl mx-auto px-4 text-gray-800">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border p-4 rounded bg-gray-50 gap-4">
          {formLogoSrc ? (
            <img src={formLogoSrc} alt="Dynaclean Logo" width={120} height={80} className="object-contain" onError={handleFormLogoError} />
          ) : (
            <div className="w-[120px] h-[80px] border border-gray-200 flex items-center justify-center text-xs font-semibold text-red-600">DYNACLEAN</div>
          )}
          <LetterheadCompanyInfo />
        
        </div>

        {/* Invoice Info */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-gray-50 p-4 rounded">
          <div>
            <label className="text-sm text-gray-600">{invoiceTypeLabel} No.</label>
            <input type="text" value={invoiceNumber} readOnly className="input w-full bg-gray-100" />
          </div>
          <div>
            <label className="text-sm text-gray-600">{invoiceTypeLabel} Date</label>
            <input type="date" value={invoiceDate} readOnly className="input w-full bg-gray-100" />
          </div>
          <div>
            <label className="text-sm text-gray-600">Order Date</label>
            <input type="date" value={form.order_date} className="input w-full" onChange={(e) => setForm({ ...form, order_date: e.target.value })} />
          </div>
          <div>
            <label className="text-sm text-gray-600">Due Date</label>
            <input
              type="date"
              value={form.due_date}
              readOnly={isFromQuotation}
              className={`input w-full ${isFromQuotation ? "bg-gray-100 cursor-not-allowed" : ""}`}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              required
            />
          </div>
        </div>

        {(quotationNumber || orderId) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-emerald-50/80 p-4 rounded border border-emerald-100">
            <div>
              <label className="text-sm text-gray-600">Quotation Number</label>
              <input
                type="text"
                value={quotationNumber}
                readOnly
                className="input w-full bg-gray-100"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">Order ID</label>
              <input
                type="text"
                value={orderId}
                readOnly
                className="input w-full bg-gray-100"
              />
            </div>
          </div>
        )}

        {/* Order Reference */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 p-4 rounded">
          <div>
            <label className="text-sm text-gray-600">Buyer&apos;s order</label>
            <input type="text" className="input w-full" value={form.buyers_order_no} onChange={(e) => setForm({ ...form, buyers_order_no: e.target.value })} placeholder="Buyer's order no." />
          </div>
          <div>
            <label className="text-sm text-gray-600">E-way bill no.</label>
            <input type="text" className="input w-full" value={form.eway_bill_no} onChange={(e) => setForm({ ...form, eway_bill_no: e.target.value })} placeholder="E-way bill no." />
          </div>
          <div>
            <label className="text-sm text-gray-600">Delivery challan no.</label>
            <input type="text" className="input w-full" value={form.delivery_challan_no} onChange={(e) => setForm({ ...form, delivery_challan_no: e.target.value })} placeholder="Delivery challan no." />
          </div>
        </div>

        {/* Customer Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input type="text" placeholder="Customer Name *" className="w-full input" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} required />
          <input type="email" placeholder="Customer Email" className="input w-full" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
          <input type="tel" placeholder="Customer Phone" className="input w-full" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
          <input type="text" placeholder="Customer ID" className="input w-full" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} />
          <input type="text" placeholder="Billing Address *" className="input w-full" value={form.billing_address} onChange={(e) => setForm({ ...form, billing_address: e.target.value })} required />
          <input type="text" placeholder="Shipping Address" className="input w-full" value={form.shipping_address} onChange={(e) => setForm({ ...form, shipping_address: e.target.value })} />
          <input type="text" placeholder="Consignee Name" className="input w-full" value={form.Consignee} onChange={(e) => setForm({ ...form, Consignee: e.target.value })} />
          <input type="text" placeholder="Consignee Contact" className="input w-full" value={form.Consignee_Contact} onChange={(e) => setForm({ ...form, Consignee_Contact: e.target.value })} />
          <input type="text" placeholder="GSTIN" className="input w-full" value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value })} />

          {getStateFromGSTIN(form.gst_number?.trim()) ? (
            <input type="text" placeholder="State" className="input w-full bg-gray-100" value={form.state} readOnly />
          ) : (
            <div className="relative">
              <input
                type="text"
                placeholder="Select State (Searchable)"
                className="input w-full"
                value={stateSearch || form.state}
                onChange={(e) => {
                  const q = e.target.value;
                  setStateSearch(q);
                  const filtered = allStates.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()) || s.code.includes(q));
                  setStateSuggestions(filtered.slice(0, 10));
                  setShowStateSuggestions(true);
                  setForm((prev) => ({ ...prev, state: q }));
                }}
                onFocus={() => { setShowStateSuggestions(true); setStateSuggestions(allStates.slice(0, 10)); }}
                autoComplete="off"
              />
              {showStateSuggestions && stateSuggestions.length > 0 && (
                <ul className="absolute z-10 bg-white border shadow-sm rounded mt-1 max-h-40 overflow-y-auto w-full text-sm">
                  {stateSuggestions.map((s, idx) => (
                    <li
                      key={`${s.code}-${idx}`}
                      className="px-3 py-2 hover:bg-emerald-100 cursor-pointer"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, state: s.display, state_code: s.code }));
                        setStateSearch(s.display);
                        setShowStateSuggestions(false);
                      }}
                    >
                      <strong>{s.name}</strong> ({s.code})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div>
            <label className="text-sm text-gray-600">Amount Paid</label>
            <input type="number" min="0" className="input w-full bg-gray-100 cursor-not-allowed" value={form.amount_paid} readOnly tabIndex={-1} title="Set via Payment Link or quotation load" />
          </div>
          <div>
            <label className="text-sm text-gray-600">Payment Status</label>
            <select className="input w-full" value={form.payment_status} onChange={(e) => setForm({ ...form, payment_status: e.target.value })} required>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIAL">Partial</option>
              <option value="PAID">Paid</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <AddSpecialPriceModal customerId={form.customer_id} buttonLabel="Set Special Price" />
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

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mt-6">
          <div className="lg:col-span-2 border p-4 rounded bg-gray-50">
            <h4 className="font-semibold text-base mb-2 text-gray-800">Notes</h4>
            <textarea rows={8} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add any additional notes here..." className="w-full text-sm p-2 border rounded resize-y" />
          </div>
          <div className="lg:col-span-2 border p-4 rounded bg-gray-50">
            <h4 className="font-semibold text-base mb-2 text-gray-800">Terms &amp; Conditions</h4>
            <textarea rows={8} value={editableTerms} onChange={(e) => setEditableTerms(e.target.value)} className="w-full text-sm p-2 border rounded resize-y" />
          </div>
          <div className="lg:col-span-1 space-y-4">
            <div className="border p-4 rounded bg-gray-50 text-sm">
              <h4 className="font-semibold mb-2">Bank Details</h4>
              <LetterheadBankLine />
              <p>ICICI Bank</p>
              <p>Account: 343405500379</p>
              <p>IFSC: ICIC0003434</p>
            </div>
            <div className="border p-4 rounded bg-gray-50 text-sm text-center flex flex-col justify-between">
              <div>
                <LetterheadSignatoryLine />
                <Image src="/images/sign.png" alt="Sign" width={100} height={80} className="mx-auto mt-2" unoptimized />
              </div>
              <p className="mt-2 font-semibold">Authorized Signatory</p>
            </div>
          </div>
        </div>

        <div className="text-center">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`px-8 py-3 font-semibold rounded shadow w-full sm:w-auto transition-all duration-200 ${
              isSubmitting ? "bg-emerald-300 cursor-wait pointer-events-none" : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
          >
            {isSubmitting ? "Submitting..." : "Create Invoice"}
          </button>
        </div>
      </form>

      <PaymentLinkModal
        open={showPaymentLinkModal}
        onClose={() => setShowPaymentLinkModal(false)}
        defaultCustomerId={form.customer_id}
        defaultAmount={taxSummary.grandTotal}
        lockedTransIds={linkedTransIds}
        currentInvoiceNumber={invoiceNumber}
        onApply={(transIds, paymentStatus, amountPaid) => {
          setLinkedTransIds(transIds);
          setInvoicePaymentStatus(paymentStatus || "Unsettled");
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
          } else {
            setForm((prev) => ({
              ...prev,
              amount_paid: 0,
              payment_status: "UNPAID",
            }));
          }
        }}
      />

      {showQuotationModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded w-full max-w-md">
            <h3 className="text-lg font-semibold mb-3">Create Invoice from Quotation</h3>
            <input
              type="text"
              placeholder="Enter Quotation Number"
              className="input w-full"
              value={quotationNumber}
              onChange={(e) => setQuotationNumber(e.target.value)}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button className="px-4 py-2 border rounded" onClick={() => setShowQuotationModal(false)}>Cancel</button>
              <button className="px-4 py-2 bg-emerald-600 text-white rounded" onClick={fetchQuotationAndFill}>Load Quotation</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
