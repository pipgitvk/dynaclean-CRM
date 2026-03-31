"use client";

import { useMemo, useState } from "react";
import { updateProspect } from "../../actions";
import {
  getTodayYmdIST,
  getFinalSubmitDeadlineYmd,
  canFinalSubmitWithCommitment,
  formatYmdLongEnIN,
} from "@/lib/prospectCommitmentRules";

function toDateInputValue(v) {
  if (v == null || v === "") return "";
  const s = String(v);
  if (s.length >= 10) return s.slice(0, 10);
  try {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch {
    /* ignore */
  }
  return "";
}

/**
 * @param {object} row - prospect row from DB (amount/qty as from server)
 */
export default function EditProspectFormClient({
  prospectId,
  row,
  inputClass,
}) {
  const qtyParsed = parseInt(String(row.qty ?? "").trim(), 10);
  const qtySubmit =
    Number.isFinite(qtyParsed) && qtyParsed >= 1 ? qtyParsed : 1;
  const amountNum = Number(row.amount);

  const [amountInput, setAmountInput] = useState(() =>
    Number.isFinite(amountNum) ? String(amountNum) : "0",
  );

  const [commitmentStr, setCommitmentStr] = useState(() =>
    toDateInputValue(row.commitment_date),
  );

  const minCommitmentYmd = useMemo(() => getTodayYmdIST(), []);
  const canSubmit = useMemo(
    () => canFinalSubmitWithCommitment(commitmentStr, getTodayYmdIST()),
    [commitmentStr],
  );
  const deadlineYmd = useMemo(() => {
    const s = String(commitmentStr ?? "").trim();
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    return getFinalSubmitDeadlineYmd(s);
  }, [commitmentStr]);

  return (
    <form action={updateProspect} className="space-y-4">
      <input type="hidden" name="prospect_id" value={prospectId} />
      <input type="hidden" name="customer_id" value={row.customer_id} />
      <input type="hidden" name="qty" value={qtySubmit} />

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Customer ID
        </label>
        <input
          type="text"
          readOnly
          value={row.customer_id}
          className={`${inputClass} cursor-default bg-slate-50 text-slate-800`}
        />
      </div>

      <div>
        <label
          htmlFor="model"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Model
        </label>
        <input
          id="model"
          name="model"
          required
          readOnly
          defaultValue={row.model ?? ""}
          className={`${inputClass} cursor-default bg-slate-50 text-slate-800`}
        />
      </div>

      <div>
        <label
          htmlFor="qty"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Qty
        </label>
        <input
          id="qty"
          type="text"
          readOnly
          tabIndex={-1}
          value={row.qty != null && row.qty !== "" ? String(row.qty) : ""}
          className={`${inputClass} cursor-default bg-slate-50 text-slate-800`}
        />
      </div>

      <div>
        <label
          htmlFor="amount"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Total amount
        </label>
        <input
          id="amount"
          name="amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          required
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
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
        {deadlineYmd ? (
          <p className="mb-1 text-xs text-slate-600">
            Last day to final submit for this commitment (IST):{" "}
            <strong>{formatYmdLongEnIN(deadlineYmd)}</strong>.
          </p>
        ) : null}
        {!canSubmit ? (
          <div className="mb-2 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            The final submit deadline (IST) for this commitment has passed, or the
            commitment date is before today. Update the commitment date to a valid
            date on or after today to final submit.
          </div>
        ) : null}
        <input
          id="commitment_date"
          name="commitment_date"
          type="date"
          min={minCommitmentYmd}
          value={commitmentStr}
          onChange={(e) => setCommitmentStr(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label
          htmlFor="notes"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={4000}
          defaultValue={row.notes ?? ""}
          placeholder="Optional"
          className={`${inputClass} min-h-[88px] resize-y py-2`}
        />
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-2 w-full rounded-[10px] bg-slate-900 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Final submit
      </button>
    </form>
  );
}
