"use client";

import Image from "next/image";
import {
  mergeDocumentFromCompany,
  resolveLogoSrc,
  toInvoiceLetterheadShape,
} from "@/lib/documentFromCompany";
import { InvoiceLetterheadShell } from "@/components/invoice/LetterheadInvoiceLayout";

/**
 * Quotation: grey box, red title.
 * Invoice: black border, print layout (see LetterheadInvoiceLayout).
 */
export default function LetterheadDocumentBlock({
  values,
  className = "",
  variant = "quotation",
}) {
  const h = toInvoiceLetterheadShape(mergeDocumentFromCompany(values));
  const logoSrc = resolveLogoSrc(h.logoFile);

  if (variant === "invoice") {
    return (
      <InvoiceLetterheadShell logoSrc={logoSrc} className={className}>
        <div
          className="font-bold text-[17px] leading-[1.3] text-black"
          style={{ marginBottom: 10 }}
        >
          {h.name}
        </div>
        {h.addressLine2 && h.addressLine2 !== h.addressLine1 ? (
          <>
            <div className="mb-[3px]">{h.addressLine1}</div>
            <div className="mb-1">{h.addressLine2}</div>
          </>
        ) : (
          <div className="mb-1 whitespace-pre-wrap">{h.address}</div>
        )}
        <div className="mb-[3px]">Ph: {h.phone}</div>
        <div className="mb-[3px]">Email: {h.email}</div>
        <div className="mb-[3px]">
          GST: {h.gstin}, State: {h.state}
        </div>
        <div>CIN: {h.cin}</div>
      </InvoiceLetterheadShell>
    );
  }

  return (
    <div
      className={`flex flex-col sm:flex-row items-start sm:items-center border rounded bg-gray-50 p-4 gap-4 w-full ${className}`.trim()}
    >
      <Image
        src={logoSrc}
        alt="Dynaclean Logo"
        width={120}
        height={80}
        className="object-contain shrink-0"
        unoptimized
      />
      <div className="flex-1 text-sm text-gray-700 min-w-0">
        <h2 className="text-xl font-bold text-red-600 mb-1">{h.name}</h2>
        <p className="leading-relaxed">
          {h.addressLine2 && h.addressLine2 !== h.addressLine1 ? (
            <>
              <span className="block">{h.addressLine1}</span>
              <span className="block">{h.addressLine2}</span>
            </>
          ) : (
            <span className="block whitespace-pre-wrap">{h.address}</span>
          )}
          <span className="block mt-1">
            <strong>Phone:</strong> {h.phone}
          </span>
          <span className="block">
            <strong>Email:</strong> {h.email}
          </span>
          <span className="block mt-1">
            <strong>GSTIN:</strong> {h.gstin} | <strong>State:</strong>{" "}
            {h.state}
          </span>
          <span className="block">
            <strong>CIN:</strong> {h.cin}
          </span>
        </p>
      </div>
    </div>
  );
}
