/** Default terms for tax invoices (create form). */
export const DEFAULT_TAX_INVOICE_TERMS = `1. Payment due within specified due date.
2. Late payment charges: Interest charges at the rate of 1.5% per month or as per MSME act 2006, whichever is higher will be charged on overdue amounts from the invoice due date.
3. All disputes subject to Delhi jurisdiction.
4. Goods once sold will not be taken back.

Thanks for doing business with us!`;

/** CAMC clause shown on proforma / performa invoices. */
export const PERFORMA_CAMC_TERMS_PARAGRAPH =
  "This Proforma Invoice includes the cost of the product along with the CAMC policy. If the organization makes payment for the product only, the CAMC policy will not be included in the purchase. In such a case, the organization will be required to purchase the CAMC policy separately at an additional cost of 8% of the product value per year. CAMC coverage shall be applicable only upon payment of the applicable CAMC charges.";

export function getDefaultPerformaInvoiceTerms() {
  return `${PERFORMA_CAMC_TERMS_PARAGRAPH}\n\n${DEFAULT_TAX_INVOICE_TERMS}`;
}

export function isPerformaInvoiceType(type) {
  return String(type || "").trim().toLowerCase() === "performa";
}

const CAMC_TERMS_MARKER = "CAMC policy will not be included";

/** Terms for edit/create when type is performa; preserves saved text when present. */
export function resolvePerformaInvoiceTerms(termsConditions) {
  const saved = String(termsConditions || "").trim();
  if (!saved) return getDefaultPerformaInvoiceTerms();
  if (saved.includes(CAMC_TERMS_MARKER)) return saved;
  return `${PERFORMA_CAMC_TERMS_PARAGRAPH}\n\n${saved}`;
}
