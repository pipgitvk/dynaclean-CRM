import { resolveStoredFileUrl } from "@/lib/resolveStoredFileUrl";

export function manualPaymentInvoiceHref(stored) {
  if (!stored) return "";
  const value = String(stored).trim();
  if (!value) return "";
  if (value.includes("res.cloudinary.com")) {
    return `/api/cloudinary-proxy?url=${encodeURIComponent(value)}`;
  }
  return resolveStoredFileUrl(value);
}
