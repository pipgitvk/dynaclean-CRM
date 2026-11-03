import LetterheadDocumentBlock from "@/components/invoice/LetterheadDocumentBlock";
import {
  mergeDocumentFromCompany,
  toInvoiceLetterheadShape,
} from "@/lib/documentFromCompany";
import { INVOICE_LETTERHEAD } from "@/lib/invoiceLetterhead";

function resolveLetterhead(values) {
  if (!values) return INVOICE_LETTERHEAD;
  return toInvoiceLetterheadShape(values);
}

/** Legacy inline block — prefer LetterheadDocumentBlock for page headers. */
export function LetterheadCompanyInfo({ values }) {
  return <LetterheadDocumentBlock values={values} className="rounded" />;
}

export function LetterheadViewerInfo({ values }) {
  return <LetterheadDocumentBlock values={values} />;
}

export function LetterheadBankLine({ values, label = "A/C Holder" }) {
  const h = resolveLetterhead(values);
  return (
    <p>
      {label}: {h.name}
    </p>
  );
}

export function LetterheadSignatoryLine({ values }) {
  const h = resolveLetterhead(values);
  return <p>For {h.name}</p>;
}

export { INVOICE_LETTERHEAD, mergeDocumentFromCompany, toInvoiceLetterheadShape };
