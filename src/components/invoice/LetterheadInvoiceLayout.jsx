"use client";

import Image from "next/image";
import { resolveLogoSrc } from "@/lib/documentFromCompany";

/** Black-border tax invoice letterhead shell (matches print / DesignInvoice). */
export function InvoiceLetterheadShell({
  logoFile,
  logoSrc: logoSrcProp,
  children,
  footer,
  className = "",
}) {
  const logoSrc = logoSrcProp || resolveLogoSrc(logoFile);

  return (
    <div
      className={`border border-black bg-white box-border w-full ${className}`.trim()}
      style={{
        padding: "16px 24px 14px 4px",
        minHeight: 128,
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div className="flex flex-row items-start w-full gap-[120px]">
        <div className="shrink-0 w-[110px]" style={{ marginTop: 14 }}>
          {logoSrc ? (
            <Image
              key={logoSrc}
              src={logoSrc}
              alt="Company logo"
              width={110}
              height={72}
              className="h-auto w-[110px] object-contain block"
              unoptimized
            />
          ) : (
            <div
              className="w-[110px] min-h-12 border border-[#ddd] flex items-center justify-center text-[#c62828] font-bold text-[10px]"
            >
              DYNACLEAN
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex justify-start">
          <div className="inline-block text-center max-w-[520px] w-full text-[10px] leading-[1.45] text-black">
            {children}
          </div>
        </div>
      </div>
      {footer ? (
        <div className="mt-3 pt-3 border-t border-gray-200">{footer}</div>
      ) : null}
    </div>
  );
}

const inputBase =
  "w-full bg-transparent border-0 border-b border-dashed border-gray-300 focus:border-gray-500 focus:outline-none text-center text-black px-1 py-0.5";

export function InvoiceLetterheadInlineFields({ draft, onPatch, logoSlot }) {
  return (
    <InvoiceLetterheadShell
      logoFile={draft?.logo_file}
      key={draft?.logo_file || "letterhead-logo"}
      footer={logoSlot}
    >
      <input
        type="text"
        className={`${inputBase} font-bold text-[17px] leading-[1.3]`}
        style={{ marginBottom: 10 }}
        value={draft.from_company || ""}
        onChange={(e) => onPatch("from_company", e.target.value)}
        placeholder="DYNACLEAN INDUSTRIES PRIVATE LIMITED"
      />
      <textarea
        className={`${inputBase} min-h-[44px] resize-y mb-1`}
        value={draft.from_address || ""}
        onChange={(e) => onPatch("from_address", e.target.value)}
        placeholder="Address"
        rows={2}
      />
      <div className="mb-[3px]">
        <span>Ph: </span>
        <input
          type="text"
          className={`${inputBase} inline-block w-[calc(100%-2rem)] align-bottom`}
          value={draft.from_mobile || ""}
          onChange={(e) => onPatch("from_mobile", e.target.value)}
        />
      </div>
      <div className="mb-[3px]">
        <span>Email: </span>
        <input
          type="text"
          className={`${inputBase} inline-block w-[calc(100%-3.5rem)] align-bottom`}
          value={draft.from_email || ""}
          onChange={(e) => onPatch("from_email", e.target.value)}
        />
      </div>
      <div className="mb-[3px] text-center">
        <span>GST: </span>
        <input
          type="text"
          className={`${inputBase} inline-block w-[38%] max-w-[200px] align-bottom`}
          value={draft.from_gst || ""}
          onChange={(e) => onPatch("from_gst", e.target.value)}
        />
        <span>, State: </span>
        <input
          type="text"
          className={`${inputBase} inline-block w-[28%] max-w-[140px] align-bottom`}
          value={draft.from_state || ""}
          onChange={(e) => onPatch("from_state", e.target.value)}
        />
      </div>
      <div>
        <span>CIN: </span>
        <input
          type="text"
          className={`${inputBase} inline-block w-[calc(100%-2.5rem)] align-bottom`}
          value={draft.CIN_new || ""}
          onChange={(e) => onPatch("CIN_new", e.target.value)}
        />
      </div>
    </InvoiceLetterheadShell>
  );
}
