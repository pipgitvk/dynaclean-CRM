import { INVOICE_LETTERHEAD } from "@/lib/invoiceLetterhead";

/** Dynaclean registered GSTIN (Delhi — state code 07). */
export const SUPPLIER_GSTIN = INVOICE_LETTERHEAD.gstin;
export const SUPPLIER_STATE_CODE = "07";

export function normalizeGstin(value) {
  return (value ?? "").toString().trim().toUpperCase();
}

/** e.g. "Gujarat (24)" → "24" */
export function parseStateCodeFromDisplay(display) {
  if (!display) return null;
  const match = String(display).match(/\((\d{2})\)$/);
  return match ? match[1] : null;
}

export function getStateCodeFromGstin(gstin) {
  const g = normalizeGstin(gstin);
  if (g.length < 2) return null;
  return g.slice(0, 2);
}

/**
 * IGST when buyer GSTIN ≠ company GSTIN, or buyer state code ≠ 07 (Delhi).
 * Same rules as quotation create form.
 */
export function isInterstateInvoiceSupply({
  buyerGstin,
  buyerStateCode,
  stateDisplay,
  parseCodeFromDisplay,
}) {
  const buyerGst = normalizeGstin(buyerGstin);
  if (buyerGst && buyerGst !== normalizeGstin(SUPPLIER_GSTIN)) {
    return true;
  }

  const code =
    buyerStateCode?.toString().trim() ||
    (typeof parseCodeFromDisplay === "function"
      ? parseCodeFromDisplay(stateDisplay)
      : parseStateCodeFromDisplay(stateDisplay)) ||
    getStateCodeFromGstin(buyerGst);

  if (!code) return false;
  return code !== SUPPLIER_STATE_CODE;
}

export function totalGstPercentFromInvoiceItem(item, fallback = 18) {
  const igst = Number(item?.igst_percent) || 0;
  const cgst = Number(item?.cgst_percent) || 0;
  const sgst = Number(item?.sgst_percent) || 0;
  const combined = cgst + sgst;
  if (igst > 0) return igst;
  if (combined > 0) return combined;
  const gst = Number(item?.gst);
  if (gst > 0) return gst;
  return fallback;
}

export function splitGstPercentForSupply(totalGstPercent, interstate) {
  const total = Number(totalGstPercent) || 18;
  if (interstate) {
    return { cgst_percent: 0, sgst_percent: 0, igst_percent: total };
  }
  const half = total / 2;
  return { cgst_percent: half, sgst_percent: half, igst_percent: 0 };
}

export function applyTaxPercentsToInvoiceItems(items, interstate) {
  return (items || []).map((item) => {
    const totalGst = totalGstPercentFromInvoiceItem(item);
    return {
      ...item,
      ...splitGstPercentForSupply(totalGst, interstate),
    };
  });
}

export function headerRatesForInterstate(interstate, defaultTotalGst = 18) {
  if (interstate) {
    return { cgstRate: 0, sgstRate: 0, igstRate: defaultTotalGst };
  }
  const half = defaultTotalGst / 2;
  return { cgstRate: half, sgstRate: half, igstRate: 0 };
}
