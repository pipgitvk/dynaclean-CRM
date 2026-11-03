import {
  DEFAULT_DOCUMENT_FROM_COMPANY,
  mergeDocumentFromCompany,
  toInvoiceLetterheadShape,
} from "@/lib/documentFromCompany";

/** Letterhead copy for invoice / quotation PDF and web preview. */
export const INVOICE_LETTERHEAD = toInvoiceLetterheadShape(
  DEFAULT_DOCUMENT_FROM_COMPANY,
);

export { mergeDocumentFromCompany, toInvoiceLetterheadShape };
