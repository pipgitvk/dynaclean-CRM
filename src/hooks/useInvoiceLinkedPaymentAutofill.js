import { useEffect, useRef } from "react";

/**
 * When invoice number is entered, fill payment_amount (and UTR/date when available)
 * from statement-linked invoice payment data.
 */
export function useInvoiceLinkedPaymentAutofill(invoiceNumber, setForm) {
  const lastAppliedKey = useRef("");

  useEffect(() => {
    const num = String(invoiceNumber || "").trim();
    if (num.length < 2) return;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/orders/invoice-linked-payment?invoice_number=${encodeURIComponent(num)}`,
        );
        const data = await res.json();
        if (!res.ok || !data?.found) return;

        const amount = Number(data.payment_amount);
        const hasAmount = Number.isFinite(amount) && amount > 0;
        const paymentId = data.payment_id ? String(data.payment_id).trim() : "";
        const paymentDateRaw = data.payment_date ? String(data.payment_date) : "";
        const paymentDate = paymentDateRaw.includes(",")
          ? paymentDateRaw.split(",")[0].trim().slice(0, 10)
          : paymentDateRaw.slice(0, 10);

        const key = `${num}|${hasAmount ? amount : ""}|${paymentId}|${paymentDate}`;
        if (lastAppliedKey.current === key) return;
        lastAppliedKey.current = key;

        setForm((prev) => {
          const next = { ...prev };
          if (hasAmount) {
            next.payment_amount = amount.toFixed(2);
          }
          if (paymentId) {
            next.payment_id = paymentId;
          }
          if (paymentDate) {
            next.payment_date = paymentDate;
          }
          return next;
        });
      } catch {
        // ignore; user can enter payment manually
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [invoiceNumber, setForm]);
}
