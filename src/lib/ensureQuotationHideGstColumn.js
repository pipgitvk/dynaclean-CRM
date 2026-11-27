/** `hide_gst_breakdown` on quotations_records — hides taxable column / GST breakdown on print & view. */

let schemaEnsured = false;

const QUOTATION_ITEM_TAX_COLUMNS = [
  "taxable_price",
  "total_taxable_amt",
  "gst",
  "cgsttax",
  "cgsttxamt",
  "sgsttax",
  "sgstxamt",
  "igsttax",
  "igsttamt",
];

const NEWORDER_TAX_COLUMNS = ["taxable_price", "gst"];

const INVOICE_ITEM_TAX_COLUMNS = [
  "cgst_percent",
  "sgst_percent",
  "igst_percent",
  "cgst_amount",
  "sgst_amount",
  "igst_amount",
];

async function makeColumnNullable(conn, table, column) {
  const [rows] = await conn.execute(
    `SELECT COLUMN_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  if (!rows?.length || rows[0].IS_NULLABLE === "YES") return;
  const colType = rows[0].COLUMN_TYPE;
  try {
    await conn.execute(
      `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${colType} NULL`,
    );
  } catch {
    /* table/column missing or alter not permitted */
  }
}

export async function ensureQuotationHideGstColumn(conn) {
  if (schemaEnsured) return;
  try {
    await conn.execute(
      `ALTER TABLE quotations_records ADD COLUMN hide_gst_breakdown TINYINT(1) NOT NULL DEFAULT 0`,
    );
  } catch {
    /* column exists or table missing */
  }
  for (const col of QUOTATION_ITEM_TAX_COLUMNS) {
    await makeColumnNullable(conn, "quotation_items", col);
  }
  for (const col of NEWORDER_TAX_COLUMNS) {
    await makeColumnNullable(conn, "neworder", col);
  }
  for (const col of INVOICE_ITEM_TAX_COLUMNS) {
    await makeColumnNullable(conn, "invoice_items", col);
  }
  try {
    await conn.execute(
      `ALTER TABLE invoices ADD COLUMN hide_gst_breakdown TINYINT(1) NOT NULL DEFAULT 0`,
    );
  } catch {
    /* exists */
  }
  schemaEnsured = true;
}

export function hideGstBreakdownFromBody(body) {
  if (body == null || typeof body !== "object") return 0;
  const v = body.hideGstBreakdown ?? body.hide_gst_breakdown;
  if (v === true || v === 1 || v === "1") return 1;
  return 0;
}

export function hideGstBreakdownFromRow(row) {
  if (!row) return false;
  const v = row.hide_gst_breakdown;
  return v === 1 || v === true || v === "1";
}

/** Line-level tax columns nulled when quotation hides GST breakdown. */
export function quotationItemTaxColumnsForDb(hide, taxFields) {
  if (!hide) return taxFields;
  return {
    ...taxFields,
    taxable_price: null,
    total_taxable_amt: null,
    gst: null,
    cgsttax: null,
    cgsttxamt: null,
    sgsttax: null,
    sgstxamt: null,
    igsttax: null,
    igsttamt: null,
  };
}

/** Line total stored/displayed when GST columns are hidden (ex-GST amount). */
export function quotationLineTotalAmount(hide, taxable, totalWithGst) {
  const t = Number(taxable) || 0;
  if (hide) return t;
  return Number(totalWithGst) || t;
}

/** Form summary: when hide, grand total = subtotal + round off (no GST). */
export function quotationSummaryTotals(
  hide,
  { subtotal, totalTax, roundOff, isAutoRoundOff, isInterstate },
) {
  const taxInTotal = hide ? 0 : totalTax;
  const totalBeforeRound = subtotal + taxInTotal;
  let finalRoundOff = parseFloat(roundOff) || 0;
  if (isAutoRoundOff) {
    finalRoundOff = Math.round(totalBeforeRound) - totalBeforeRound;
  }
  const grandTotal = totalBeforeRound + finalRoundOff;
  const cgst = hide || isInterstate ? 0 : totalTax / 2;
  const sgst = hide || isInterstate ? 0 : totalTax / 2;
  const igst = hide ? 0 : isInterstate ? totalTax : 0;
  return {
    subtotal,
    cgst,
    sgst,
    igst,
    totalTax: hide ? 0 : totalTax,
    grandTotal,
    finalRoundOff,
  };
}

export function neworderLineTaxFieldsForDb(hide, { taxable_price, gst }) {
  if (!hide) {
    return {
      taxable_price: taxable_price || null,
      gst: gst || null,
    };
  }
  return { taxable_price: null, gst: null };
}