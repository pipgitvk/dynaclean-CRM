"use client";

import { useCallback, useMemo, useState } from "react";
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

function newLineId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * @param {Array<{ model: string, quantity: number, total_price: number, price_per_unit: number }>|null|undefined} initialQuotationLines - from latest quotation_items for this customer
 */
function buildLinesFromQuotation(initialQuotationLines, seedUnit, orderLocked) {
  if (!initialQuotationLines?.length) {
    return [{ id: newLineId(), qtyStr: "", model: "", unitPrice: seedUnit }];
  }
  return initialQuotationLines.map((row) => {
    const q = Math.max(0, parseInt(String(row.quantity ?? 0), 10) || 0);
    const tp = Number(row.total_price) || 0;
    const ppu = Number(row.price_per_unit) || 0;
    let unitPrice = seedUnit;
    if (!orderLocked) {
      unitPrice = q > 0 ? roundMoney(tp / q) : ppu || seedUnit;
      if (!Number.isFinite(unitPrice)) unitPrice = seedUnit;
    }
    return {
      id: newLineId(),
      qtyStr: q > 0 ? String(q) : "",
      model: String(row.model ?? "").trim(),
      unitPrice,
    };
  });
}

/**
 * Bulk block per customer: multiple Model+Qty+Amount rows, shared commitment + notes.
 */
