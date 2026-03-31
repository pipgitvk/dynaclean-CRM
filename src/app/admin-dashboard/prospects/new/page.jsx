import Link from "next/link";
import { getSessionPayload } from "@/lib/auth";
import { getDbConnection } from "@/lib/db";
import {
  canAccessProspectsRole,
  isProspectsAdminRole,
  isProspectsSalesOnlyRole,
} from "@/lib/prospectAccess";
import {
  filterCustomerIdsForProspectUser,
  userMayUseCustomerForProspect,
} from "@/lib/prospectCustomerAccess";
import { createProspectsBulk } from "../actions";
import {
  firstSearchParam,
  parseCustomerIdsParam,
  parseQuoteNumbersParam,
} from "@/lib/prospectFilterUtils";
import { getLatestQuotationGrandTotalsByCustomerIds } from "@/lib/getLatestQuotationGrandTotals";
import {
  getGrandTotalForQuotation,
  getQuotationPrefillForProspects,
} from "@/lib/getQuotationPrefillForProspects";
import { getOrderProspectAmountContext } from "@/lib/getOrderProspectAmountContext";
import SingleProspectFormClient from "./SingleProspectFormClient";
import BulkProspectRowClient from "./BulkProspectRowClient";
import { getCustomerDisplayNamesByCustomerIds } from "@/lib/getCustomerDisplayNamesByCustomerIds";

export const dynamic = "force-dynamic";

const errorMessages = {
  required: "Each row needs Customer ID and Model.",
  qty: "Quantity must be at least 1 before saving.",
  unauthorized: "You are not allowed to add prospects.",
  db: "Could not save. Try again.",
  commitment_past:
    "Commitment date cannot be before today (India time). Use today or a future date.",
  too_many: "Too many prospect lines in one save (max 100). Remove some lines or save in batches.",
  forbidden_customer:
    "You can only add prospects for customers assigned to you (your leads).",
  duplicate_quote:
    "This quotation ID already has a prospect. Each quotation can only be added once — open the existing prospect or use a different quotation.",
  duplicate_quote_batch:
    "The same quotation ID appears more than once in this form. Remove the duplicate rows and save again.",
};

const inputClass =
  "h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200/90";

function pairKey(customerId, quoteNumber) {
  return `${String(customerId)}:::${String(quoteNumber)}`;
}

function sumLineTotalPrices(lines) {
  if (!lines?.length) return 0;
  const n = lines.reduce(
    (a, row) => a + (Number(row.total_price) || 0),
    0,
  );
  return Number.isFinite(n) ? n : 0;
}

