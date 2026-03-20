import Link from "next/link";
import { getSessionPayload } from "@/lib/auth";
import {
  canAccessProspectsRole,
  isProspectsSalesOnlyRole,
} from "@/lib/prospectAccess";
import { createProspectsBulk } from "../actions";
import { parseCustomerIdsParam } from "@/lib/prospectFilterUtils";
import { getLatestQuotationGrandTotalsByCustomerIds } from "@/lib/getLatestQuotationGrandTotals";
import { getLatestQuotationItemsByCustomerIds } from "@/lib/getLatestQuotationItemsByCustomerIds";
import { getOrderProspectAmountContext } from "@/lib/getOrderProspectAmountContext";
import SingleProspectFormClient from "./SingleProspectFormClient";
import BulkProspectRowClient from "./BulkProspectRowClient";

export const dynamic = "force-dynamic";

const errorMessages = {
  required: "Each row needs Customer ID and Model.",
  qty: "Quantity must be at least 1 before saving.",
  unauthorized: "You are not allowed to add prospects.",
  db: "Could not save. Try again.",
  commitment_past:
    "Commitment date cannot be before today (India time). Use today or a future date.",
  too_many: "Too many prospect lines in one save (max 100). Remove some lines or save in batches.",
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

  const amountReadOnly = isProspectsSalesOnlyRole(payload.role);

  const orderIdParam = String(resolved?.order_id ?? "").trim();
  const orderCtx = orderIdParam
    ? await getOrderProspectAmountContext(orderIdParam)
    : null;

  if (customerIds.length > 0) {
    const [quoteAmounts, quotationLinesByCustomer] = await Promise.all([
      getLatestQuotationGrandTotalsByCustomerIds(customerIds),
      getLatestQuotationItemsByCustomerIds(customerIds),
    ]);

    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-200 dark:bg-white">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Add prospects
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {customerIds.length} customer
              {customerIds.length === 1 ? "" : "s"} from your selection — fill
              each row below.
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
          <input type="hidden" name="customer_count" value={customerIds.length} />
          {customerIds.map((id, i) => {
            const orderLocked =
              orderCtx?.customer_id &&
              String(orderCtx.customer_id) === String(id) &&
              orderCtx.total_amount != null &&
              !Number.isNaN(Number(orderCtx.total_amount));

            return (
              <BulkProspectRowClient
                key={id}
                i={i}
                customerId={id}
                initialQuoteAmount={quoteAmounts[String(id)]}
                initialQuotationLines={
                  quotationLinesByCustomer[String(id)]?.lines?.length
                    ? quotationLinesByCustomer[String(id)].lines
                    : null
                }
                orderLocked={orderLocked}
                orderCtx={orderLocked ? orderCtx : null}
                inputClass={inputClass}
                amountReadOnly={amountReadOnly}
              />
            );
          })}

          <button
            type="submit"
            className="w-full rounded-[10px] bg-slate-900 py-3 text-sm font-medium text-white transition hover:bg-slate-800 sm:w-auto sm:min-w-[200px]"
          >
            Final submit
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
      const qMap = await getLatestQuotationGrandTotalsByCustomerIds([cid]);
      const qv = qMap[cid];
      singleOrderLock = {
        order_id: orderCtx.order_id,
        customer_id: cid,
        readonlyAmount: qv !== undefined ? Number(qv) : 0,
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
      />
    </div>
  );
}
