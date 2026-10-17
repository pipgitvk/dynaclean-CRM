import { useEffect, useRef } from "react";
import { sumPaymentAmountCsv } from "@/lib/orderPaymentHistory";

/**
 * Prefill order upload form from latest tax invoice + linked statement payments.
 */
export function useOrderUploadInvoicePrefill(orderId, setForm, { onPrefilled } = {}) {
  const appliedRef = useRef(false);

  useEffect(() => {
    const id = String(orderId || "").trim();
    if (!id || appliedRef.current) return;

    (async () => {
      try {
        const res = await fetch(
          `/api/orders/invoice-upload-prefill?order_id=${encodeURIComponent(id)}`,
        );
        const data = await res.json();
        if (!res.ok || !data?.found) return;

        appliedRef.current = true;

        const base = Number(data.baseAmount);
        const tax = Number(data.taxamt);
        const total = Number(data.totalamt);
        const payCsv = data.payment_amount;
        const payTotal = sumPaymentAmountCsv(payCsv);
        const payDisplay =
          payCsv && String(payCsv).includes(",")
            ? payTotal.toFixed(2)
            : payCsv
              ? String(payCsv)
              : payTotal > 0
                ? payTotal.toFixed(2)
                : "";

        setForm((prev) => ({
          ...prev,
          invoice_number: data.invoice_number || prev.invoice_number,
          duedate: data.invoice_date
            ? String(data.invoice_date).slice(0, 10)
            : prev.duedate,
          baseAmount:
            Number.isFinite(base) && base > 0
              ? base.toFixed(2)
              : prev.baseAmount,
          taxamt:
            Number.isFinite(tax) && tax >= 0 ? tax.toFixed(2) : prev.taxamt,
          totalamt:
            Number.isFinite(total) && total > 0
              ? total.toFixed(2)
              : prev.totalamt,
          payment_id: data.payment_id || prev.payment_id,
          payment_date: data.payment_date
            ? String(data.payment_date).split(",")[0].trim().slice(0, 10)
            : prev.payment_date,
          payment_amount: payDisplay || prev.payment_amount,
        }));

        onPrefilled?.(data);
      } catch {
        /* optional prefill */
      }
    })();
  }, [orderId, setForm, onPrefilled]);
}
