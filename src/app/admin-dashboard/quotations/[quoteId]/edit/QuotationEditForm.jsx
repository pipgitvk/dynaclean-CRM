"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import toast from "react-hot-toast";
import QuotationItemsTable from "@/app/admin-dashboard/quotations/new/quotation-table";
import TaxAndSummary from "@/app/admin-dashboard/quotations/new/TaxAndSummary";

export default function QuotationEditForm({ quoteId }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    company: "",
    company_location: "",
    gstin_no: "",
    state_name: "",
    ship_to: "",
    customer_id: "",
    terms: "",
    payment_term_days: "",
  });
  const [quoteNumber, setQuoteNumber] = useState("");
  const [quoteDate, setQuoteDate] = useState("");
  const [cgstRate, setCgstRate] = useState(0);
  const [sgstRate, setSgstRate] = useState(0);
  const [igstRate, setIgstRate] = useState(0);
  const [roundOff, setRoundOff] = useState(0);
  const [isAutoRoundOff, setIsAutoRoundOff] = useState(true);
  const [editableTerms, setEditableTerms] = useState("");

  // State dropdown helpers (same as new form)
  const stateCodeToName = useMemo(
    () => ({
      "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
      "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana", "07": "Delhi",
      "08": "Rajasthan", "09": "Uttar Pradesh", 10: "Bihar", 11: "Sikkim",
      12: "Arunachal Pradesh", 13: "Nagaland", 14: "Manipur", 15: "Mizoram",
      16: "Tripura", 17: "Meghalaya", 18: "Assam", 19: "West Bengal",
      20: "Jharkhand", 21: "Odisha", 22: "Chhattisgarh", 23: "Madhya Pradesh",
      24: "Gujarat", 25: "Daman & Diu", 26: "Dadra & Nagar Haveli",
      27: "Maharashtra", 28: "Andhra Pradesh (Old)", 29: "Karnataka", 30: "Goa",
      31: "Lakshadweep", 32: "Kerala", 33: "Tamil Nadu", 34: "Puducherry",
      35: "Andaman & Nicobar Islands", 36: "Telangana", 37: "Andhra Pradesh",
      97: "Other Territory", 99: "Centre Jurisdiction",
    }),
    [],
  );

  const allStates = useMemo(
    () =>
      Object.entries(stateCodeToName).map(([code, name]) => ({
        code,
        name,
        display: `${name} (${code})`,
      })),
    [stateCodeToName],
  );

  const [stateSearch, setStateSearch] = useState("");
  const [stateSuggestions, setStateSuggestions] = useState([]);
  const [showStateSuggestions, setShowStateSuggestions] = useState(false);

  const SUPPLIER_STATE_CODE = "07";

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

  // Load existing quotation data
  useEffect(() => {
    const fetchQuote = async () => {
      try {
        const res = await fetch(`/api/quotations/${encodeURIComponent(quoteId)}`);
        const data = await res.json();
        if (!data.success) {
          toast.error("Quotation not found");
          router.push("/admin-dashboard/quotations");
          return;
        }

        const h = data.header;
        setQuoteNumber(h.quote_number);
        setQuoteDate(h.quote_date ? h.quote_date.split("T")[0] : "");
        setForm({
          company: h.company_name || "",
          company_location: h.company_address || "",
          gstin_no: h.gstin || "",
          state_name: h.state || "",
          ship_to: h.ship_to || "",
          customer_id: h.customer_id || "",
          terms: h.term_con || "",
          payment_term_days: h.payment_term_days?.toString() || "",
        });
        setEditableTerms(h.term_con || "");
        setCgstRate(parseFloat(h.cgst_rate) || 0);
        setSgstRate(parseFloat(h.sgst_rate) || 0);
        setIgstRate(parseFloat(h.igst_rate) || 0);
        setRoundOff(parseFloat(h.round_off) || 0);

        // Map DB items to form items shape
        const mappedItems = (data.items || []).map((item) => ({
          productCode: item.item_code || "",
          imageUrl: item.img_url || "",
          name: item.item_name || "",
          hsn: item.hsn_sac || "",
          specification: item.specification || "",
          unit: item.unit || "",
          quantity: parseFloat(item.quantity) || 1,
          price: parseFloat(item.price_per_unit) || 0,
          gst: parseFloat(item.gst) || 18,
        }));
        setItems(mappedItems.length > 0 ? mappedItems : [
          { productCode: "", imageUrl: "", name: "", hsn: "", specification: "", unit: "", quantity: 1, price: 0, gst: 18 }
        ]);
      } catch (err) {
        console.error("Error loading quotation:", err);
        toast.error("Failed to load quotation");
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuote();
  }, [quoteId]);

  const taxSummary = useMemo(() => {
    let subtotal = 0;
    let totalTax = 0;

    items.forEach((item) => {
      const qty = item.quantity || 0;
      const price = item.price || 0;
      const taxable = qty * price;
      const gstAmt = taxable * ((item.gst || 0) / 100);
      subtotal += taxable;
      totalTax += gstAmt;
    });

    const isInterstate = (() => {
      const gstinValue = form.gstin_no?.trim();
      if (gstinValue) {
        const code = gstinValue.slice(0, 2);
        return code !== SUPPLIER_STATE_CODE;
      }
      // No GSTIN → check state
      const stateCode = parseCodeFromDisplay(form.state_name)
        || Object.entries(stateCodeToName).find(
            ([, name]) => name.toLowerCase() === form.state_name?.trim().toLowerCase()
          )?.[0];
      if (!stateCode) return false;
      return stateCode !== SUPPLIER_STATE_CODE;
    })();

    const cgst = isInterstate ? 0 : totalTax / 2;
    const sgst = isInterstate ? 0 : totalTax / 2;
    const igst = isInterstate ? totalTax : 0;

    const totalBeforeRound = subtotal + totalTax;
    let finalRoundOff = parseFloat(roundOff) || 0;

    if (isAutoRoundOff) {
      finalRoundOff = Math.round(totalBeforeRound) - totalBeforeRound;
    }

    const grandTotal = totalBeforeRound + finalRoundOff;
    return { subtotal, cgst, sgst, igst, totalTax, grandTotal, finalRoundOff };
  }, [items, roundOff, isAutoRoundOff, form.gstin_no, form.state_name]);

  useEffect(() => {
    if (isAutoRoundOff) {
      setRoundOff(parseFloat(taxSummary.finalRoundOff.toFixed(2)));
    }
  }, [taxSummary.finalRoundOff, isAutoRoundOff]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const itemsWithTotals = items.map((item) => {
        const taxable = item.quantity * item.price;
        const gstAmount = taxable * (item.gst / 100);
        const total = taxable + gstAmount;
        return { ...item, taxable_amount: taxable, total_amount: total, IGSTamt: gstAmount };
      });

      const isInterstate = taxSummary.igst > 0;

      // Derive effective rates from actual computed amounts
      const effectiveIgstRate = taxSummary.subtotal > 0 && taxSummary.igst > 0
        ? parseFloat(((taxSummary.igst / taxSummary.subtotal) * 100).toFixed(2))
        : 0;
      const effectiveCgstRate = taxSummary.subtotal > 0 && taxSummary.cgst > 0
        ? parseFloat(((taxSummary.cgst / taxSummary.subtotal) * 100).toFixed(2))
        : 0;
      const effectiveSgstRate = taxSummary.subtotal > 0 && taxSummary.sgst > 0
        ? parseFloat(((taxSummary.sgst / taxSummary.subtotal) * 100).toFixed(2))
        : 0;

      const dataToSend = {
        ...form,
        quote_date: quoteDate,
        items: itemsWithTotals,
        subtotal: taxSummary.subtotal,
        cgst: taxSummary.cgst,
        sgst: taxSummary.sgst,
        igst: taxSummary.igst,
        round_off: parseFloat(roundOff) || 0,
        grand_total: taxSummary.grandTotal,
        cgstRate: effectiveCgstRate,
        sgstRate: effectiveSgstRate,
        igstRate: effectiveIgstRate,
        terms: editableTerms,
      };

      const res = await fetch(`/api/quotations/${encodeURIComponent(quoteId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("✅ Quotation updated successfully");
        router.push("/admin-dashboard/quotations");
      } else {
        toast.error("Error: " + (data.message || "Update failed"));
      }
    } catch (error) {
      console.error("Error updating quotation:", error);
      toast.error("Failed to update quotation");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <p className="text-gray-500 text-lg">Loading quotation...</p>
      </div>
    );
  }

  const isInterstate = (() => {
    const gstinValue = form.gstin_no?.trim();
    if (gstinValue) {
      const gstState = getStateFromGSTIN(gstinValue);
      const buyerCode = gstState?.code;
      return buyerCode ? buyerCode !== SUPPLIER_STATE_CODE : false;
    }
    // No GSTIN → check state
    const stateCode = parseCodeFromDisplay(form.state_name)
      || Object.entries(stateCodeToName).find(
          ([, name]) => name.toLowerCase() === form.state_name?.trim().toLowerCase()
        )?.[0];
    if (!stateCode) return false;
    return stateCode !== SUPPLIER_STATE_CODE;
  })();

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl mx-auto px-4 text-gray-800">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Edit Quotation</h1>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-gray-500 hover:text-gray-700 text-sm underline"
        >
          ← Back
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border p-4 rounded bg-gray-50 gap-4">
        <Image
          src="/images/logo.png"
          alt="Dynaclean Logo"
          width={120}
          height={80}
          className="object-contain"
          unoptimized
        />
        <div className="flex-1 text-sm text-gray-700">
          <h2 className="text-xl font-bold text-red-600 mb-1">Dynaclean Industries Pvt Ltd</h2>
          <p className="leading-relaxed">
            <span className="block">1st Floor, 13-B, Kattabomman Street, Gandhi Nagar Main Road,</span>
            <span className="block">Gandhi Nagar, Ganapathy, Coimbatore, Tamil Nadu, 641006</span>
            <span className="block mt-1"><strong>Phone:</strong> 011-45143666, +91-7982456944</span>
            <span className="block"><strong>Email:</strong> sales@dynacleanindustries.com</span>
            <span className="block mt-1"><strong>GSTIN:</strong> 07AAKCD6495M1ZV | <strong>State:</strong> Tamil Nadu (33)</span>
          </p>
        </div>
      </div>

      {/* Quote Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded">
        <div>
          <label className="text-sm text-gray-600">Estimate No.</label>
          <input type="text" value={quoteNumber} readOnly className="input w-full bg-gray-100" />
        </div>
        <div>
          <label className="text-sm text-gray-600">Date</label>
          <input
            type="date"
            value={quoteDate}
            onChange={(e) => setQuoteDate(e.target.value)}
            className="input w-full"
          />
        </div>
      </div>

      {/* Company Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Company Name"
          className="input w-full"
          value={form.company}
          onChange={(e) => setForm({ ...form, company: e.target.value })}
          required
        />
        <input
          type="text"
          placeholder="Company Location"
          className="input w-full"
          value={form.company_location}
          onChange={(e) => setForm({ ...form, company_location: e.target.value })}
          required
        />
        <input
          type="text"
          placeholder="GSTIN"
          className="input w-full"
          value={form.gstin_no}
          onChange={(e) => setForm({ ...form, gstin_no: e.target.value })}
        />
        {getStateFromGSTIN(form.gstin_no?.trim()) ? (
          <input
            type="text"
            placeholder="State"
            className="input w-full bg-gray-100"
            value={form.state_name}
            readOnly
          />
        ) : (
          <div className="relative">
            <input
              type="text"
              placeholder="Select State (Searchable)"
              className="input w-full"
              value={stateSearch || form.state_name}
              onChange={(e) => {
                const q = e.target.value;
                setStateSearch(q);
                const filtered = allStates.filter(
                  (s) =>
                    s.name.toLowerCase().includes(q.toLowerCase()) ||
                    s.code.includes(q),
                );
                setStateSuggestions(filtered.slice(0, 10));
                setShowStateSuggestions(true);
                setForm((prev) => ({ ...prev, state_name: q }));
              }}
              onFocus={() => {
                setShowStateSuggestions(true);
                setStateSuggestions(allStates.slice(0, 10));
              }}
              autoComplete="off"
              required
            />
            {showStateSuggestions && stateSuggestions.length > 0 && (
              <ul className="absolute z-10 bg-white border shadow-sm rounded mt-1 max-h-40 overflow-y-auto w-full text-sm">
                {stateSuggestions.map((s, idx) => (
                  <li
                    key={`${s.code}-${idx}`}
                    className="px-3 py-2 hover:bg-emerald-100 cursor-pointer"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, state_name: s.display }));
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
        <input
          type="text"
          placeholder="Ship To"
          className="input w-full"
          value={form.ship_to}
          onChange={(e) => setForm({ ...form, ship_to: e.target.value })}
          required
        />
        <input
          type="text"
          placeholder="Customer ID"
          className="input w-full bg-gray-100 cursor-not-allowed"
          value={form.customer_id}
          readOnly
          title="Customer ID cannot be changed"
        />
        <div>
          <label className="text-sm text-gray-600">Payment Term (Days)</label>
          <select
            className="input w-full"
            value={form.payment_term_days}
            onChange={(e) => setForm({ ...form, payment_term_days: e.target.value })}
            required
          >
            <option value="">-- Select Payment Term --</option>
            <option value="0">Advance</option>
            <option value="9">COD</option>
            <option value="15">15 Days</option>
            <option value="30">30 Days</option>
            <option value="45">45 Days</option>
            <option value="60">60 Days</option>
          </select>
        </div>
      </div>

      {/* Items Table */}
      <QuotationItemsTable
        items={items}
        setItems={setItems}
        cgstRate={cgstRate}
        sgstRate={sgstRate}
        igstRate={igstRate}
      />

      {/* Tax Summary */}
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
        interstate={isInterstate}
      />

      {/* Terms & Conditions */}
      <div className="border p-4 rounded bg-gray-50">
        <h4 className="font-semibold text-base mb-2 text-gray-800">Terms & Conditions</h4>
        <textarea
          value={editableTerms}
          onChange={(e) => setEditableTerms(e.target.value)}
          className="w-full text-sm border rounded-md p-3 min-h-[140px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Submit */}
      <div className="flex gap-4 justify-end pb-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-8 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
        >
          {isSubmitting ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
