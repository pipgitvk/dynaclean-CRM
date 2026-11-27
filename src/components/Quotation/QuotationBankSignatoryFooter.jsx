import Image from "next/image";
import {
  quotationBankFooter,
  quotationSignatoryFor,
} from "@/lib/quotationFooterBank";

export function QuotationBankDetailsBlock({
  className = "",
  hideGstBreakdown = false,
}) {
  const b = quotationBankFooter(hideGstBreakdown);
  return (
    <div className={`border p-4 rounded bg-gray-50 text-sm ${className}`}>
      <h4 className="font-semibold mb-2">Bank Details</h4>
      <p>A/C Holder Name: {b.accountHolder}</p>
      <p>Bank Name : {b.bankName}</p>
      <p>A/c no. : {b.accountNo}</p>
      <p>Branch & IFS Code: {b.ifsc}</p>
    </div>
  );
}

export function QuotationSignatoryBlock({
  className = "",
  hideGstBreakdown = false,
}) {
  const signatoryFor = quotationSignatoryFor(hideGstBreakdown);
  return (
    <div
      className={`border p-4 rounded bg-gray-50 text-sm text-center flex flex-col justify-between ${className}`}
    >
      <div>
        <p>{signatoryFor}</p>
        <Image
          src="/images/sign.png"
          alt="Sign"
          width={100}
          height={80}
          className="mx-auto mt-2"
          unoptimized
        />
      </div>
      <p className="mt-2 font-semibold">Authorized Signatory</p>
    </div>
  );
}

/** Viewer / PDF layout (larger sign image). */
export function QuotationViewerBankSignatoryFooter({
  hideGstBreakdown = false,
}) {
  const b = quotationBankFooter(hideGstBreakdown);
  const signatoryFor = quotationSignatoryFor(hideGstBreakdown);
  return (
    <>
      <div className="border p-4 rounded bg-gray-50">
        <h4 className="font-semibold mb-1">Bank Details</h4>
        <p>A/C Holder Name: {b.accountHolder}</p>
        <p>Bank Name : {b.bankName}</p>
        <p>A/c no. : {b.accountNo}</p>
        <p>Branch & IFS Code: {b.ifsc}</p>
      </div>
      <div className="border p-4 rounded bg-gray-50 text-center flex flex-col justify-between">
        <div>
          <p>{signatoryFor}</p>
          <Image
            src="/images/sign.png"
            alt="Sign"
            width={250}
            height={10}
            className="mx-auto mt-2"
            unoptimized
          />
        </div>
        <p className="mt-2 font-semibold">Authorized Signatory</p>
      </div>
    </>
  );
}