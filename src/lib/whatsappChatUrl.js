/** Digits-only phone → https://wa.me/… (India: 10-digit → 91 prefix). */
export function buildWhatsAppChatUrl(phone) {
  if (phone == null || phone === "") return null;
  let digits = String(phone).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) digits = `91${digits}`;
  else if (digits.length === 11 && digits.startsWith("0")) {
    digits = `91${digits.slice(1)}`;
  }
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}`;
}
