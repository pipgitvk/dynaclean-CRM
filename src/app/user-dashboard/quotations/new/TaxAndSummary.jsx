"use client";

import React from "react";

const convertNumberToWords = (num) => {
  if (!num || isNaN(num) || num === 0) return "Zero Rupees Only.";
  const s = num.toFixed(2).split(".");
  let n = parseInt(s[0], 10);
  const dec = s[1];
  const units = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  const teens = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "ten", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  const suffixes = ["", "thousand", "lakh", "crore"];
  const convertBlock = (x) => {
    if (x === 0) return "";
    let w = "";
    const h = Math.floor(x / 100), r = x % 100;
    if (h > 0) w += units[h] + " hundred";
    if (r > 0) {
      if (h > 0) w += " and ";
      if (r < 10) w += units[r];
      else if (r < 20) w += teens[r - 10];
      else { w += tens[Math.floor(r / 10)]; if (r % 10 > 0) w += "-" + units[r % 10]; }
    }
    return w;
  };
  const words = [];
  if (n === 0) { words.push("zero"); } else {
    const last3 = n % 1000;
    if (last3 > 0) words.unshift(convertBlock(last3));
    n = Math.floor(n / 1000);
    let si = 1;
    while (n > 0) {
      const block = n % 100;
      if (block > 0) words.unshift(`${convertBlock(block)} ${suffixes[si]}`);
      n = Math.floor(n / 100); si++;
    }
  }
  let result = words.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  if (parseInt(dec) > 0) result += ` and ${dec}/100`;
  return `${result} Rupees Only.`.replace(/\s+/g, " ").trim();
};

export default function TaxAndSummary({
  items = [],
  subtotal,
  roundOff,
  setRoundOff,
  isAutoRoundOff,
  setIsAutoRoundOff,
  grandTotal,
  interstate,
}) {
  // Group items by GST rate
  const gstGroups = React.useMemo(() => {
    const map = {};
    items.forEach((item) => {
      const rate = parseFloat(item.gst) || 0;
      const taxable = (item.quantity || 0) * (item.price || 0);
      if (!map[rate]) map[rate] = { taxable: 0 };
      map[rate].taxable += taxable;
    });
    return Object.entries(map)
      .map(([rate, { taxable }]) => {
        const r = parseFloat(rate);
        return { rate: r, taxable, taxAmt: (taxable * r) / 100 };
      })
      .sort((a, b) => a.rate - b.rate);
  }, [items]);

  const totalTax = gstGroups.reduce((s, g) => s + g.taxAmt, 0);
  const computedSubtotal = gstGroups.reduce((s, g) => s + g.taxable, 0);

  return (
    <div className="flex flex-col md:flex-row gap-6 mt-6 p-4 border rounded-md bg-gray-50 shadow text-sm">
      {/* Left — Tax breakdown by GST rate */}
      <div className="flex-1 space-y-2">
        <h4 className="font-semibold text-lg text-gray-800">Tax Summary</h4>
        <div className="text-xs text-gray-600 mb-2">
          Mode:{" "}
          {interstate ? (
            <span className="font-semibold text-indigo-700">Interstate (IGST)</span>
          ) : (
            <span className="font-semibold text-emerald-700">Intrastate (CGST + SGST)</span>
          )}
        </div>

        {gstGroups.length === 0 && (
          <div className="text-xs text-gray-400 italic">No items added yet</div>
        )}

        {gstGroups.map(({ rate, taxable, taxAmt }) => (
          <div key={rate} className="text-xs text-gray-700 border rounded p-2 bg-white">
            <div className="flex justify-between font-medium text-gray-600 mb-1">
              <span>GST @ {rate}% — Taxable: ₹ {taxable.toFixed(2)}</span>
            </div>
            {interstate ? (
              <div className="flex justify-between pl-2">
                <span>IGST ({rate}%)</span>
                <span>₹ {taxAmt.toFixed(2)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between pl-2">
                  <span>CGST ({(rate / 2).toFixed(1)}%)</span>
                  <span>₹ {(taxAmt / 2).toFixed(2)}</span>
                </div>
                <div className="flex justify-between pl-2">
                  <span>SGST ({(rate / 2).toFixed(1)}%)</span>
                  <span>₹ {(taxAmt / 2).toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
        ))}

        {gstGroups.length > 0 && (
          <div className="flex justify-between items-center text-gray-700 font-semibold pt-1 border-t">
            <span>Total Tax</span>
            <span>₹ {totalTax.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Right — Summary box */}
      <div className="md:w-1/2 lg:w-2/5 flex flex-col">
        <div className="border rounded-lg bg-white shadow-sm p-5 flex flex-col gap-0">
          <h3 className="text-center font-bold text-lg text-gray-800 mb-4">Summary</h3>

          <div className="flex justify-between py-2 border-b text-sm text-gray-700">
            <span>Sub Total:</span>
            <span>₹ {(subtotal ?? computedSubtotal).toFixed(2)}</span>
          </div>

          <div className="flex justify-between py-2 border-b text-sm text-gray-700">
            <span>Total GST:</span>
            <span>₹ {totalTax.toFixed(2)}</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b text-sm text-gray-700">
            <span className="flex items-center gap-2">
              Round Off:
              <label className="flex items-center text-xs font-normal text-gray-600 gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAutoRoundOff}
                  onChange={(e) => setIsAutoRoundOff(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Auto
              </label>
            </span>
            <input
              type="number"
              step="0.01"
              value={roundOff}
              onChange={(e) => setRoundOff(parseFloat(e.target.value) || 0)}
              className={`w-24 text-right p-1 border rounded text-sm ${isAutoRoundOff ? "bg-gray-100 cursor-not-allowed" : ""}`}
              disabled={isAutoRoundOff}
            />
          </div>

          <div className="flex justify-between items-center py-3 text-xl font-bold text-red-600">
            <span>Grand Total:</span>
            <span>₹ {grandTotal?.toFixed(2)}</span>
          </div>

          <div className="border-t pt-3 mt-1 text-center text-xs text-gray-500 italic">
            Estimate Amount in Words:
            <br />
            <span className="text-sm font-medium text-gray-800 not-italic">
              {grandTotal ? convertNumberToWords(grandTotal) : "Zero Rupees Only."}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
