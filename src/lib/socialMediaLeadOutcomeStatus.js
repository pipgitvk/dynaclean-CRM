/** Customer status treated as lost / cancelled on social media leads report. */
export function isCustomerCancelStatus(status) {
  const s = String(status || "").trim().toLowerCase();
  if (!s) return false;
  return (
    s === "denied" ||
    s === "invalid" ||
    s.includes("denied") ||
    s.includes("invalid")
  );
}

/** Only Cancel (denied/invalid) and Won (order processed: account_status=1 & dispatch_status=1) are shown. */
export function resolveSocialMediaLeadOutcomeStatus(lead) {
  const crmStatus = lead.crm_status;
  const hasCustomer = Boolean(
    lead.crm_customer_id || lead.resolved_customer_id,
  );

  if (hasCustomer && isCustomerCancelStatus(crmStatus)) {
    const crmStatusLabel = String(crmStatus || "").trim();
    return {
      label: "Cancel",
      tone: "cancel",
      crmStatus: crmStatusLabel || undefined,
    };
  }

  const wonOrder =
    lead.has_dispatched_order === 1 ||
    lead.has_dispatched_order === true ||
    Number(lead.has_dispatched_order) === 1;

  if (hasCustomer && wonOrder) {
    return { label: "Won", tone: "won" };
  }

  return { label: "", tone: "none" };
}