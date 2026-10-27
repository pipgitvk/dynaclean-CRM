import { useEffect, useState, useMemo } from "react";
import { toWords } from "number-to-words";
import { buildInvoiceTaxTableRows } from "@/lib/gstSupplyType";

export default function TaxAndSummary({
  items,
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
}) {
  const [amountInWords, setAmountInWords] = useState("Zero");

  const computedTax = useMemo(() => {
    let computedSubtotal = 0;
    let computedCgst = 0;
    let computedSgst = 0;
    let computedIgst = 0;

    items.forEach((item) => {
      const qty = item.quantity || 0;
      const rate = item.rate || 0;
      const discountAmount = item.discount_amount || 0;
      const itemSubtotal = qty * rate - discountAmount;
      computedSubtotal += itemSubtotal;

      computedCgst += (itemSubtotal * (item.cgst_percent || 0)) / 100;
      computedSgst += (itemSubtotal * (item.sgst_percent || 0)) / 100;
      computedIgst += (itemSubtotal * (item.igst_percent || 0)) / 100;
    });

    const totalTax = computedCgst + computedSgst + computedIgst;
    const taxableSubtotal = computedSubtotal || subtotal;
    const totalBeforeRound = taxableSubtotal + totalTax;
    const finalRoundOff = isAutoRoundOff
      ? Math.round(totalBeforeRound) - totalBeforeRound
      : parseFloat(roundOff) || 0;
    const computedGrandTotal = totalBeforeRound + finalRoundOff;

    const taxTableRows = buildInvoiceTaxTableRows(items);

    return {
      computedCgst,
      computedSgst,
      computedIgst,
      totalTax,
      computedGrandTotal,
      finalRoundOff,
      taxableSubtotal,
      taxTableRows,
    };
  }, [items, subtotal, roundOff, isAutoRoundOff]);

  // Sync roundOff when auto
  useEffect(() => {
    if (isAutoRoundOff) {
      setRoundOff(parseFloat(computedTax.finalRoundOff.toFixed(2)));
    }
  }, [computedTax.finalRoundOff, isAutoRoundOff, setRoundOff]);

  useEffect(() => {
    setAmountInWords(
      computedTax.computedGrandTotal === 0
        ? "Zero"
        : toWords(Math.round(computedTax.computedGrandTotal)).replace(/\b\w/g, (l) =>
            l.toUpperCase(),
          ) + " Only",
    );
  }, [computedTax.computedGrandTotal]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 border rounded p-4">
      {/* Tax Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border">
          <thead className="bg-gray-100 text-gray-700 text-left">
            <tr>
              <th className="px-3 py-2 border">Tax Type</th>
              <th className="px-3 py-2 border">Taxable Amount</th>
              <th className="px-3 py-2 border">Rate (%)</th>
              <th className="px-3 py-2 border">Tax Amount</th>
            </tr>
          </thead>
          <tbody>
            {computedTax.taxTableRows.map((row, idx) => (
              <tr key={`${row.type}-${row.rate}-${idx}`} className="border">
                <td className="px-3 py-2 border">{row.type}</td>
                <td className="px-3 py-2 border">₹ {row.taxableAmount.toFixed(2)}</td>
                <td className="px-3 py-2 border text-center">{row.rate}%</td>
                <td className="px-3 py-2 border">₹ {row.taxAmount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          {computedTax.taxTableRows.length > 0 && (
            <tfoot>
              <tr className="border bg-gray-50 font-semibold">
                <td className="px-3 py-2 border" colSpan={3}>
                  Total Tax (all slabs)
                </td>
                <td className="px-3 py-2 border">
                  ₹ {computedTax.totalTax.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 p-4 rounded shadow-sm text-sm border flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-semibold mb-4 text-center">Invoice Summary</h3>
          <div className="flex justify-between py-1 border-b">
            <span className="font-medium">Subtotal:</span>
            <span>₹ {computedTax.taxableSubtotal.toFixed(2)}</span>
          </div>
          {computedTax.taxTableRows
            .filter((row) => row.type === "IGST")
            .map((row) => (
              <div
                key={`summary-igst-${row.rate}`}
                className="flex justify-between py-1 border-b text-gray-800"
              >
                <span className="font-medium">
                  IGST @ {row.rate}% (on ₹ {row.taxableAmount.toFixed(2)})
                </span>
                <span>₹ {row.taxAmount.toFixed(2)}</span>
              </div>
            ))}
          {computedTax.computedIgst > 0 &&
            computedTax.taxTableRows.filter((r) => r.type === "IGST").length > 1 && (
              <div className="flex justify-between py-1 border-b font-semibold">
                <span>Total IGST</span>
                <span>₹ {computedTax.computedIgst.toFixed(2)}</span>
              </div>
            )}
          {computedTax.taxTableRows
            .filter((row) => row.type === "CGST")
            .map((row) => (
              <div
                key={`summary-cgst-${row.rate}`}
                className="flex justify-between py-1 border-b text-gray-800"
              >
                <span className="font-medium">CGST @ {row.rate}%</span>
                <span>₹ {row.taxAmount.toFixed(2)}</span>
              </div>
            ))}
          {computedTax.taxTableRows
            .filter((row) => row.type === "SGST")
            .map((row) => (
              <div
                key={`summary-sgst-${row.rate}`}
                className="flex justify-between py-1 border-b text-gray-800"
              >
                <span className="font-medium">SGST @ {row.rate}%</span>
                <span>₹ {row.taxAmount.toFixed(2)}</span>
              </div>
            ))}
          <div className="flex justify-between py-1 border-b">
            <span className="font-medium">Total Tax:</span>
            <span>₹ {computedTax.totalTax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-1 border-b items-center">
            <span className="font-medium flex items-center gap-2">
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
              value={roundOff}
              onChange={(e) => setRoundOff(parseFloat(e.target.value) || 0)}
              className={`w-24 p-1 border rounded text-right ${isAutoRoundOff ? "bg-gray-100 cursor-not-allowed" : ""}`}
              step="0.01"
              disabled={isAutoRoundOff}
            />
          </div>
          <div className="flex justify-between py-2 mt-2 text-lg font-bold text-red-600">
            <span>Amount Due:</span>
            <span>₹ {computedTax.computedGrandTotal.toFixed(2)}</span>
          </div>
        </div>
        <div className="mt-3 text-xs text-center text-gray-700 border-t pt-2 italic">
          Total Amount in Words:
          <br />
          <span className="text-sm font-medium text-black">{amountInWords}</span>
        </div>
      </div>
    </div>
  );
}
