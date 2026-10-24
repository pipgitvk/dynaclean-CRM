/** Client: POST invoice PDF + payment summary to customer (manual send from table). */
export async function sendInvoiceCustomerEmail(invoiceId, customerEmail) {
  const email = customerEmail != null ? String(customerEmail).trim() : "";
  const res = await fetch(`/api/invoices/${invoiceId}/send-customer-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(email ? { customer_email: email } : {}),
  });
  const out = await res.json();
  return { res, out };
}

export function customerEmailSendMessage(out, emailForSuccess) {
  const n = out?.customerEmailNotice;
  if (out?.success && n?.sent) {
    return {
      type: "success",
      message: emailForSuccess
        ? `Invoice email ${emailForSuccess} par bhej diya gaya.`
        : "Invoice email customer ko bhej diya gaya.",
    };
  }
  if (n?.skipped && n.reason === "missing_customer_email") {
    return { type: "error", message: "Invoice par customer email nahi hai." };
  }
  if (n?.skipped && n.reason === "performa_invoice_no_email") {
    return { type: "error", message: "Performa invoice par email nahi bhejte." };
  }
  return {
    type: "error",
    message: out?.error || n?.error || n?.reason || "Email send nahi ho payi.",
  };
}
