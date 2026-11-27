import { hideGstBreakdownFromRow } from "@/lib/ensureQuotationHideGstColumn";

export function orderQuotationItemsHideTax(items, quotationRow) {
  if (hideGstBreakdownFromRow(quotationRow)) return true;
  if (!items?.length) return false;
  return items.every(
    (i) =>
      (i.gst == null || i.gst === "") &&
      (i.total_taxable_amt == null || i.total_taxable_amt === "") &&
      (i.taxable_price == null || i.taxable_price === ""),
  );
}