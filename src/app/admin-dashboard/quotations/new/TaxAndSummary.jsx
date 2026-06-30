"use client";

import React, { useEffect, useState } from "react";

// Convert number to words (Indian numeral system)
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
    const h = Math.floor(x / 100);
    const r = x % 100;
    if (h > 0) w += units[h] + " hundred";
    if (r > 0) {
      if (h > 0) w += " and ";
      if (r < 10) w += units[r];
      else if (r < 20) w += teens[r - 10];
      else {
        w += tens[Math.floor(r / 10)];
        if (r % 10 > 0) w += "-" + units[r % 10];
      }
    }
    return w;
  };

  const words = [];
  if (n === 0) {
    words.push("zero");
  } else {
    const last3 = n % 1000;
    if (last3 > 0) words.unshift(convertBlock(last3));
    n = Math.floor(n / 1000);
    let si = 1;
    while (n > 0) {
      const block = n % 100;
      if (block > 0) words.unshift(`${convertBlock(block)} ${suffixes[si]}`);
      n = Math.floor(n / 100);
      si++;
    }
  }

  let result = words.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  if (parseInt(dec) > 0) result += ` and ${dec}/100`;
  return `${result} Rupees Only.`.replace(/\s+/g, " ").trim();
};

export default function TaxAndSummary({
  subtotal,
  cgst,
  sgst,
  igst,
  roundOff,
  setRoundOff,
  isAutoRoundOff,
  setIsAutoRoundOff,
  grandTotal,
  cgstRate,
  sgstRate,
  igstRate,
  setCgstRate,
  setSgstRate,
  setIgstRate,
  interstate,
}) {
  return (
    <div className="flex flex-col md:flex-row gap-6 mt-6 p-4 border rounded-md bg-gray-50 shadow text-sm">
      {/* Left — Tax Details */}
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

        <div className="space-y-1">
          <div className="flex justify-between items-center text-gray-600">
            <span>Subtotal</span>
            <span>₹ {subtotal?.toFixed(2)}</span>
          </div>

          {/* Intrastate: CGST + SGST */}
          {!interstate && (
            <>
              <div className="flex justify-between items-center text-gray-600">
                <label className="flex items-center gap-2">
                  CGST
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cgstRate}
                    onChange={(e) => setCgstRate(parseFloat(e.target.value) || 0)}
                    className="w-16 text-center p-1 border rounded text-xs"
                  />
                  %
                </label>
                <span>₹ {cgst?.toFixed(2) ?? "0.00"}</span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <label className="flex items-center gap-2">
                  SGST
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={sgstRate}
                    onChange={(e) => setSgstRate(parseFloat(e.target.value) || 0)}
                    className="w-16 text-center p-1 border rounded text-xs"
                  />
                  %
                </label>
                <span>₹ {sgst?.toFixed(2) ?? "0.00"}</span>
              </div>
            </>
          )}

          {/* Interstate: IGST only */}
          {interstate && (
            <div className="flex justify-between items-center text-gray-600">
              <label className="flex items-center gap-2">
                IGST
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={igstRate}
                  onChange={(e) => setIgstRate(parseFloat(e.target.value) || 0)}
                  className="w-16 text-center p-1 border rounded text-xs"
                />
                %
              </label>
              <span>₹ {igst?.toFixed(2) ?? "0.00"}</span>
            </div>
          )}

          {/* Round Off */}
          <div className="flex justify-between items-center text-gray-600 mt-2">
            <span className="font-semibold text-gray-800 flex items-center gap-2">
              Round Off
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
              className={`w-20 text-right p-1 border rounded text-xs ${isAutoRoundOff ? "bg-gray-100 cursor-not-allowed" : ""}`}
              disabled={isAutoRoundOff}
            />
          </div>
        </div>
      </div>

      {/* Right — Grand Total */}
      <div className="md:w-1/2 lg:w-1/3 flex flex-col justify-end">
        <div className="border-t border-gray-300 pt-4 mt-4 md:mt-0 md:pt-0">
          <div className="flex justify-between items-center font-bold text-lg text-emerald-700">
            <span>Grand Total</span>
            <span className="text-2xl">₹ {grandTotal?.toFixed(2)}</span>
          </div>
          <p className="mt-2 text-sm text-gray-600 italic">
            Amount in words:
            <br />
            <span className="font-semibold capitalize">
              {grandTotal ? convertNumberToWords(grandTotal) : "Zero Rupees Only."}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
