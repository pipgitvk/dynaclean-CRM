import { useEffect, useState } from "react";
import { toWords } from "number-to-words";

export default function TaxAndSummary({
  items,
  subtotal,
  cgst,
  sgst,
  igst,
  grandTotal,
  cgstRate,
  sgstRate,
  igstRate,
  setCgstRate,
  setSgstRate,
  setIgstRate,
}) {
  const [amountInWords, setAmountInWords] = useState("Zero");

  useEffect(() => {
    setAmountInWords(
      grandTotal === 0
        ? "Zero"
        : toWords(Math.round(grandTotal)).replace(/\b\w/g, (l) =>
            l.toUpperCase(),
          ) + " Only",
    );
  }, [grandTotal]);

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
  {/* IGST – Interstate */}
  {igstRate > 0 && (
    <tr className="border">
      <td className="px-3 py-2 border">IGST</td>
      <td className="px-3 py-2 border">₹ {subtotal.toFixed(2)}</td>
      <td className="px-3 py-2 border text-center">
        {igstRate}%
      </td>
      <td className="px-3 py-2 border">₹ {igst.toFixed(2)}</td>
    </tr>
  )}

  {/* CGST + SGST – Intrastate */}
  {igstRate === 0 && (
    <>
      <tr className="border">
        <td className="px-3 py-2 border">CGST</td>
        <td className="px-3 py-2 border">₹ {subtotal.toFixed(2)}</td>
        <td className="px-3 py-2 border text-center">
          {cgstRate}%
        </td>
        <td className="px-3 py-2 border">₹ {cgst.toFixed(2)}</td>
      </tr>

      <tr className="border">
        <td className="px-3 py-2 border">SGST</td>
        <td className="px-3 py-2 border">₹ {subtotal.toFixed(2)}</td>
        <td className="px-3 py-2 border text-center">
          {sgstRate}%
        </td>
        <td className="px-3 py-2 border">₹ {sgst.toFixed(2)}</td>
      </tr>
    </>
  )}
</tbody>

        </table>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 p-4 rounded shadow-sm text-sm border flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-semibold mb-4 text-center">
            Invoice Summary
          </h3>
          <div className="flex justify-between py-1 border-b">
            <span className="font-medium">Subtotal:</span>
            <span>₹ {subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-1 border-b">
            <span className="font-medium">CGST ({cgstRate}%):</span>
            <span>₹ {cgst.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-1 border-b">
            <span className="font-medium">SGST ({sgstRate}%):</span>
            <span>₹ {sgst.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-1 border-b">
            <span className="font-medium">IGST ({igstRate}%):</span>
            <span>₹ {igst.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-1 border-b">
            <span className="font-medium">Total Tax:</span>
            <span>₹ {(cgst + sgst + igst).toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-2 mt-2 text-lg font-bold text-red-600">
            <span>Amount Due:</span>
            <span>₹ {grandTotal.toFixed(2)}</span>
          </div>
        </div>
        <div className="mt-3 text-xs text-center text-gray-700 border-t pt-2 italic">
          Total Amount in Words:
          <br />
          <span className="text-sm font-medium text-black">
            {amountInWords}
          </span>
        </div>
      </div>
    </div>
  );
}
