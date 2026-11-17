/** Shared phone-last-10 matching: meta_leads ↔ customers (duplicate re-enquiries). */

export function metaLeadPhoneExpr(alias = "ml") {
  return `COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(${alias}.lead_data, '$.phone')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(${alias}.lead_data, '$.phone_number')), '')
  )`;
}

export function metaLeadPhoneLast10Sql(alias = "ml") {
  const expr = metaLeadPhoneExpr(alias);
  return `RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${expr}, ' ', ''), '-', ''), '+', ''), '(', ''), ')', ''), '.', ''), ',', ''), 10)`;
}

export function customerPhoneLast10Sql(alias = "c") {
  return `RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${alias}.phone, ' ', ''), '-', ''), '+', ''), '(', ''), ')', ''), '.', ''), ',', ''), 10)`;
}

export const META_LEAD_PHONE_EXPR = metaLeadPhoneExpr("ml");

export const META_LEAD_PHONE_LAST10 = metaLeadPhoneLast10Sql("ml");

export const CUSTOMER_PHONE_LAST10 = customerPhoneLast10Sql("c");

/** Match imported customer id or same-phone CRM row (duplicate Meta re-enquiry). */
export const META_LEAD_PHONE_DIGITS_EXPR = `
  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${metaLeadPhoneExpr("ml")}, ' ', ''), '-', ''), '+', ''), '(', ''), ')', ''), '.', ''), ',', '')
`;

export const META_LEAD_CUSTOMER_JOIN = `
  LEFT JOIN customers c ON (
    c.customer_id = ml.crm_customer_id
    OR (
      (ml.crm_customer_id IS NULL OR ml.crm_customer_id = 0)
      AND CHAR_LENGTH(${META_LEAD_PHONE_LAST10}) = 10
      AND ${META_LEAD_PHONE_LAST10} = ${CUSTOMER_PHONE_LAST10}
    )
  )
`;