import { INVOICE_LETTERHEAD } from "@/lib/invoiceLetterhead";

export function LetterheadCompanyInfo({
  titleClassName = "text-xl font-bold text-red-600 mb-1",
}) {
  return (
    <div className="flex-1 text-sm text-gray-700">
      <h2 className={titleClassName}>{INVOICE_LETTERHEAD.name}</h2>
      <p className="leading-relaxed">
        <span className="block">{INVOICE_LETTERHEAD.addressLine1}</span>
        <span className="block">{INVOICE_LETTERHEAD.addressLine2}</span>
        <span className="block mt-1">
          <strong>Phone:</strong> {INVOICE_LETTERHEAD.phone}
        </span>
        <span className="block">
          <strong>Email:</strong> {INVOICE_LETTERHEAD.email}
        </span>
        <span className="block mt-1">
          <strong>GSTIN:</strong> {INVOICE_LETTERHEAD.gstin} |{" "}
          <strong>State:</strong> {INVOICE_LETTERHEAD.state}
        </span>
        <span className="block">
          <strong>CIN:</strong> {INVOICE_LETTERHEAD.cin}
        </span>
      </p>
    </div>
  );
}

export function LetterheadViewerInfo() {
  return (
    <div className="text-sm text-gray-700 break-words">
      <h2 className="text-lg font-bold text-red-600">
        {INVOICE_LETTERHEAD.name}
      </h2>
      <p>
        {INVOICE_LETTERHEAD.addressLine1} {INVOICE_LETTERHEAD.addressLine2}
      </p>
      <p>
        Email: {INVOICE_LETTERHEAD.email} | Contact: {INVOICE_LETTERHEAD.phone}
      </p>
      <p>
        GSTIN: {INVOICE_LETTERHEAD.gstin} | State: {INVOICE_LETTERHEAD.state}
      </p>
      <p>CIN: {INVOICE_LETTERHEAD.cin}</p>
    </div>
  );
}

export function LetterheadBankLine({ label = "A/C Holder" }) {
  return (
    <p>
      {label}: {INVOICE_LETTERHEAD.name}
    </p>
  );
}

export function LetterheadSignatoryLine() {
  return <p>For {INVOICE_LETTERHEAD.name}</p>;
}

export { INVOICE_LETTERHEAD };
