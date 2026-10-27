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
 * IGST when buyer place-of-supply state ≠ supplier (Delhi 07).
 * Different GSTIN in the same state still uses CGST+SGST (same as quotation form).
 */
/** GST slab for products whose name indicates battery-operated equipment. */
export const BATTERY_OPERATED_GST_PERCENT = 5;

export function isBatteryOperatedProductName(name) {
  const n = String(name || "").toLowerCase();
  return (
    /\bbattery[\s-]*operated\b/.test(n) ||
    /\bbettery[\s-]*operated\b/.test(n)
  );
}

export function isBatteryOperatedInvoiceItem(item) {
  return (
    isBatteryOperatedProductName(item?.item_name) ||
    isBatteryOperatedProductName(item?.description) ||
    isBatteryOperatedProductName(item?.item_code)
  );
}

export function effectiveGstPercentForProduct(
  { item_name, item_code, description, gst_rate },
  fallback = 18,
) {
  if (
    isBatteryOperatedProductName(item_name) ||
    isBatteryOperatedProductName(item_code) ||
    isBatteryOperatedProductName(description)
  ) {
    return BATTERY_OPERATED_GST_PERCENT;
  }
  const rate = Number(gst_rate);
  if (rate > 0) return rate;
  return fallback;
}

export function isInterstateInvoiceSupply({
  buyerGstin,
  buyerStateCode,
  stateDisplay,
  parseCodeFromDisplay,
}) {
  const buyerGst = normalizeGstin(buyerGstin);

  const code =
    buyerStateCode?.toString().trim() ||
    (typeof parseCodeFromDisplay === "function"
      ? parseCodeFromDisplay(stateDisplay)
      : parseStateCodeFromDisplay(stateDisplay)) ||
    getStateCodeFromGstin(buyerGst);

  if (!code) return false;
  return code !== SUPPLIER_STATE_CODE;
}

/** Product-stock `gst_rate` first; else battery 5%; else line %; else default (18%). */
export function totalGstPercentFromInvoiceItem(item, fallback = 18) {
  const catalogGst =
    item?.gst_rate != null && String(item.gst_rate).trim() !== ""
      ? item.gst_rate
      : item?.product_gst_rate;

  if (
    catalogGst != null &&
    String(catalogGst).trim() !== "" &&
    Number(catalogGst) > 0
  ) {
    return Number(catalogGst);
  }

  if (isBatteryOperatedInvoiceItem(item)) {
    return BATTERY_OPERATED_GST_PERCENT;
  }

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

export function invoiceLineTaxableValue(item) {
  const qty = Number(item?.quantity) || 0;
  const rate = Number(item?.rate) || 0;
  const discountAmount = Number(item?.discount_amount) || 0;
  return qty * rate - discountAmount;
}

/** One row per tax type + rate with the taxable base that actually attracted that rate. */
export function buildInvoiceTaxTableRows(items) {
  const buckets = {
    CGST: new Map(),
    SGST: new Map(),
    IGST: new Map(),
  };

  for (const item of items || []) {
    const taxable = invoiceLineTaxableValue(item);
    const pairs = [
      ["CGST", Number(item.cgst_percent) || 0],
      ["SGST", Number(item.sgst_percent) || 0],
      ["IGST", Number(item.igst_percent) || 0],
    ];
    for (const [type, rate] of pairs) {
      if (rate <= 0) continue;
      const map = buckets[type];
      const prev = map.get(rate) || { taxableAmount: 0, taxAmount: 0 };
      prev.taxableAmount += taxable;
      prev.taxAmount += (taxable * rate) / 100;
      map.set(rate, prev);
    }
  }

  const rows = [];
  for (const type of ["CGST", "SGST", "IGST"]) {
    const rates = [...buckets[type].keys()].sort((a, b) => a - b);
    for (const rate of rates) {
      const { taxableAmount, taxAmount } = buckets[type].get(rate);
      rows.push({ type, rate, taxableAmount, taxAmount });
    }
  }
  return rows;
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
      gst: totalGst,
      ...splitGstPercentForSupply(totalGst, interstate),
    };
  });
}

/** Header CGST/SGST/IGST % for summary when all lines share one GST slab. */
export function invoiceHeaderTaxRates(items, interstate, fallbackTotalGst = 18) {
  const lines = items || [];
  if (lines.length === 0) {
    return headerRatesForInterstate(interstate, fallbackTotalGst);
  }

  const unique = (values) => [...new Set(values.filter((v) => v > 0))];
  const cgstRates = unique(lines.map((l) => Number(l.cgst_percent) || 0));
  const sgstRates = unique(lines.map((l) => Number(l.sgst_percent) || 0));
  const igstRates = unique(lines.map((l) => Number(l.igst_percent) || 0));

  if (interstate) {
    return {
      cgstRate: 0,
      sgstRate: 0,
      igstRate: igstRates.length === 1 ? igstRates[0] : 0,
    };
  }

  return {
    cgstRate: cgstRates.length === 1 ? cgstRates[0] : 0,
    sgstRate: sgstRates.length === 1 ? sgstRates[0] : 0,
    igstRate: 0,
  };
}

export function headerRatesForInterstate(interstate, defaultTotalGst = 18) {
  if (interstate) {
    return { cgstRate: 0, sgstRate: 0, igstRate: defaultTotalGst };
  }
  const half = defaultTotalGst / 2;
  return { cgstRate: half, sgstRate: half, igstRate: 0 };
}
