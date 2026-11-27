/** Bank + signatory when GST breakdown is shown (checkbox off). */
export const QUOTATION_BANK_FOOTER_WITH_GST = {
  accountHolder: "DYNACLEAN INDUSTRIES PRIVATE LIMITED",
  bankName: "ICICI Bank",
  accountNo: "343405500379",
  ifsc: "ICIC0003434",
};

export const QUOTATION_SIGNATORY_FOR_WITH_GST =
  "For DYNACLEAN INDUSTRIES PRIVATE LIMITED";

/** Bank + signatory when hide-GST checkbox is on. */
export const QUOTATION_BANK_FOOTER_HIDE_GST = {
  accountHolder: "DYNACLEAN INDUSTRIES",
  bankName: "ICICI BANK LTD.",
  accountNo: "343405500436",
  ifsc: "ICIC0003434",
};

export const QUOTATION_SIGNATORY_FOR_HIDE_GST = "For DYNACLEAN INDUSTRIES";

export function quotationBankFooter(hideGstBreakdown = false) {
  return hideGstBreakdown
    ? QUOTATION_BANK_FOOTER_HIDE_GST
    : QUOTATION_BANK_FOOTER_WITH_GST;
}

export function quotationSignatoryFor(hideGstBreakdown = false) {
  return hideGstBreakdown
    ? QUOTATION_SIGNATORY_FOR_HIDE_GST
    : QUOTATION_SIGNATORY_FOR_WITH_GST;
}