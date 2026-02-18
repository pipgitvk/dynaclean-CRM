"use client";

import { useEffect, useState, useMemo } from "react";
import QuotationItemsTable from "./quotation-table";
import TaxAndSummary from "./TaxAndSummary";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import toast from "react-hot-toast";
import { Select } from "@headlessui/react";

// Remove local generation - will fetch from API

export default function QuotationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerIdFromUrl = searchParams.get("customerId");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCustomerModal, setShowCustomerModal] =
    useState(!customerIdFromUrl);
  const [customerIdInput, setCustomerIdInput] = useState("");
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(false);
  const [customerError, setCustomerError] = useState("");
  const [originalCustomerData, setOriginalCustomerData] = useState(null);
  const [editableFields, setEditableFields] = useState({
    company: true,
    company_location: true,
    gstin_no: true,
    state_name: true,
  });

  const [items, setItems] = useState([
    {
      productCode: "",
      imageUrl: "",
      name: "",
      hsn: "",
      specification: "",
      unit: "",
      quantity: 1,
      price: 0,
      gst: 18,
    },
  ]);

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
  const [cgstRate, setCgstRate] = useState(9);
  const [sgstRate, setSgstRate] = useState(9);
  const [igstRate, setIgstRate] = useState(18);

  // Supplier state is fixed (header shows: GSTIN: 33... | State: Tamil Nadu (33))
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
      10: "Bihar",
      11: "Sikkim",
      12: "Arunachal Pradesh",
      13: "Nagaland",
      14: "Manipur",
      15: "Mizoram",
      16: "Tripura",
      17: "Meghalaya",
      18: "Assam",
      19: "West Bengal",
      20: "Jharkhand",
      21: "Odisha",
      22: "Chhattisgarh",
      23: "Madhya Pradesh",
      24: "Gujarat",
      25: "Daman & Diu",
      26: "Dadra & Nagar Haveli",
      27: "Maharashtra",
      28: "Andhra Pradesh (Old)",
      29: "Karnataka",
      30: "Goa",
      31: "Lakshadweep",
      32: "Kerala",
      33: "Tamil Nadu",
      34: "Puducherry",
      35: "Andaman & Nicobar Islands",
      36: "Telangana",
      37: "Andhra Pradesh",
      97: "Other Territory",
      99: "Centre Jurisdiction",
    }),
    [],
  );

  // set from params
  useEffect(() => {
    if (customerIdFromUrl) {
      setShowCustomerModal(false);
      fetchCustomerById(customerIdFromUrl);
    }
  }, [customerIdFromUrl]);

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

  // call function here
  // using param method
  const fetchCustomerById = async (id) => {
    if (!id) return;

    setIsLoadingCustomer(true);
    setCustomerError("");

    try {
      const res = await fetch("/api/customer-by-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: id }),
      });

      const data = await res.json();

      if (!data.success) throw new Error(data.error);

      const customer = data.customer;

      setOriginalCustomerData({
        company: customer.company,
        gstin: customer.gstin,
        location: customer.location,
        state: customer.state,
      });

      setEditableFields({
        company: !customer.company,
        company_location: !customer.location,
        gstin_no: !customer.gstin,
        state_name: !customer.state,
      });

      const customerName =
        customer.company ||
        `${customer.first_name} ${customer.last_name}`.trim();

      setForm((prev) => ({
        ...prev,
        customer_id: customer.customer_id,
        company: customerName,
        company_location: customer.location,
        gstin_no: customer.gstin,
        state_name: customer.state,
      }));

      setCustomerIdInput(id);
      setShowCustomerModal(false);
      toast.success("Customer data loaded successfully");
    } catch (err) {
      setShowCustomerModal(true);
      setCustomerError("Customer not found");
    } finally {
      setIsLoadingCustomer(false);
    }
  };

  const parseCodeFromDisplay = (display) => {
    // Expecting format: Name (CC)
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
      const taxable = (item.quantity || 0) * (item.price || 0);
      subtotal += taxable;
    });

    // Calculate tax amounts based on current rates
    const cgst = cgstRate > 0 ? subtotal * (cgstRate / 100) : 0;
    const sgst = sgstRate > 0 ? subtotal * (sgstRate / 100) : 0;
    const igst = igstRate > 0 ? subtotal * (igstRate / 100) : 0;

    const grandTotal = subtotal + cgst + sgst + igst;

    return { subtotal, cgst, sgst, igst, grandTotal };
  }, [items, cgstRate, sgstRate, igstRate]);

  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [quoteNumber, setQuoteNumber] = useState("");
  const [quoteDate, setQuoteDate] = useState("");
  const [isGeneratingQuote, setIsGeneratingQuote] = useState(true);

  // Fetch unique quote number from API on mount
  useEffect(() => {
    const fetchQuoteNumber = async () => {
      try {
        setIsGeneratingQuote(true);
        const res = await fetch("/api/quotation");
        const data = await res.json();
        if (data.quoteNumber && data.quoteDate) {
          setQuoteNumber(data.quoteNumber);
          setQuoteDate(data.quoteDate);
        } else {
          toast.error("Failed to generate quote number");
        }
      } catch (error) {
        console.error("Error fetching quote number:", error);
        toast.error("Failed to generate quote number");
      } finally {
        setIsGeneratingQuote(false);
      }
    };
    fetchQuoteNumber();
  }, []);

  // Auto-detect state from GSTIN and apply tax rates
  useEffect(() => {
    const gstinValue = form.gstin_no?.trim();

    // Case 1: GSTIN is provided - use GSTIN to determine tax
    if (gstinValue) {
      const result = getStateFromGSTIN(gstinValue);
      if (result) {
        if (form.state_name !== result.display) {
          setForm((prev) => ({ ...prev, state_name: result.display }));
        }
        // Set tax rates based on interstate vs intrastate
        if (result.code === SUPPLIER_STATE_CODE) {
          // Same state → CGST+SGST, no IGST
          setCgstRate(9);
          setSgstRate(9);
          setIgstRate(0);
        } else {
          // Different state → IGST only
          setCgstRate(0);
          setSgstRate(0);
          setIgstRate(18);
        }
      }
    }
    // Case 2: No GSTIN - always use CGST+SGST (regardless of state)
    else {
      setCgstRate(9);
      setSgstRate(9);
      setIgstRate(0);
    }
  }, [form.gstin_no]);

  const handleCustomerSearch = async (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));

    if (value.trim().length === 0) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const res = await fetch("/api/customer-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: value }),
      });

      const data = await res.json();
      setSuggestions(data);
      setShowSuggestions(true);

      if (data.length === 1 && /^\d+$/.test(value.trim())) {
        handleSuggestionSelect(data[0]);
      }
    } catch (err) {
      console.error("❌ Error fetching suggestions", err);
      toast.error("Error fetching customer data");
    }
  };

  const handleSuggestionSelect = (selected) => {
    setForm({
      ...form,
      company: selected.company,
      company_location: selected.location,
      gstin_no: selected.gstin,
      state_name: selected.state,
      customer_id: selected.customer_id,
    });
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Fetch customer by ID
  const handleFetchCustomer = async () => {
    if (!customerIdInput.trim()) {
      setCustomerError("Please enter a customer ID");
      return;
    }

    setIsLoadingCustomer(true);
    setCustomerError("");

    try {
      const res = await fetch("/api/customer-by-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerIdInput.trim() }),
      });

      const data = await res.json();

      if (data.success) {
        const customer = data.customer;

        // Store original customer data
        setOriginalCustomerData({
          company: customer.company,
          gstin: customer.gstin,
          location: customer.location,
          state: customer.state,
        });

        // Determine which fields are editable (only if they're empty)
        setEditableFields({
          company: !customer.company || customer.company.trim() === "",
          company_location:
            !customer.location || customer.location.trim() === "",
          gstin_no: !customer.gstin || customer.gstin.trim() === "",
          state_name: !customer.state || customer.state.trim() === "",
        });

        // Populate form with customer data
        const customerName =
          customer.company ||
          `${customer.first_name} ${customer.last_name}`.trim();

        setForm({
          ...form,
          customer_id: customer.customer_id,
          company: customerName,
          company_location: customer.location,
          gstin_no: customer.gstin,
          state_name: customer.state,
        });

        toast.success("Customer data loaded successfully");
        setShowCustomerModal(false);
      } else {
        setCustomerError(data.error || "Customer not found");
        toast.error(data.error || "Customer not found");
      }
    } catch (error) {
      console.error("Error fetching customer:", error);
      setCustomerError("Failed to fetch customer data");
      toast.error("Failed to fetch customer data");
    } finally {
      setIsLoadingCustomer(false);
    }
  };

  const [editableTerms, setEditableTerms] = useState(
    form.terms ||
      `1. 100% Payment Advance With PO.
2. Late payment charges: Interest charges at the rate of 1.5% per month or as per MSME act 2006, whichever is higher will be charged on overdue amounts from the invoice due date.
3. Packing & forwarding and freight inclusive.
4. One year Warranty (Consumable items are not included).
5. Above Rates are Valid for one month from the Date of Quotation.

Thanks for doing business with us!`,
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Check if customer details need to be updated (only for fields that were originally empty)
      if (originalCustomerData && form.customer_id) {
        const updatePayload = {};

        // Only include fields that were originally empty and now have data
        if (editableFields.company && form.company && form.company.trim()) {
          updatePayload.company = form.company.trim();
        }

        if (editableFields.gstin_no && form.gstin_no && form.gstin_no.trim()) {
          updatePayload.gstin = form.gstin_no.trim();
        }

        // Only make API call if there are fields to update
        if (Object.keys(updatePayload).length > 0) {
          const updateRes = await fetch("/api/update-customer-details", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customer_id: form.customer_id,
              ...updatePayload,
            }),
          });

          const updateData = await updateRes.json();
          if (updateData.success) {
            console.log("✅ Customer details updated successfully");
            toast.success("Customer details updated");
          }
        }
      }

      // Create a new array with the calculated totals for each item
      const itemsWithTotals = items.map((item) => {
        const taxable = item.quantity * item.price;
        const gstAmount = taxable * (item.gst / 100);
        const total = taxable + gstAmount;
        return {
          ...item,
          // Add the calculated taxable and total values to each item
          taxable_amount: taxable,
          total_amount: total,
          IGSTamt: gstAmount,
        };
      });

      const subtotal = taxSummary.subtotal;
      const totalGST = taxSummary.cgst + taxSummary.sgst + taxSummary.igst;
      const grandTotal = subtotal + totalGST;

      const dataToSend = {
        ...form,
        quote_number: quoteNumber,
        quote_date: quoteDate,
        items: itemsWithTotals, // Use the new array with totals
        subtotal,
        cgst: taxSummary.cgst,
        sgst: taxSummary.sgst,
        igst: taxSummary.igst,
        grand_total: grandTotal,
        cgstRate,
        sgstRate,
        igstRate,
        terms: editableTerms,
      };

      // --- Log the data being sent to the API ---
      console.log("Data being sent to API:", dataToSend);
      // --- End of logging ---

      const res = await fetch("/api/quotation", {
        method: "POST",
        body: JSON.stringify(dataToSend),
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (data.success) {
        toast.success("✅ Quotation added successfully");
        router.push("/user-dashboard/quotations");
      } else {
        alert("Error: " + data.error);
      }
    } catch (error) {
      console.error("Error submitting quotation:", error);
      toast.error("Failed to submit quotation");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Customer ID Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Enter Customer ID
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Please enter the customer ID to fetch customer details and create
              a quotation.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer ID *
                </label>
                <input
                  type="text"
                  value={customerIdInput}
                  onChange={(e) => {
                    setCustomerIdInput(e.target.value);
                    setCustomerError("");
                  }}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleFetchCustomer();
                    }
                  }}
                  placeholder="Enter customer ID"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoadingCustomer}
                />
                {customerError && (
                  <p className="text-sm text-red-600 mt-2">{customerError}</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleFetchCustomer}
                  disabled={isLoadingCustomer}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoadingCustomer ? "Loading..." : "Continue"}
                </button>
                <button
                  type="button"
                  onClick={() => router.back()}
                  disabled={isLoadingCustomer}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6 max-w-5xl mx-auto px-4 text-gray-800"
      >
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
                <strong>GSTIN:</strong> 07AAKCD6495M1ZV |{" "}
                <strong>State:</strong> Delhi (07)
              </span>
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded">
          <div>
            <label className="text-sm text-gray-600">Estimate No.</label>
            <input
              type="text"
              value={quoteNumber}
              readOnly
              className="input w-full bg-gray-100"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Date</label>
            <input
              type="date"
              value={quoteDate}
              readOnly
              className="input w-full bg-gray-100"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Company Name"
              className={`input w-full ${!editableFields.company ? "bg-gray-100 cursor-not-allowed" : ""}`}
              value={form.company}
              onChange={(e) =>
                editableFields.company &&
                handleCustomerSearch("company", e.target.value)
              }
              required
              autoComplete="off"
              readOnly={!editableFields.company}
              title={
                !editableFields.company
                  ? "This field already has data and cannot be edited"
                  : ""
              }
            />
            {showSuggestions &&
              suggestions.length > 0 &&
              editableFields.company && (
                <ul className="absolute z-10 bg-white border shadow-sm rounded mt-1 max-h-40 overflow-y-auto w-full text-sm">
                  {suggestions.map((s, idx) => (
                    <li
                      key={idx}
                      className="px-3 py-2 hover:bg-emerald-100 cursor-pointer"
                      onClick={() => handleSuggestionSelect(s)}
                    >
                      <strong>{s.company}</strong> ({s.gstin}) - {s.state}
                    </li>
                  ))}
                </ul>
              )}
          </div>
          <input
            type="text"
            placeholder="Company Location"
            className={`input w-full ${!editableFields.company_location ? "bg-gray-100 cursor-not-allowed" : ""}`}
            value={form.company_location}
            onChange={(e) =>
              editableFields.company_location &&
              setForm({ ...form, company_location: e.target.value })
            }
            required
            readOnly={!editableFields.company_location}
            title={
              !editableFields.company_location
                ? "This field already has data and cannot be edited"
                : ""
            }
          />
          <input
            type="text"
            placeholder="GSTIN"
            className={`input w-full ${!editableFields.gstin_no ? "bg-gray-100 cursor-not-allowed" : ""}`}
            value={form.gstin_no}
            onChange={(e) =>
              editableFields.gstin_no &&
              setForm({ ...form, gstin_no: e.target.value })
            }
            readOnly={!editableFields.gstin_no}
            title={
              !editableFields.gstin_no
                ? "This field already has data and cannot be edited"
                : ""
            }
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
                className={`input w-full ${!editableFields.state_name ? "bg-gray-100 cursor-not-allowed" : ""}`}
                value={stateSearch || form.state_name}
                onChange={(e) => {
                  if (!editableFields.state_name) return;
                  const q = e.target.value;
                  setStateSearch(q);
                  const filtered = allStates.filter(
                    (s) =>
                      s.name.toLowerCase().includes(q.toLowerCase()) ||
                      s.code.includes(q),
                  );
                  setStateSuggestions(filtered.slice(0, 10));
                  setShowStateSuggestions(true);
                  // Also keep form.state_name in sync with raw input if no selection yet
                  setForm((prev) => ({ ...prev, state_name: q }));
                }}
                onFocus={() => {
                  if (editableFields.state_name) {
                    setShowStateSuggestions(true);
                    setStateSuggestions(allStates.slice(0, 10));
                  }
                }}
                autoComplete="off"
                required
                readOnly={!editableFields.state_name}
                title={
                  !editableFields.state_name
                    ? "This field already has data and cannot be edited"
                    : ""
                }
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
            title="Customer ID cannot be edited"
          />
          <div>
            <label className="text-sm text-gray-600">Payment Term (Days)</label>
            <select
              className="input w-full"
              value={form.payment_term_days}
              onChange={(e) =>
                setForm({ ...form, payment_term_days: e.target.value })
              }
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
        <QuotationItemsTable items={items} setItems={setItems} customerId={form.customer_id} />
        <TaxAndSummary
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
          interstate={(() => {
            const gstinValue = form.gstin_no?.trim();
            // If GSTIN is empty, default to intrastate (CGST+SGST)
            if (!gstinValue) return false;

            const gstState = getStateFromGSTIN(gstinValue);
            const buyerCode =
              gstState?.code || parseCodeFromDisplay(form.state_name);
            return buyerCode ? buyerCode !== SUPPLIER_STATE_CODE : false;
          })()}
        />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mt-6">
          <div className="lg:col-span-3 border p-4 rounded bg-gray-50">
            <h4 className="font-semibold text-base mb-2 text-gray-800">
              Terms & Conditions
            </h4>
            <textarea
              rows={10}
              value={editableTerms}
              onChange={(e) => setEditableTerms(e.target.value)}
              className="w-full text-sm p-2 border rounded resize-y"
            />
          </div>
          <div className="lg:col-span-1 border p-4 rounded bg-gray-50 text-sm">
            <h4 className="font-semibold mb-2">Bank Details</h4>
            <p>ICICI Bank</p>
            <p>Account: 343405500379</p>
            <p>IFSC: ICIC0003434</p>
          </div>
          <div className="lg:col-span-1 border p-4 rounded bg-gray-50 text-sm text-center flex flex-col justify-between">
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
            {isSubmitting ? "Submitting..." : "Submit Quotation"}
          </button>
        </div>
      </form>
    </>
  );
}
