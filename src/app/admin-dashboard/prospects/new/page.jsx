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
};

const inputClass =
  "h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200/90";

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

    let quoteAmounts = {};
    let quotationLinesByCustomer = {};
    for (const id of allowedCustomerIds) {
      quotationLinesByCustomer[String(id)] = { quote_number: null, lines: [] };
    }

    const customerToQuote = new Map();
    const allowedSet = new Set(allowedCustomerIds.map(String));
    if (quoteNumbersParam.length > 0 && quoteNumbersParam.length === customerIds.length) {
      customerIds.forEach((cid, idx) => {
        if (allowedSet.has(String(cid)) && quoteNumbersParam[idx]) {
          customerToQuote.set(String(cid), quoteNumbersParam[idx]);
        }
      });
    } else if (quoteNumberParam) {
      allowedCustomerIds.forEach((cid) =>
        customerToQuote.set(String(cid), quoteNumberParam),
      );
    }

    if (customerToQuote.size > 0) {
      const prefillPromises = [...customerToQuote.entries()].map(
        ([cid, qn]) =>
          getQuotationPrefillForProspects(conn, qn, [cid], payload),
      );
      const prefillResults = await Promise.all(prefillPromises);
      for (const pre of prefillResults) {
        Object.assign(quoteAmounts, pre.quoteAmounts);
        Object.assign(quotationLinesByCustomer, pre.quotationLinesByCustomer);
      }
    }

    const customerNamesById = await getCustomerDisplayNamesByCustomerIds(
      conn,
      allowedCustomerIds,
    );

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
              — fill each row below.
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
          {customerToQuote.size === 1 ? (
            <input
              type="hidden"
              name="prospects_quote_number"
              value={[...customerToQuote.values()][0] ?? ""}
            />
          ) : null}
          {customerToQuote.size > 1 ? (
            <input
              type="hidden"
              name="prospects_quote_numbers"
              value={allowedCustomerIds.map((id) => customerToQuote.get(String(id)) ?? "").filter(Boolean).join(",")}
            />
          ) : null}
          <input
            type="hidden"
            name="customer_count"
            value={allowedCustomerIds.length}
          />
          {allowedCustomerIds.map((id, i) => {
            const orderLocked =
              orderCtx?.customer_id &&
              String(orderCtx.customer_id) === String(id) &&
              orderCtx.total_amount != null &&
              !Number.isNaN(Number(orderCtx.total_amount));

            const prefillQuoteNumberForCustomer = orderLocked
              ? orderCtx?.quote_number ?? null
              : quotationLinesByCustomer[String(id)]?.quote_number ??
                null;

            return (
              <BulkProspectRowClient
                key={id}
                i={i}
                customerId={id}
                customerName={customerNamesById[String(id)] ?? null}
                initialQuoteAmount={quoteAmounts[String(id)]}
                initialQuotationLines={
                  quotationLinesByCustomer[String(id)]?.lines?.length
                    ? quotationLinesByCustomer[String(id)].lines
                    : null
                }
                orderLocked={orderLocked}
                orderCtx={orderLocked ? orderCtx : null}
                prefillQuoteNumber={prefillQuoteNumberForCustomer}
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
