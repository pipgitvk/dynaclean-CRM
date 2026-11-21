/**
 * Load spare_installation_records + registered_spares for a service_id and
 * build warranty-style product + ServiceForm reportPrefill.
 */
export async function loadSpareInstallationReportPrefill(conn, serviceId) {
  const id = Number(serviceId);
  if (!Number.isFinite(id) || id <= 0) {
    return { product: null, reportPrefill: null, spareRecord: null };
  }

  const [rows] = await conn.execute(
    `SELECT sir.*,
        rs.product_name AS rs_product_name,
        rs.model AS rs_model,
        rs.customer_name AS rs_customer_name,
        rs.contact AS rs_contact,
        rs.email AS rs_email,
        rs.customer_address AS rs_customer_address,
        rs.contact_person AS rs_contact_person,
        rs.invoice_number AS rs_invoice_number,
        rs.invoice_date AS rs_invoice_date,
        rs.state AS rs_state
     FROM spare_installation_records sir
     LEFT JOIN registered_spares rs ON rs.id = sir.registered_spare_id
     WHERE sir.service_record_id = ?
     ORDER BY sir.id DESC
     LIMIT 1`,
    [id],
  );

  const sir = rows?.[0];
  if (!sir) {
    return { product: null, reportPrefill: null, spareRecord: null };
  }

  const spareName =
    String(sir.spare_item_name || sir.rs_product_name || "").trim() ||
    "Spare part";
  const spareCode = String(
    sir.spare_item_code || sir.rs_model || "",
  ).trim();
  const serial = String(sir.serial_number || "").trim();
  const customer = String(sir.customer_name || sir.rs_customer_name || "").trim();
  const sitePerson = String(sir.site_person || sir.rs_contact_person || "").trim();
  const siteContact = String(sir.site_contact || sir.rs_contact || "").trim();
  const siteEmail = String(sir.site_email || sir.rs_email || "").trim();
  const installAddress = String(sir.installation_address || "").trim();
  const homeAddress = String(sir.rs_customer_address || installAddress || "").trim();
  const assigned = String(sir.assigned_to || "").trim();
  const engineer =
    assigned && assigned.toUpperCase() !== "NOT ASSIGNED" ? assigned : "";

  const spareLabel = spareCode ? `${spareName} (${spareCode})` : spareName;

  const product = {
    product_name: spareName,
    model: spareCode || sir.rs_model || "",
    serial_number: serial,
    customer_name: customer,
    email: siteEmail,
    contact: siteContact,
    customer_address: homeAddress,
    installed_address: installAddress,
    site_person: sitePerson,
    contact_person: sitePerson,
    invoice_number: sir.rs_invoice_number || "",
    invoice_date: sir.rs_invoice_date || null,
    specification: "On-site spare installation",
  };

  const reportPrefill = {
    nature_of_complaint: `On-site spare installation — ${spareLabel}`,
    observation: "",
    action_taken: "",
    authorized_person_name: sitePerson,
    authorized_person_mobile: siteContact,
    customer_name: customer,
    customer_mobile: siteContact,
    completion_engineer_name: engineer,
    completion_customer_name: customer,
    completion_customer_mobile: siteContact,
    engineers_remark: engineer ? `Assigned engineer: ${engineer}` : "",
    spareParts: [{ replaced: spareLabel, tobereplaced: "" }],
  };

  return { product, reportPrefill, spareRecord: sir };
}