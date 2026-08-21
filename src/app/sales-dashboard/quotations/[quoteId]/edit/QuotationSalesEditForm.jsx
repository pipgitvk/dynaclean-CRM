"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

const STATE_CODE_TO_NAME = {
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
};

function getStateFromGSTIN(gstin) {
  if (!gstin || gstin.length < 2) return "";
  const code = gstin.slice(0, 2);
  const name = STATE_CODE_TO_NAME[code];
  if (!name) return "";
  return `${name} (${code})`;
}

export default function QuotationSalesEditForm({ quoteId, hasOrder = false }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quoteNumber, setQuoteNumber] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [form, setForm] = useState({
    company_location: "",
    gstin_no: "",
    ship_to: "",
  });

  const derivedState = useMemo(
    () => getStateFromGSTIN(form.gstin_no.trim()),
    [form.gstin_no],
  );

  useEffect(() => {
    const fetchQuote = async () => {
      try {
        const res = await fetch(`/api/quotations/${encodeURIComponent(quoteId)}`);
        const data = await res.json();

        if (!data.success) {
          toast.error("Quotation not found");
          router.push("/sales-dashboard/quotations");
          return;
        }

        const h = data.header;
        setQuoteNumber(h.quote_number || quoteId);
        setCompanyName(h.company_name || "");
        setForm({
          company_location: h.company_address || "",
          gstin_no: h.gstin || "",
          ship_to: h.ship_to || "",
        });
      } catch (err) {
        console.error("Error loading quotation:", err);
        toast.error("Failed to load quotation");
        router.push("/sales-dashboard/quotations");
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuote();
  }, [quoteId, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (hasOrder) {
      toast.error("Cannot edit quotation after order is created");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/quotations/${encodeURIComponent(quoteId)}/sales-update`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gstin_no: form.gstin_no,
            ship_to: form.ship_to,
          }),
        },
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.message || "Failed to update quotation");
        return;
      }

      toast.success("Quotation updated successfully");
      router.push("/sales-dashboard/quotations");
      router.refresh();
    } catch (err) {
      console.error("Update error:", err);
      toast.error("Failed to update quotation");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <p className="text-gray-600">Loading quotation...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Edit Quotation</h1>
          <p className="text-sm text-gray-500 mt-1">
            {quoteNumber} {companyName ? `— ${companyName}` : ""}
          </p>
        </div>
        <Link
          href="/sales-dashboard/quotations"
          className="text-blue-600 hover:underline text-sm"
        >
          Back to list
        </Link>
      </div>

      {hasOrder ? (
        <p className="text-red-600 text-sm">
          This quotation is linked to an order and cannot be edited.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Company Location
          </label>
          <input
            type="text"
            className="input w-full border rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
            value={form.company_location}
            readOnly
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            GSTIN
          </label>
          <input
            type="text"
            className="input w-full border rounded px-3 py-2"
            value={form.gstin_no}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, gstin_no: e.target.value.toUpperCase() }))
            }
            placeholder="GSTIN"
            disabled={hasOrder}
          />
          {derivedState ? (
            <p className="text-xs text-gray-500 mt-1">State: {derivedState}</p>
          ) : null}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ship To Address
          </label>
          <input
            type="text"
            className="input w-full border rounded px-3 py-2"
            value={form.ship_to}
            onChange={(e) => setForm((prev) => ({ ...prev, ship_to: e.target.value }))}
            required
            disabled={hasOrder}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting || hasOrder}
            className="bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
          <Link
            href="/sales-dashboard/quotations"
            className="border border-gray-300 px-5 py-2 rounded hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
