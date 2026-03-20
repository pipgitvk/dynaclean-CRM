"use client";

import { useMemo, useState } from "react";
import { createProspect } from "../actions";
import { getTodayYmdIST } from "@/lib/prospectCommitmentRules";

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

/** Digits-only qty string → number for math (empty → 0). */
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

function NotesField({ id, inputClass }) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-slate-700"
      >
        Notes
      </label>
      <textarea
        id={id}
        name="notes"
        rows={3}
        maxLength={4000}
        placeholder="Optional — visible to admin and sales on the list"
        className={`${inputClass} min-h-[88px] resize-y py-2`}
      />
    </div>
  );
}

/** Order context but amount from quotation — unit price scales with qty. */
function ProspectOrderQuotationForm({ orderLock, inputClass }) {
  const minCommitmentYmd = useMemo(() => getTodayYmdIST(), []);
  const qUnit =
    Number.isFinite(Number(orderLock.readonlyAmount)) &&
    orderLock.readonlyAmount != null
      ? Number(orderLock.readonlyAmount)
      : 0;
  const [oqQtyStr, setOqQtyStr] = useState("");
  const oqNum = parseQtyNum(oqQtyStr);
  const oqLine = roundMoney(qUnit * oqNum);

  return (
    <form action={createProspect} className="space-y-4">
      <input type="hidden" name="customer_id" value={orderLock.customer_id} />
      {orderLock.order_id ? (
        <input type="hidden" name="order_id" value={String(orderLock.order_id)} />
      ) : null}
      <input type="hidden" name="qty" value={oqNum} />
      <input type="hidden" name="amount" value={oqLine} />
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Customer ID
        </label>
        <input
          type="text"
          readOnly
          value={orderLock.customer_id}
          className={`${inputClass} bg-slate-50 text-slate-800`}
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
        <input
          id="qty"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          value={oqQtyStr}
          onChange={(e) => setQtyStrFromInput(e.target.value, setOqQtyStr)}
          className={inputClass}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Total amount
        </label>
        <input
          type="text"
          readOnly
          value={oqLine.toFixed(2)}
          className={`${inputClass} bg-slate-50 text-slate-800`}
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
      <NotesField id="oq-notes" inputClass={inputClass} />
      <button
        type="submit"
        className="mt-2 w-full rounded-[10px] bg-slate-900 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        Save prospect
      </button>
    </form>
  );
}

/**
 * @param {object|null} orderLock - When set: customer_id + amount from order / quotation.
 * @param {{ customer_id: string, readonlyAmount: number, amountSource: 'order'|'quotation', order_id: string }} orderLock
 * @param {boolean} amountReadOnly - Sales: amount is quotation×qty only (no manual edit).
 */
export default function SingleProspectFormClient({
  inputClass,
  orderLock,
  amountReadOnly = false,
  /** When set (e.g. from ?quote_number=), customer blur loads this quote only, not latest. */
  prefillQuoteNumber,
}) {
  const minCommitmentYmd = useMemo(() => getTodayYmdIST(), []);
  const [unitPrice, setUnitPrice] = useState(0);
  const [qtyStr, setQtyStr] = useState("");

  const qtyNum = useMemo(() => parseQtyNum(qtyStr), [qtyStr]);
  const lineTotal = useMemo(
    () => roundMoney(unitPrice * qtyNum),
    [unitPrice, qtyNum],
  );

  if (orderLock?.customer_id) {
    const isOrderTotal = orderLock.amountSource === "order";

    if (isOrderTotal) {
      return <ProspectOrderTotalForm orderLock={orderLock} inputClass={inputClass} />;
    }

    return (
      <ProspectOrderQuotationForm orderLock={orderLock} inputClass={inputClass} />
    );
  }

  async function onCustomerIdBlur(e) {
    const id = String(e.target.value ?? "").trim();
    if (!id) {
      setUnitPrice(0);
      setQtyStr("");
      return;
    }
    try {
      const q =
        prefillQuoteNumber != null && String(prefillQuoteNumber).trim() !== ""
          ? `&quote_number=${encodeURIComponent(String(prefillQuoteNumber).trim())}`
          : "";
      const res = await fetch(
        `/api/prospects/customer-quotation-total?customer_id=${encodeURIComponent(id)}${q}`,
      );
      const data = await res.json().catch(() => ({}));
      if (
        res.ok &&
        data.success &&
        data.grand_total != null
      ) {
        setUnitPrice(Number(data.grand_total));
        setQtyStr("");
      } else {
        setUnitPrice(0);
        setQtyStr("");
      }
    } catch {
      /* keep unit price */
    }
  }

  return (
    <form action={createProspect} className="space-y-4">
      {prefillQuoteNumber ? (
        <div className="text-xs text-slate-600">
          Quotation{" "}
          <span className="font-mono font-medium">{prefillQuoteNumber}</span>{" "}
          prefill
        </div>
      ) : null}
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
          onBlur={onCustomerIdBlur}
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
        <input
          id="model"
          name="model"
          required
          className={inputClass}
        />
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
        {amountReadOnly ? (
          <input
            id="amount_display"
            type="text"
            readOnly
            tabIndex={-1}
            value={
              Number.isFinite(lineTotal) ? lineTotal.toFixed(2) : "0.00"
            }
            className={`${inputClass} bg-slate-50 text-slate-800`}
          />
        ) : (
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
        )}
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
      <NotesField id="prospect-notes" inputClass={inputClass} />
      <button
        type="submit"
        className="mt-2 w-full rounded-[10px] bg-slate-900 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        Save prospect
      </button>
    </form>
  );
}

function ProspectOrderTotalForm({ orderLock, inputClass }) {
  const minCommitmentYmd = useMemo(() => getTodayYmdIST(), []);
  const fixedTotal = Number(orderLock.readonlyAmount) || 0;
  const [qtyStr, setQtyStr] = useState("");
  const qtyNum = parseQtyNum(qtyStr);

  return (
    <form action={createProspect} className="space-y-4">
      <input type="hidden" name="customer_id" value={orderLock.customer_id} />
      {orderLock.order_id ? (
        <input type="hidden" name="order_id" value={String(orderLock.order_id)} />
      ) : null}
      <input type="hidden" name="amount" value={fixedTotal} />
      <input type="hidden" name="qty" value={qtyNum} />
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Customer ID
        </label>
        <input
          type="text"
          readOnly
          value={orderLock.customer_id}
          className={`${inputClass} bg-slate-50 text-slate-800`}
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
          htmlFor="order-lock-qty"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Qty
        </label>
        <input
          id="order-lock-qty"
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
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Total amount
        </label>
        <input
          type="text"
          readOnly
          value={fixedTotal.toFixed(2)}
          className={`${inputClass} bg-slate-50 text-slate-800`}
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
      <NotesField id="ot-notes" inputClass={inputClass} />
      <button
        type="submit"
        className="mt-2 w-full rounded-[10px] bg-slate-900 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        Save prospect
      </button>
    </form>
  );
}
