"use client";

import { useMemo, useState } from "react";
import { createProspectManual } from "../actions";
import { getTodayYmdIST } from "@/lib/prospectCommitmentRules";

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

function parseQtyNum(qtyStr) {
  if (qtyStr === "" || qtyStr == null) return 0;
  const n = parseInt(String(qtyStr), 10);
  return Number.isNaN(n) ? 0 : Math.max(0, n);
}

function setQtyStrFromInput(raw, setQtyStr) {
  if (raw === "") {
    setQtyStr("");
    return;
  }
  if (/^\d+$/.test(raw)) setQtyStr(raw);
}

/** Manual prospect entry: no quotation lookup. */
export default function ManualProspectFormClient({ inputClass }) {
  const minCommitmentYmd = useMemo(() => getTodayYmdIST(), []);
  const [unitPrice, setUnitPrice] = useState(0);
  const [qtyStr, setQtyStr] = useState("");

  const qtyNum = useMemo(() => parseQtyNum(qtyStr), [qtyStr]);
  const lineTotal = useMemo(
    () => roundMoney(unitPrice * qtyNum),
    [unitPrice, qtyNum],
  );

  return (
    <form action={createProspectManual} className="space-y-4">
      <p className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Enter details by hand — quotation is not required.
      </p>

      <div>
        <label
          htmlFor="customer_id"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Customer ID
        </label>
        <input
          id="customer_id"
          name="customer_id"
          required
          className={inputClass}
          autoComplete="off"
        />
      </div>

      <div>
        <label
          htmlFor="model"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Model
        </label>
        <input id="model" name="model" required className={inputClass} />
      </div>

      <div>
        <label
          htmlFor="qty"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Qty
        </label>
        <input type="hidden" name="qty" value={qtyNum} />
        <input
          id="qty"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          value={qtyStr}
          onChange={(e) => setQtyStrFromInput(e.target.value, setQtyStr)}
          className={inputClass}
        />
      </div>

      <div>
        <label
          htmlFor="amount_display"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Total amount
        </label>
        <input
          type="hidden"
          name="amount"
          value={Number.isFinite(lineTotal) ? lineTotal : 0}
        />
        <input
          id="amount_display"
          type="number"
          step="0.01"
          min={0}
          value={Number.isFinite(lineTotal) ? lineTotal : 0}
          onChange={(e) => {
            const v =
              parseFloat(String(e.target.value).replace(/,/g, "")) || 0;
            setUnitPrice(qtyNum > 0 ? roundMoney(v / qtyNum) : v);
          }}
          className={inputClass}
        />
      </div>

      <div>
        <label
          htmlFor="commitment_date"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Commitment date
        </label>
        <input
          id="commitment_date"
          name="commitment_date"
          type="date"
          min={minCommitmentYmd}
          className={inputClass}
        />
      </div>

      <div>
        <label
          htmlFor="notes-manual"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Notes
        </label>
        <textarea
          id="notes-manual"
          name="notes"
          rows={3}
          maxLength={4000}
          placeholder="Optional"
          className={`${inputClass} min-h-[88px] resize-y py-2`}
        />
      </div>

      <button
        type="submit"
        className="mt-2 w-full rounded-[10px] bg-slate-900 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        Save prospect
      </button>
    </form>
  );
}