export default function BulkProspectRowClient({
  i,
  customerId,
  initialQuoteAmount,
  initialQuotationLines,
  orderLocked,
  orderCtx,
  prefillQuoteNumber,
  inputClass,
  amountReadOnly = false,
}) {
  const initialUnit =
    initialQuoteAmount !== undefined && initialQuoteAmount !== null
      ? Number(initialQuoteAmount)
      : 0;
  const seedUnit = Number.isFinite(initialUnit) ? initialUnit : 0;

  const minCommitmentYmd = useMemo(() => getTodayYmdIST(), []);

  /** Rows prefilled from latest quotation — model / qty / amount are read-only. */
  const quotationLocked = Boolean(initialQuotationLines?.length);

  const [lines, setLines] = useState(() =>
    buildLinesFromQuotation(initialQuotationLines, seedUnit, !!orderLocked),
  );

  const updateLine = useCallback((id, patch) => {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    );
  }, []);

  if (orderLocked) {
    const total = Number(orderCtx.total_amount);
    return (
      <fieldset className="rounded-[10px] border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
        <legend className="px-1 text-sm font-semibold text-slate-800">
          Customer ID:{" "}
          <span className="font-mono text-slate-900">{customerId}</span>
        </legend>
        {prefillQuoteNumber ? (
          <p className="mt-2 text-xs text-slate-600">
            Quotation{" "}
            <span className="font-mono font-medium">{prefillQuoteNumber}</span>
          </p>
        ) : null}
        <input type="hidden" name={`customer_id_${i}`} value={customerId} />
        {orderCtx?.order_id ? (
          <input
            type="hidden"
            name={`order_id_${i}`}
            value={String(orderCtx.order_id)}
          />
        ) : null}
        <input type="hidden" name={`line_count_${i}`} value={lines.length} />

        <div className="mt-4 space-y-3">
          {lines.map((line, j) => {
            const qn = parseQtyNum(line.qtyStr);
            return (
              <div
                key={line.id}
                className="flex flex-col gap-2 rounded-lg border border-slate-200/80 bg-white/60 p-3 sm:flex-row sm:items-end sm:gap-3"
              >
                <input type="hidden" name={`qty_${i}_${j}`} value={qn} />
                <input
                  type="hidden"
                  name={`amount_${i}_${j}`}
                  value={Number.isFinite(total) ? total : 0}
                />
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor={`model_${i}_${j}`}
                    className="mb-1 block text-xs font-medium text-slate-600 sm:text-sm"
                  >
                    Model
                  </label>
                  <input
                    id={`model_${i}_${j}`}
                    name={`model_${i}_${j}`}
                    value={line.model}
                    readOnly={quotationLocked}
                    onChange={(e) =>
                      updateLine(line.id, { model: e.target.value })
                    }
                    className={
                      quotationLocked
                        ? `${inputClass} cursor-default bg-slate-50 text-slate-800`
                        : inputClass
                    }
                  />
                </div>
                <div className="w-full sm:w-24">
                  <label
                    htmlFor={`qty_${i}_${j}_vis`}
                    className="mb-1 block text-xs font-medium text-slate-600 sm:text-sm"
                  >
                    Qty
                  </label>
                  <input
                    id={`qty_${i}_${j}_vis`}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0"
                    value={line.qtyStr}
                    readOnly={quotationLocked}
                    onChange={(e) =>
                      setQtyStrFromInput(e.target.value, (v) =>
                        updateLine(line.id, { qtyStr: v }),
                      )
                    }
                    className={
                      quotationLocked
                        ? `${inputClass} cursor-default bg-slate-50 text-slate-800`
                        : inputClass
                    }
                  />
                </div>
                <div className="w-full sm:w-36">
                  <label className="mb-1 block text-xs font-medium text-slate-600 sm:text-sm">
                    Total amount
                  </label>
                  <input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={Number.isFinite(total) ? total.toFixed(2) : "0.00"}
                    className={`${inputClass} bg-slate-50 text-slate-800`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label
              htmlFor={`commitment_date_${i}`}
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Commitment date
            </label>
            <input
              id={`commitment_date_${i}`}
              name={`commitment_date_${i}`}
              type="date"
              min={minCommitmentYmd}
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor={`notes_${i}`}
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Notes
            </label>
            <textarea
              id={`notes_${i}`}
              name={`notes_${i}`}
              rows={3}
              maxLength={4000}
              placeholder="Optional — visible to admin and sales on the list"
              className={`${inputClass} min-h-[88px] resize-y py-2`}
            />
          </div>
        </div>
      </fieldset>
    );
  }

  return (
    <fieldset className="rounded-[10px] border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
      <legend className="px-1 text-sm font-semibold text-slate-800">
        Customer ID:{" "}
        <span className="font-mono text-slate-900">{customerId}</span>
      </legend>
      <input type="hidden" name={`customer_id_${i}`} value={customerId} />
      <input type="hidden" name={`line_count_${i}`} value={lines.length} />

      {prefillQuoteNumber ? (
        <p className="mt-2 text-xs text-slate-600">
          Quotation{" "}
          <span className="font-mono font-medium">{prefillQuoteNumber}</span>
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        {lines.map((line, j) => {
          const qn = parseQtyNum(line.qtyStr);
          const lineTotal = roundMoney(line.unitPrice * qn);
          const amountLocked = quotationLocked || amountReadOnly;
          return (
            <div
              key={line.id}
              className="flex flex-col gap-2 rounded-lg border border-slate-200/80 bg-white/60 p-3 sm:flex-row sm:items-end sm:gap-3"
            >
              <input type="hidden" name={`qty_${i}_${j}`} value={qn} />
              <input
                type="hidden"
                name={`amount_${i}_${j}`}
                value={Number.isFinite(lineTotal) ? lineTotal : 0}
              />
              <div className="min-w-0 flex-1">
                <label
                  htmlFor={`model_${i}_${j}`}
                  className="mb-1 block text-xs font-medium text-slate-600 sm:text-sm"
                >
                  Model
                </label>
                <input
                  id={`model_${i}_${j}`}
                  name={`model_${i}_${j}`}
                  value={line.model}
                  readOnly={quotationLocked}
                  onChange={(e) =>
                    updateLine(line.id, { model: e.target.value })
                  }
                  className={
                    quotationLocked
                      ? `${inputClass} cursor-default bg-slate-50 text-slate-800`
                      : inputClass
                  }
                />
              </div>
              <div className="w-full sm:w-24">
                <label
                  htmlFor={`qty_vis_${i}_${j}`}
                  className="mb-1 block text-xs font-medium text-slate-600 sm:text-sm"
                >
                  Qty
                </label>
                <input
                  id={`qty_vis_${i}_${j}`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0"
                  value={line.qtyStr}
                  readOnly={quotationLocked}
                  onChange={(e) =>
                    setQtyStrFromInput(e.target.value, (v) =>
                      updateLine(line.id, { qtyStr: v }),
                    )
                  }
                  className={
                    quotationLocked
                      ? `${inputClass} cursor-default bg-slate-50 text-slate-800`
                      : inputClass
                  }
                />
              </div>
              <div className="w-full sm:w-36">
                <label className="mb-1 block text-xs font-medium text-slate-600 sm:text-sm">
                  Total amount
                </label>
                {amountLocked ? (
                  <input
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
                    type="number"
                    step="0.01"
                    min={0}
                    value={Number.isFinite(lineTotal) ? lineTotal : 0}
                    onChange={(e) => {
                      const v =
                        parseFloat(String(e.target.value).replace(/,/g, "")) ||
                        0;
                      updateLine(line.id, {
                        unitPrice:
                          qn > 0 ? roundMoney(v / qn) : v,
                      });
                    }}
                    className={inputClass}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <label
            htmlFor={`commitment_date_${i}`}
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Commitment date
          </label>
          <input
            id={`commitment_date_${i}`}
            name={`commitment_date_${i}`}
            type="date"
            min={minCommitmentYmd}
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor={`notes_bulk_${i}`}
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Notes
          </label>
          <textarea
            id={`notes_bulk_${i}`}
            name={`notes_${i}`}
            rows={3}
            maxLength={4000}
            placeholder="Optional — visible to admin and sales on the list"
            className={`${inputClass} min-h-[88px] resize-y py-2`}
          />
        </div>
      </div>
    </fieldset>
  );
}
