"use client";
import { useState } from "react";

export default function QuotationLookupForm({ onLoad }) {
  const [quoteId, setQuoteId] = useState("");
  const [error, setError] = useState("");

  async function handleLookup(e) {
    e.preventDefault();
    setError("");
    if (!quoteId.trim()) return setError("Enter quotation number.");

    try {
      const res = await fetch(`/api/quotations/${quoteId}`);
      const data = await res.json();
      data.success ? onLoad(data) : setError(data.error || "Not found.");
    } catch (err) {
      setError("Lookup failed.");
    }
  }

  return (
    <form onSubmit={handleLookup} className="mb-8 space-y-4">
      <label className="block font-medium">Quotation Number</label>
      <div className="flex space-x-2">
        <input
          type="text"
          value={quoteId}
          onChange={(e) => setQuoteId(e.target.value)}
          placeholder="e.g. QUOTE12345"
          className="flex-1 px-4 py-2 border rounded"
        />
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded"
        >
          Load
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
