/** Seller letterhead fields stored on quotations_records and invoices. */

import { isJwtAccountingRole } from "@/lib/roleKeyUtils";

export const DOCUMENT_FROM_COMPANY_FIELD_KEYS = [
  "from_company",
  "from_gst",
  "from_address",
  "from_mobile",
  "from_email",
  "from_state",
  "logo_file",
  "CIN_new",
];

export const DEFAULT_DOCUMENT_FROM_COMPANY = {
  from_company: "DYNACLEAN INDUSTRIES PRIVATE LIMITED",
  from_address:
    "3rd Floor, Plot No. 9, Pocket 3, Block B, Sector 17 Dwarka, New Delhi, South West Delhi, Delhi - 110078.",
  from_mobile: "011-45143666, +91-7982456944",
  from_email: "sales@dynacleanindustries.com",
  from_gst: "07AAKCD6495M1ZV",
  from_state: "Delhi (07)",
  CIN_new: "U32909TZ2024PTC030660",
  logo_file: "/images/logo.png",
};

export function getDefaultDocumentFromCompany() {
  return { ...DEFAULT_DOCUMENT_FROM_COMPANY };
}

/** Merge DB/API row or form state with defaults (non-empty wins). */
export function mergeDocumentFromCompany(source) {
  const out = { ...DEFAULT_DOCUMENT_FROM_COMPANY };
  if (!source || typeof source !== "object") return out;
  for (const key of DOCUMENT_FROM_COMPANY_FIELD_KEYS) {
    const v = source[key];
    if (v != null && String(v).trim() !== "") {
      out[key] = String(v).trim();
    }
  }
  return out;
}

/** Payload for JSON APIs (create/update quotation, invoice, order). */
export function documentFromCompanyApiPayload(fields) {
  return mergeDocumentFromCompany(fields);
}

/** Use on form submit so open letterhead draft is included. */
export function documentFromCompanyForSubmit(state, headerRef) {
  const merged =
    headerRef?.current?.getMergedForSave?.() ??
    mergeDocumentFromCompany(state);
  const out = {};
  for (const key of DOCUMENT_FROM_COMPANY_FIELD_KEYS) {
    out[key] = merged[key] ?? null;
  }
  return out;
}

/** Normalize role from JWT payload, /api/me user object, or plain string. */
export function resolveSessionRole(source) {
  if (source == null) return "";
  if (typeof source === "string") return source;
  return source.role ?? source.userRole ?? "";
}

/** Letterhead edit/upload — SUPERADMIN and ACCOUNTANT roles only. */
export function canEditDocumentLetterhead(roleOrUser) {
  return isJwtAccountingRole(resolveSessionRole(roleOrUser));
}

/**
 * Resolve letterhead for save: privileged roles may send new fields from body;
 * others keep existing row or company defaults.
 */
export function pickDocumentFromCompanyFields(obj) {
  if (!obj || typeof obj !== "object") return {};
  const out = {};
  for (const key of DOCUMENT_FROM_COMPANY_FIELD_KEYS) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      out[key] = obj[key];
    }
  }
  return out;
}

export function letterheadPayloadForRole(body, roleOrUser, existingSource = null) {
  const picked = pickDocumentFromCompanyFields(body);
  const base = existingSource
    ? mergeDocumentFromCompany(existingSource)
    : mergeDocumentFromCompany({});

  if (canEditDocumentLetterhead(roleOrUser)) {
    return mergeDocumentFromCompany({ ...base, ...picked });
  }
  if (existingSource) {
    return mergeDocumentFromCompany(existingSource);
  }
  return mergeDocumentFromCompany({});
}

/** Shape used by PDF / legacy INVOICE_LETTERHEAD consumers. */
export function toInvoiceLetterheadShape(source) {
  const m = mergeDocumentFromCompany(source);
  const addr = m.from_address || "";
  const splitAt = addr.indexOf(", New Delhi");
  let addressLine1 = addr;
  let addressLine2 = "";
  if (splitAt > 0) {
    addressLine1 = addr.slice(0, splitAt + 1).trim();
    addressLine2 = addr.slice(splitAt + 2).trim();
  } else if (addr.includes(",")) {
    const idx = addr.indexOf(",");
    addressLine1 = addr.slice(0, idx + 1).trim();
    addressLine2 = addr.slice(idx + 1).trim();
  }
  return {
    name: m.from_company,
    addressLine1,
    addressLine2: addressLine2 || addressLine1,
    address: addr,
    phone: m.from_mobile,
    email: m.from_email,
    gstin: m.from_gst,
    state: m.from_state,
    cin: m.CIN_new,
    logoFile: m.logo_file,
  };
}

export function resolveLogoSrc(logoFile) {
  const raw = String(logoFile || DEFAULT_DOCUMENT_FROM_COMPANY.logo_file).trim();
  if (!raw) return "/images/logo.png";
  if (/^https?:\/\//i.test(raw)) return raw;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

export function documentFromCompanyInsertColumnSql() {
  return DOCUMENT_FROM_COMPANY_FIELD_KEYS.map((k) =>
    k === "CIN_new" ? "`CIN_new`" : k,
  ).join(", ");
}

export function documentFromCompanyInsertPlaceholders() {
  return DOCUMENT_FROM_COMPANY_FIELD_KEYS.map(() => "?").join(", ");
}

export function documentFromCompanyInsertValues(merged) {
  if (!merged || typeof merged !== "object") {
    return DOCUMENT_FROM_COMPANY_FIELD_KEYS.map(() => null);
  }
  return DOCUMENT_FROM_COMPANY_FIELD_KEYS.map((k) => {
    const v = merged[k];
    if (v == null || String(v).trim() === "") return null;
    return String(v).trim();
  });
}

export function documentFromCompanyUpdateSetSql() {
  return DOCUMENT_FROM_COMPANY_FIELD_KEYS.map((k) =>
    k === "CIN_new" ? "`CIN_new` = ?" : `${k} = ?`,
  ).join(", ");
}
