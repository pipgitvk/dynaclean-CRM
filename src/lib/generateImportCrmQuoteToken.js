import { randomBytes } from "crypto";

/** URL-safe token for public import-CRM quote links (hex). */
export function generateImportCrmQuoteToken() {
  return randomBytes(24).toString("hex");
}
