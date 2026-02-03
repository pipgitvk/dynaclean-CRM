"use client";

import { useEffect, useState, useMemo } from "react";
import InvoiceItemsTable from "./invoice-table";
import TaxAndSummary from "./Tax-invoice";
import { useRouter } from "next/navigation";
import Image from "next/image";
import toast from "react-hot-toast";

export default function InvoiceForm({ invoiceNumber, invoiceDate }) {
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ showQuotationModal, setShowQuotationModal]= useState(false)
  const [quotationNumber, setQuotationNumber] = useState("")

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
  });

  const [cgstRate, setCgstRate] = useState(9);
  const [sgstRate, setSgstRate] = useState(9);
  const [igstRate, setIgstRate] = useState(0);

  // Supplier state is fixed
  const SUPPLIER_STATE_CODE = "07";
  const SUPPLIER_STATE_NAME = "Delhi";

  // State code to name map (GST state codes)
    const stateCodeToName = useMemo(
    () => ({
      "01": "Jammu & Kashmir",
      "02": "Himachal Pradesh",
      "03": "Punjab",
      "04": "Chandigarh",
      "05": "Uttarakhand",
      "06": "Haryana",
      "07": "Delhi",
      "08": "Rajasthan",
      "09": "Uttar Pradesh",
      "10": "Bihar",
      "11": "Sikkim",
      "12": "Arunachal Pradesh",
      "13": "Nagaland",
      "14": "Manipur",
      "15": "Mizoram",
      "16": "Tripura",
      "17": "Meghalaya",
      "18": "Assam",
      "19": "West Bengal",
      "20": "Jharkhand",
      "21": "Odisha",
      "22": "Chhattisgarh",
      "23": "Madhya Pradesh",
      "24": "Gujarat",
      "25": "Daman & Diu",
      "26": "Dadra & Nagar Haveli",
      "27": "Maharashtra",
      "28": "Andhra Pradesh (Old)",
      "29": "Karnataka",
      "30": "Goa",
      "31": "Lakshadweep",
      "32": "Kerala",
      "33": "Tamil Nadu",
      "34": "Puducherry",
      "35": "Andaman & Nicobar Islands",
      "36": "Telangana",
      "37": "Andhra Pradesh",
      "97": "Other Territory",
      "99": "Centre Jurisdiction",
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
    const grandTotal = subtotal + totalTax;

    return { subtotal, cgst, sgst, igst, totalTax, grandTotal };
  }, [items, cgstRate, sgstRate, igstRate]);

  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(true);


  useEffect(() => {
    const code = form.state_code || parseCodeFromDisplay(form.state);

    if (!code) return;

    if (code === SUPPLIER_STATE_CODE) {
      setCgstRate(9);
      setSgstRate(9);
      setIgstRate(0);

      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          cgst_percent: 9,
          sgst_percent: 9,
          igst_percent: 0,
        })),
      );
    } else {
      setCgstRate(0);
      setSgstRate(0);
      setIgstRate(18);

      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          cgst_percent: 0,
          sgst_percent: 0,
          igst_percent: 18,
        })),
      );
    }
  }, [form.state, form.state_code]);

  const [editableTerms, setEditableTerms] = useState(
    `1. Payment due within specified due date.
2. Late payment charges: Interest charges at the rate of 1.5% per month or as per MSME act 2006, whichever is higher will be charged on overdue amounts from the invoice due date.
3. All disputes subject to Delhi jurisdiction.
4. Goods once sold will not be taken back.

Thanks for doing business with us!`,
  );

  const [notes, setNotes] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Calculate item-level totals
      const itemsWithTotals = items.map((item) => {
        const qty = item.quantity || 0;
        const rate = item.rate || 0;
        const discountAmount = item.discount_amount || 0;
        const taxableValue = qty * rate - discountAmount;

        const cgstAmount = (taxableValue * (item.cgst_percent || 0)) / 100;
        const sgstAmount = (taxableValue * (item.sgst_percent || 0)) / 100;
        const igstAmount = (taxableValue * (item.igst_percent || 0)) / 100;
        const totalAmount = taxableValue + cgstAmount + sgstAmount + igstAmount;

        return {
          ...item,
          taxable_value: taxableValue,
          cgst_amount: cgstAmount,
          sgst_amount: sgstAmount,
          igst_amount: igstAmount,
          total_amount: totalAmount,
        };
      });

      const dataToSend = {
        ...form,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        items: itemsWithTotals,
        subtotal: taxSummary.subtotal,
        cgst: taxSummary.cgst,
        sgst: taxSummary.sgst,
        igst: taxSummary.igst,
        total_tax: taxSummary.totalTax,
        grand_total: taxSummary.grandTotal,
        amount_paid: 0,
        balance_amount: taxSummary.grandTotal,
        notes: notes,
        terms_conditions: editableTerms,
      };

      console.log("Data being sent to API:", dataToSend);

      const res = await fetch("/api/invoice-table", {
        method: "POST",
        body: JSON.stringify(dataToSend),
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (data.success) {
        toast.success("✅ Invoice created successfully");
        router.push("/admin-dashboard/invoices");
      } else {
        alert("Error: " + data.error);
      }
    } catch (error) {
      console.error("Error submitting invoice:", error);
      toast.error("Failed to submit invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

  // fetch data with quotation number 
const fetchQuotationAndFill = async () => {
  if (!quotationNumber) {
    toast.error("Enter quotation number");
    return;
  }

  try {
    const res = await fetch(
      `/api/get-quotation?quotation_number=${quotationNumber}`
    );
    const data = await res.json();
    console.log("check what data :", data);

    if (!data.success) {
      toast.error(data.error || "Quotation not found");
      return;
    }

    const quotation = data.quotation;

    // Fill only available quotation fields
    setForm((prev) => ({
      ...prev,
      customer_name: quotation.customer_name,
      customer_email: quotation.customer_email,
      customer_phone: quotation.customer_phone,
      billing_address: quotation.billing_address,
      shipping_address: quotation.shipping_address,
      gst_number: quotation.gst_number,
      state: quotation.state,
      state_code: quotation.state_code,
      customer_id: quotation.customer_id,
      quotation_id: quotation.quotation_number, 
    }));

    // Fill items from quotation
   setItems(
  quotation.items.map((it) => ({
    item_name: it.item_name || "",
    item_code: it.item_code || "",        
    description: it.description || "",
    hsn_code: it.hsn_code || "",
    quantity: it.quantity || 1,
    unit: it.unit || "",                  
    rate: it.rate || it.price_per_unit || 0,
    discount_percent: it.discount_percent || 0,
    discount_amount: it.discount_amount || 0,

    cgst_percent: it.cgst_percent || 0,
    sgst_percent: it.sgst_percent || 0,
    igst_percent: it.igst_percent || 0,

    imageUrl: it.img_url || "",             
  }))
);


    toast.success("Quotation loaded successfully");
    setQuotationNumber("");
    setShowQuotationModal(false);
  } catch (err) {
    console.error(err);
    toast.error("Failed to load quotation");
  }
};



  return (
    <>
    <div className="p-5 w-full flex justify-end">
      <button  className="bg-green-500 px-4 py-2 rounded text-white cursor-pointer"  onClick={() => setShowQuotationModal(true)}>Add with quotation number</button>
    </div>
    <form
      onSubmit={handleSubmit}
      className="space-y-6 max-w-5xl mx-auto px-4 text-gray-800"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border p-4 rounded bg-gray-50 gap-4">
        <Image
          src="/logo1.jpg"
          alt="Dynaclean Logo"
          width={120}
          height={80}
          className="object-contain"
          unoptimized
        />

        <div className="flex-1 text-sm text-gray-700">
          <h2 className="text-xl font-bold text-red-600 mb-1">
            Dynaclean Industries Pvt Ltd
          </h2>
          <p className="leading-relaxed">
            <span className="block">
              1st Floor, 13-B, Kattabomman Street, Gandhi Nagar Main Road,
            </span>
            <span className="block">
              Gandhi Nagar, Ganapathy, Coimbatore, Tamil Nadu, 641006
            </span>
            <span className="block mt-1">
              <strong>Phone:</strong> 011-45143666, +91-7982456944
            </span>
            <span className="block">
              <strong>Email:</strong> sales@dynacleanindustries.com
            </span>
            <span className="block mt-1">
              <strong>GSTIN:</strong> 07AAKCD6495M1ZV | <strong>State:</strong>{" "}
              Tamil Nadu (33)
            </span>
          </p>
        </div>
      </div>

      {/* Invoice Info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 p-4 rounded">
        <div>
          <label className="text-sm text-gray-600">Invoice No.</label>
          <input
            type="text"
            value={invoiceNumber}
            readOnly
            className="input w-full bg-gray-100"
          />
        </div>
        <div>
          <label className="text-sm text-gray-600">Invoice Date</label>
          <input
            type="date"
            value={invoiceDate}
            readOnly
            className="input w-full bg-gray-100"
          />
        </div>
        <div>
          <label className="text-sm text-gray-600">Due Date</label>
          <input
            type="date"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            className="input w-full"
            required
          />
        </div>
      </div>

      {/* Customer Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Customer Name *"
          className="w-full input"
          value={form.customer_name}
          onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
          required
        />

        <input
          type="email"
          placeholder="Customer Email"
          className="input w-full"
          value={form.customer_email}
          onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
        />

        <input
          type="tel"
          placeholder="Customer Phone"
          className="input w-full"
          value={form.customer_phone}
          onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
        />

        <input
          type="text"
          placeholder="Customer ID"
          className="input w-full"
          value={form.customer_id}
          onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
        />

        <input
          type="text"
          placeholder="Billing Address *"
          className="input w-full"
          value={form.billing_address}
          onChange={(e) =>
            setForm({ ...form, billing_address: e.target.value })
          }
          required
        />
        {/* <input
          type="text"
          placeholder="Billing State"
          className="input w-full"
          value={form.billing_state}
          onChange={(e) => setForm({ ...form, billing_state: e.target.value })}
        /> */}
        {/* <input
          type="text"
          placeholder="Billing Country"
          className="input w-full"
          value={form.billing_country}
          onChange={(e) =>
            setForm({ ...form, billing_country: e.target.value })
          }
        /> */}

        <input
          type="text"
          placeholder="Shipping Address"
          className="input w-full"
          value={form.shipping_address}
          onChange={(e) =>
            setForm({ ...form, shipping_address: e.target.value })
          }
        />
        {/* <input
          type="text"
          placeholder="Shipping State"
          className="input w-full"
          value={form.shipping_state}
          onChange={(e) => setForm({ ...form, shipping_state: e.target.value })}
        /> */}
        {/* <input
          type="text"
          placeholder="Shipping Country"
          className="input w-full"
          value={form.shipping_country}
          onChange={(e) =>
            setForm({ ...form, shipping_country: e.target.value })
          }
        /> */}
        <input
          type="text"
          placeholder="Consignee Name"
          className="input w-full"
          value={form.Consignee}
          onChange={(e) => setForm({ ...form, Consignee: e.target.value })}
        />
        <input
          type="text"
          placeholder="Consignee Contact"
          className="input w-full"
          value={form.Consignee_Contact}
          onChange={(e) =>
            setForm({ ...form, Consignee_Contact: e.target.value })
          }
        />

        <input
          type="text"
          placeholder="GSTIN"
          className="input w-full"
          value={form.gst_number}
          onChange={(e) => setForm({ ...form, gst_number: e.target.value })}
        />

        {getStateFromGSTIN(form.gst_number?.trim()) ? (
          <input
            type="text"
            placeholder="State"
            className="input w-full bg-gray-100"
            value={form.state}
            readOnly
          />
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
                const filtered = allStates.filter(
                  (s) =>
                    s.name.toLowerCase().includes(q.toLowerCase()) ||
                    s.code.includes(q),
                );
                setStateSuggestions(filtered.slice(0, 10));
                setShowStateSuggestions(true);
                setForm((prev) => ({ ...prev, state: q }));
              }}
              onFocus={() => {
                setShowStateSuggestions(true);
                setStateSuggestions(allStates.slice(0, 10));
              }}
              autoComplete="off"
            />
            {showStateSuggestions && stateSuggestions.length > 0 && (
              <ul className="absolute z-10 bg-white border shadow-sm rounded mt-1 max-h-40 overflow-y-auto w-full text-sm">
                {stateSuggestions.map((s, idx) => (
                  <li
                    key={`${s.code}-${idx}`}
                    className="px-3 py-2 hover:bg-emerald-100 cursor-pointer"
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        state: s.display,
                        state_code: s.code,
                      }));
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
          <label className="text-sm text-gray-600">Payment Status</label>
          <select
            className="input w-full"
            value={form.payment_status}
            onChange={(e) =>
              setForm({ ...form, payment_status: e.target.value })
            }
            required
          >
            <option value="UNPAID">Unpaid</option>
            <option value="PARTIAL">Partial</option>
            <option value="PAID">Paid</option>
          </select>
        </div>
      </div>

      {/* Invoice Items Table */}
      <InvoiceItemsTable items={items} setItems={setItems} />

      {/* Tax Summary */}
      <TaxAndSummary
        items={items}
        subtotal={taxSummary.subtotal}
        cgst={taxSummary.cgst}
        sgst={taxSummary.sgst}
        igst={taxSummary.igst}
        grandTotal={taxSummary.grandTotal}
        cgstRate={cgstRate}
        sgstRate={sgstRate}
        igstRate={igstRate}
        setCgstRate={setCgstRate}
        setSgstRate={setSgstRate}
        setIgstRate={setIgstRate}
      />

      {/* Notes, Terms & Bank Details */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mt-6">
        {/* Notes */}
        <div className="lg:col-span-2 border p-4 rounded bg-gray-50">
          <h4 className="font-semibold text-base mb-2 text-gray-800">Notes</h4>
          <textarea
            rows={8}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any additional notes here..."
            className="w-full text-sm p-2 border rounded resize-y"
          />
        </div>

        {/* Terms & Conditions */}
        <div className="lg:col-span-2 border p-4 rounded bg-gray-50">
          <h4 className="font-semibold text-base mb-2 text-gray-800">
            Terms & Conditions
          </h4>
          <textarea
            rows={8}
            value={editableTerms}
            onChange={(e) => setEditableTerms(e.target.value)}
            className="w-full text-sm p-2 border rounded resize-y"
          />
        </div>

        {/* Bank Details & Signatory */}
        <div className="lg:col-span-1 space-y-4">
          <div className="border p-4 rounded bg-gray-50 text-sm">
            <h4 className="font-semibold mb-2">Bank Details</h4>
            <p>A/C Holder: Dynaclean Industries Private Limited</p>
            <p>ICICI Bank</p>
            <p>Account: 343405500379</p>
            <p>IFSC: ICIC0003434</p>
          </div>

          <div className="border p-4 rounded bg-gray-50 text-sm text-center flex flex-col justify-between">
            <div>
              <p>For Dynaclean Industries Pvt Ltd</p>
              <Image
                src="/images/sign.png"
                alt="Sign"
                width={100}
                height={80}
                className="mx-auto mt-2"
                unoptimized
              />
            </div>
            <p className="mt-2 font-semibold">Authorized Signatory</p>
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="text-center">
        <button
          type="submit"
          disabled={isSubmitting}
          className={`px-8 py-3 font-semibold rounded shadow w-full sm:w-auto transition-all duration-200 ${
            isSubmitting
              ? "bg-emerald-300 cursor-wait pointer-events-none"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          }`}
        >
          {isSubmitting ? "Submitting..." : "Create Invoice"}
        </button>
      </div>
    </form>

    {showQuotationModal && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded w-full max-w-md">
      <h3 className="text-lg font-semibold mb-3">
        Create Invoice from Quotation
      </h3>

      <input
        type="text"
        placeholder="Enter Quotation Number"
        className="input w-full"
        value={quotationNumber}
        onChange={(e) => setQuotationNumber(e.target.value)}
      />

      <div className="flex justify-end gap-3 mt-4">
        <button
          className="px-4 py-2 border rounded"
          onClick={() => setShowQuotationModal(false)}
        >
          Cancel
        </button>

        <button
          className="px-4 py-2 bg-emerald-600 text-white rounded"
          onClick={fetchQuotationAndFill}
        >
          Load Quotation
        </button>
      </div>
    </div>
  </div>
)}

    </>
  );
}