export default async function NewProspectPage({ searchParams }) {
  const payload = await getSessionPayload();
  if (!payload || !canAccessProspectsRole(payload.role)) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
        Unauthorized. Only allowed roles can add prospects.
      </div>
    );
  }

  const resolved = await searchParams;
  const errKey = resolved?.error ? String(resolved.error) : "";
  const errorText = errorMessages[errKey] || null;

  const customerIds = parseCustomerIdsParam(
    String(resolved?.customers ?? ""),
  );
  const quoteNumberParam = firstSearchParam(resolved?.quote_number);
  const quoteNumbersParam = parseQuoteNumbersParam(
    String(resolved?.quote_numbers ?? ""),
  );

  const amountReadOnly = isProspectsSalesOnlyRole(payload.role);

  const conn = await getDbConnection();
  const allowedCustomerIds = await filterCustomerIdsForProspectUser(
    conn,
    customerIds,
    payload,
  );

  const orderIdParam = String(resolved?.order_id ?? "").trim();
  let orderCtx = orderIdParam
    ? await getOrderProspectAmountContext(orderIdParam)
    : null;
  if (orderCtx?.customer_id) {
    const okOrder = await userMayUseCustomerForProspect(
      conn,
      orderCtx.customer_id,
      payload,
    );
    if (!okOrder) orderCtx = null;
  }

  if (customerIds.length > 0) {
    if (allowedCustomerIds.length === 0) {
      return (
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-semibold text-amber-950">
            No allowed customers in this selection
          </h1>
          <p className="mt-2 text-sm text-amber-900">
            {isProspectsAdminRole(payload.role)
              ? "The customer IDs in the link were invalid or missing."
              : "You can only add prospects for customers assigned to you (same as your leads list). None of the selected IDs match your account."}
          </p>
          <Link
            href="/admin-dashboard/prospects"
            className="mt-4 inline-block text-sm font-medium text-amber-950 underline"
          >
            ← Back to Prospects
          </Link>
        </div>
      );
    }

    const customerToQuote = new Map();
    /** @type {Map<string, string[]>} */
    const quotesByCustomer = new Map();
    const allowedSet = new Set(allowedCustomerIds.map(String));

    const parallelQuotes =
      quoteNumbersParam.length > 0 &&
      quoteNumbersParam.length === customerIds.length;

    if (parallelQuotes) {
      customerIds.forEach((cid, idx) => {
        if (!allowedSet.has(String(cid)) || !quoteNumbersParam[idx]) return;
        const s = String(cid);
        const qn = quoteNumbersParam[idx];
        if (!quotesByCustomer.has(s)) quotesByCustomer.set(s, []);
        quotesByCustomer.get(s).push(qn);
        customerToQuote.set(s, qn);
      });
    } else if (quoteNumberParam) {
      for (const cid of allowedCustomerIds) {
        const s = String(cid);
        quotesByCustomer.set(s, [quoteNumberParam]);
        customerToQuote.set(s, quoteNumberParam);
      }
    } else if (
      allowedCustomerIds.length === 1 &&
      quoteNumbersParam.length > 0
    ) {
      const s = String(allowedCustomerIds[0]);
      if (allowedSet.has(s)) {
        quotesByCustomer.set(s, [...quoteNumbersParam]);
        customerToQuote.set(s, quoteNumbersParam[0]);
      }
    }

    /** Prefill lines keyed by pairKey(customerId, quoteNumber). */
    const prefillByPair = new Map();
    if (quotesByCustomer.size > 0) {
      const pairs = [];
      for (const [cid, qns] of quotesByCustomer) {
        for (const qn of qns) {
          pairs.push({ cid: String(cid), qn });
        }
      }
      const prefillResults = await Promise.all(
        pairs.map(({ cid, qn }) =>
          getQuotationPrefillForProspects(conn, qn, [cid], payload),
        ),
      );
      pairs.forEach(({ cid, qn }, idx) => {
        const pre = prefillResults[idx];
        const block = pre.quotationLinesByCustomer?.[cid];
        const lines = block?.lines?.length ? [...block.lines] : [];
        prefillByPair.set(pairKey(cid, qn), { lines });
      });
    }

    /** One form card per quotation (same customer_id may repeat). */
    const bulkFormRows = [];
    for (const id of allowedCustomerIds) {
      const s = String(id);
      const qns = quotesByCustomer.get(s) ?? [];
      if (qns.length === 0) {
        bulkFormRows.push({
          customerId: s,
          quoteNumber: null,
          lines: [],
          quoteAmount: 0,
        });
      } else if (qns.length === 1) {
        const qn = qns[0];
        const lines = prefillByPair.get(pairKey(s, qn))?.lines ?? [];
        bulkFormRows.push({
          customerId: s,
          quoteNumber: qn,
          lines,
          quoteAmount: sumLineTotalPrices(lines),
        });
      } else {
        for (const qn of qns) {
          const lines = prefillByPair.get(pairKey(s, qn))?.lines ?? [];
          bulkFormRows.push({
            customerId: s,
            quoteNumber: qn,
            lines,
            quoteAmount: sumLineTotalPrices(lines),
          });
        }
      }
    }

    const customerNamesById = await getCustomerDisplayNamesByCustomerIds(
      conn,
      allowedCustomerIds,
    );

    const bulkCustomerCount = bulkFormRows.length;
    const quoteNumbersAligned = bulkFormRows.map((r) =>
      r.quoteNumber ? String(r.quoteNumber).trim() : "",
    );
    const bulkHiddenQuoteNumberSingle =
      bulkCustomerCount === 1 && quoteNumbersAligned[0]
        ? quoteNumbersAligned[0]
        : "";
    const bulkHiddenQuoteNumbersCsv =
      bulkCustomerCount > 1 ? quoteNumbersAligned.join(",") : "";

    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-200 dark:bg-white">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Add prospects
            </h1>
            {customerToQuote.size > 0 ? (
              <p className="mt-2 text-xs font-medium text-slate-700">
                Lines and amounts use selected quotation(s) only.
              </p>
            ) : (
              <p className="mt-2 text-xs text-amber-700">
                No quotation selected. Search by quotation number on the Prospects page, select it, then click Add Prospects for pre-filled items.
              </p>
            )}
            <p className="mt-1 text-sm text-slate-500">
              {allowedCustomerIds.length} customer
              {allowedCustomerIds.length === 1 ? "" : "s"} from your selection
              {bulkFormRows.length > allowedCustomerIds.length ? (
                <>
                  {" "}
                  · {bulkFormRows.length} quotation
                  {bulkFormRows.length === 1 ? "" : "s"} (one card each)
                </>
              ) : null}
              {" "}
              — fill each block below.
              {!isProspectsAdminRole(payload.role) &&
              customerIds.length > allowedCustomerIds.length ? (
                <span className="mt-1 block text-amber-800">
                  Some IDs from the link were skipped (not assigned to you).
                </span>
              ) : null}
            </p>
            {orderCtx?.order_id ? (
              <p className="mt-2 text-xs text-slate-600">
                Order{" "}
                <span className="font-mono font-medium">{orderCtx.order_id}</span>
                : where Customer ID matches this order’s client,{" "}
                <strong>Amount</strong> is the order <strong>Total Amount</strong>{" "}
                (<code className="text-xs">neworder.totalamt</code>) and is
                read-only.
              </p>
            ) : null}
          </div>
          <Link
            href="/admin-dashboard/prospects"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            ← Back
          </Link>
        </div>

        {errorText ? (
          <div className="mb-4 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {errorText}
          </div>
        ) : null}

        <form action={createProspectsBulk} className="space-y-6">
          {bulkHiddenQuoteNumberSingle ? (
            <input
              type="hidden"
              name="prospects_quote_number"
              value={bulkHiddenQuoteNumberSingle}
            />
          ) : null}
          {bulkCustomerCount > 1 ? (
            <input
              type="hidden"
              name="prospects_quote_numbers"
              value={bulkHiddenQuoteNumbersCsv}
            />
          ) : null}
          <input
            type="hidden"
            name="customer_count"
            value={bulkCustomerCount}
          />
          {bulkFormRows.map((row, i) => {
            const orderLocked =
              Boolean(orderCtx?.customer_id) &&
              String(orderCtx.customer_id) === String(row.customerId) &&
              orderCtx.total_amount != null &&
              !Number.isNaN(Number(orderCtx.total_amount));

            const prefillQuoteNumberForRow = orderLocked
              ? orderCtx?.quote_number ?? row.quoteNumber
              : row.quoteNumber;

            return (
              <BulkProspectRowClient
                key={`${row.customerId}-${row.quoteNumber ?? "nq"}-${i}`}
                i={i}
                customerId={row.customerId}
                customerName={customerNamesById[String(row.customerId)] ?? null}
                initialQuoteAmount={row.quoteAmount}
                initialQuotationLines={
                  row.lines?.length ? row.lines : null
                }
                orderLocked={orderLocked}
                orderCtx={orderLocked ? orderCtx : null}
                prefillQuoteNumber={prefillQuoteNumberForRow}
                inputClass={inputClass}
                amountReadOnly={amountReadOnly}
              />
            );
          })}

          <button
            type="submit"
            className="w-full rounded-[10px] bg-slate-900 py-3 text-sm font-medium text-white transition hover:bg-slate-800 sm:w-auto sm:min-w-[200px]"
          >
            Submit
          </button>
        </form>
      </div>
    );
  }

  let singleOrderLock = null;
  if (orderCtx?.customer_id) {
    const cid = String(orderCtx.customer_id);
    if (
      orderCtx.total_amount != null &&
      !Number.isNaN(Number(orderCtx.total_amount))
    ) {
      singleOrderLock = {
        order_id: orderCtx.order_id,
        customer_id: cid,
        readonlyAmount: Number(orderCtx.total_amount),
        amountSource: "order",
      };
    } else {
      let qv = 0;
      if (orderCtx.quote_number) {
        const gt = await getGrandTotalForQuotation(
          conn,
          orderCtx.quote_number,
          cid,
        );
        if (gt != null) qv = gt;
      } else {
        const qMap = await getLatestQuotationGrandTotalsByCustomerIds([cid]);
        qv = qMap[cid] !== undefined ? Number(qMap[cid]) : 0;
      }
      singleOrderLock = {
        order_id: orderCtx.order_id,
        customer_id: cid,
        readonlyAmount: qv,
        amountSource: "quotation",
      };
    }
  }

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-200 dark:bg-white">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-slate-900">Add Prospect</h1>
        <Link
          href="/admin-dashboard/prospects"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← Back
        </Link>
      </div>

      {errorText ? (
        <div className="mb-4 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {errorText}
        </div>
      ) : null}

      <p className="mb-4 text-sm text-slate-500">
        Tip: select one or more customers on the Prospects page, then use{" "}
        <strong>Add Prospects</strong> to open a form for each ID. From an
        order page you can use <strong>Add prospect from this order</strong> to
        pass <code className="text-xs">order_id</code> — amount matches{" "}
        <strong>Total Amount</strong> on that order (read-only).
      </p>

      <SingleProspectFormClient
        inputClass={inputClass}
        orderLock={singleOrderLock}
        amountReadOnly={amountReadOnly}
        prefillQuoteNumber={quoteNumberParam || undefined}
      />
    </div>
  );
}
