import { useEffect, useState, useMemo } from "react";
import { toWords } from "number-to-words";

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

  // Recalculate tax amounts using cgstRate/sgstRate/igstRate (from quotation DB)
  const computedTax = useMemo(() => {
    let computedCgst = 0;
    let computedSgst = 0;
    let computedIgst = 0;

    items.forEach((item) => {
      const qty = item.quantity || 0;
      const rate = item.rate || 0;
      const discountAmount = item.discount_amount || 0;
      const itemSubtotal = qty * rate - discountAmount;

      computedCgst += (itemSubtotal * cgstRate) / 100;
      computedSgst += (itemSubtotal * sgstRate) / 100;
      computedIgst += (itemSubtotal * igstRate) / 100;
    });

    const totalTax = computedCgst + computedSgst + computedIgst;
    const totalBeforeRound = subtotal + totalTax;
    const finalRoundOff = isAutoRoundOff
      ? Math.round(totalBeforeRound) - totalBeforeRound
      : parseFloat(roundOff) || 0;
    const computedGrandTotal = totalBeforeRound + finalRoundOff;

    return { computedCgst, computedSgst, computedIgst, totalTax, computedGrandTotal, finalRoundOff };
  }, [items, cgstRate, sgstRate, igstRate, subtotal, roundOff, isAutoRoundOff]);

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
            {igstRate > 0 && (
              <tr className="border">
                <td className="px-3 py-2 border">IGST</td>
                <td className="px-3 py-2 border">₹ {subtotal.toFixed(2)}</td>
                <td className="px-3 py-2 border text-center">{igstRate}%</td>
                <td className="px-3 py-2 border">₹ {computedTax.computedIgst.toFixed(2)}</td>
              </tr>
            )}
            {igstRate === 0 && (
              <>
                {cgstRate > 0 && (
                  <tr className="border">
                    <td className="px-3 py-2 border">CGST</td>
                    <td className="px-3 py-2 border">₹ {subtotal.toFixed(2)}</td>
                    <td className="px-3 py-2 border text-center">{cgstRate}%</td>
                    <td className="px-3 py-2 border">₹ {computedTax.computedCgst.toFixed(2)}</td>
                  </tr>
                )}
                {sgstRate > 0 && (
                  <tr className="border">
                    <td className="px-3 py-2 border">SGST</td>
                    <td className="px-3 py-2 border">₹ {subtotal.toFixed(2)}</td>
                    <td className="px-3 py-2 border text-center">{sgstRate}%</td>
                    <td className="px-3 py-2 border">₹ {computedTax.computedSgst.toFixed(2)}</td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 p-4 rounded shadow-sm text-sm border flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-semibold mb-4 text-center">Invoice Summary</h3>
          <div className="flex justify-between py-1 border-b">
            <span className="font-medium">Subtotal:</span>
            <span>₹ {subtotal.toFixed(2)}</span>
          </div>
          {igstRate > 0 ? (
            <div className="flex justify-between py-1 border-b">
              <span className="font-medium">IGST ({igstRate}%):</span>
              <span>₹ {computedTax.computedIgst.toFixed(2)}</span>
            </div>
          ) : (
            <>
              {cgstRate > 0 && (
                <div className="flex justify-between py-1 border-b">
                  <span className="font-medium">CGST ({cgstRate}%):</span>
                  <span>₹ {computedTax.computedCgst.toFixed(2)}</span>
                </div>
              )}
              {sgstRate > 0 && (
                <div className="flex justify-between py-1 border-b">
                  <span className="font-medium">SGST ({sgstRate}%):</span>
                  <span>₹ {computedTax.computedSgst.toFixed(2)}</span>
                </div>
              )}
            </>
          )}
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
