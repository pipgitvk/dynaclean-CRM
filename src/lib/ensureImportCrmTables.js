import { getDbConnection } from "@/lib/db";

const CREATE_SUPPLIERS = `
CREATE TABLE IF NOT EXISTS import_crm_suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(150) NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  alt_phone VARCHAR(50) NULL,
  country VARCHAR(100) NULL,
  state VARCHAR(100) NULL,
  city VARCHAR(100) NULL,
  address TEXT NULL,
  pincode VARCHAR(20) NULL,
  factory_name VARCHAR(255) NULL,
  supplier_type VARCHAR(100) NULL,
  main_products VARCHAR(255) NULL,
  pickup_address TEXT NULL,
  gst_no VARCHAR(50) NULL,
  pan_no VARCHAR(20) NULL,
  iec_no VARCHAR(50) NULL,
  tax_registration_no VARCHAR(100) NULL,
  registration_no VARCHAR(100) NULL,
  default_origin_country VARCHAR(100) NULL,
  default_origin_city VARCHAR(100) NULL,
  nearest_port VARCHAR(100) NULL,
  default_incoterm VARCHAR(20) NULL,
  cargo_ready_lead_time VARCHAR(50) NULL,
  bank_name VARCHAR(150) NULL,
  account_holder_name VARCHAR(150) NULL,
  account_number VARCHAR(100) NULL,
  swift_code VARCHAR(50) NULL,
  branch_name VARCHAR(100) NULL,
  available_documents TEXT NULL,
  remarks TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Active',
  quote_link_token VARCHAR(64) NULL,
  import_quote_submitted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_import_crm_suppliers_quote_token (quote_link_token),
  INDEX idx_import_crm_suppliers_name (supplier_name(64))
)`;

const CREATE_IMPORT_CRM_QUOTATIONS = `
CREATE TABLE IF NOT EXISTS import_crm_quotations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_id INT NOT NULL,
  shipment_id VARCHAR(255) NULL,
  agent_id VARCHAR(255) NULL,
  ocean_freight DECIMAL(16, 4) NULL,
  origin_cfs DECIMAL(16, 4) NULL,
  origin_customs DECIMAL(16, 4) NULL,
  origin_docs DECIMAL(16, 4) NULL,
  origin_vgm DECIMAL(16, 4) NULL,
  destination_cc_fee DECIMAL(16, 4) NULL,
  destination_thc DECIMAL(16, 4) NULL,
  destination_do_fee DECIMAL(16, 4) NULL,
  destination_deconsole_fee DECIMAL(16, 4) NULL,
  destination_gst DECIMAL(16, 4) NULL,
  clearance_agency DECIMAL(16, 4) NULL,
  clearance_loading DECIMAL(16, 4) NULL,
  clearance_edi DECIMAL(16, 4) NULL,
  clearance_exam DECIMAL(16, 4) NULL,
  clearance_cfs_actual DECIMAL(16, 4) NULL,
  clearance_transport_actual DECIMAL(16, 4) NULL,
  clearance_misc DECIMAL(16, 4) NULL,
  exchange_rate DECIMAL(18, 6) NULL,
  total_cost_inr DECIMAL(16, 2) NULL,
  remarks TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_import_crm_quotations_supplier (supplier_id),
  CONSTRAINT fk_import_crm_quotations_supplier
    FOREIGN KEY (supplier_id) REFERENCES import_crm_suppliers (id)
    ON DELETE CASCADE ON UPDATE CASCADE
)`;

const CREATE_PURCHASE_ORDERS = `
CREATE TABLE IF NOT EXISTS import_crm_purchase_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  po_number VARCHAR(128) NOT NULL,
  supplier_id INT NOT NULL,
  po_date DATE NOT NULL,
  currency VARCHAR(16) NOT NULL DEFAULT 'INR',
  total_value DECIMAL(14, 2) NOT NULL DEFAULT 0,
  remarks TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_import_crm_po_number (po_number),
  INDEX idx_import_crm_po_supplier (supplier_id),
  INDEX idx_import_crm_po_date (po_date),
  CONSTRAINT fk_import_crm_po_supplier
    FOREIGN KEY (supplier_id) REFERENCES import_crm_suppliers (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
)`;
  
const CREATE_IMPORT_CRM_SHIPMENTS = `
CREATE TABLE IF NOT EXISTS import_crm_shipments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ship_from VARCHAR(512) NOT NULL,
  ship_to VARCHAR(512) NOT NULL,
  cbm DECIMAL(14, 4) NOT NULL,
  shipment_term VARCHAR(16) NOT NULL,
  mode VARCHAR(16) NOT NULL,
  material_ready_date DATE NULL,
  agent_delivery_deadline DATE NULL,
  remarks TEXT NULL,
  created_by VARCHAR(128) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_import_crm_shipments_created (created_at)
)`;

const CREATE_IMPORT_CRM_SHIPMENT_LINK_QUOTES = `
CREATE TABLE IF NOT EXISTS import_crm_shipment_link_quotes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shipment_id INT NOT NULL,
  submitter_email VARCHAR(255) NOT NULL,
  public_link_token_at_submit VARCHAR(64) NOT NULL,
  agent_id VARCHAR(255) NULL,
  ocean_freight DECIMAL(16, 4) NULL,
  origin_cfs DECIMAL(16, 4) NULL,
  origin_customs DECIMAL(16, 4) NULL,
  origin_docs DECIMAL(16, 4) NULL,
  origin_vgm DECIMAL(16, 4) NULL,
  destination_cc_fee DECIMAL(16, 4) NULL,
  destination_thc DECIMAL(16, 4) NULL,
  destination_do_fee DECIMAL(16, 4) NULL,
  destination_deconsole_fee DECIMAL(16, 4) NULL,
  destination_gst DECIMAL(16, 4) NULL,
  clearance_agency DECIMAL(16, 4) NULL,
  clearance_loading DECIMAL(16, 4) NULL,
  clearance_edi DECIMAL(16, 4) NULL,
  clearance_exam DECIMAL(16, 4) NULL,
  clearance_cfs_actual DECIMAL(16, 4) NULL,
  clearance_transport_actual DECIMAL(16, 4) NULL,
  clearance_misc DECIMAL(16, 4) NULL,
  exchange_rate DECIMAL(18, 6) NULL,
  total_cost_inr DECIMAL(16, 2) NULL,
  remarks TEXT NULL,
  awarded_at TIMESTAMP NULL DEFAULT NULL,
  award_portal_token VARCHAR(64) NULL,
  award_form_submitted_at TIMESTAMP NULL DEFAULT NULL,
  af_pickup_person_details TEXT NULL,
  af_supplier_address TEXT NULL,
  af_cargo_ready_confirmation TEXT NULL,
  af_booking_details TEXT NULL,
  af_vessel_flight_details TEXT NULL,
  af_container_details TEXT NULL,
  af_bl_file VARCHAR(512) NULL,
  af_invoice_file VARCHAR(512) NULL,
  af_packing_list_file VARCHAR(512) NULL,
  af_other_documents_json TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_import_crm_slq_award_token (award_portal_token),
  UNIQUE KEY uq_import_crm_slq_ship_email_token (shipment_id, submitter_email, public_link_token_at_submit),
  CONSTRAINT fk_import_crm_shipment_link_quotes_shipment
    FOREIGN KEY (shipment_id) REFERENCES import_crm_shipments (id)
    ON DELETE CASCADE ON UPDATE CASCADE
)`;

const CREATE_IMPORT_CRM_AGENTS = `
CREATE TABLE IF NOT EXISTS import_crm_agents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agent_name VARCHAR(255) NOT NULL,
  country VARCHAR(128) NULL,
  contact_person VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(64) NULL,
  address TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_import_crm_agents_name (agent_name(64))
)`;

const CREATE_IMPORT_CRM_AGENT_QUOTATIONS = `
CREATE TABLE IF NOT EXISTS import_crm_agent_quotations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  crm_agent_id INT NOT NULL,
  shipment_id VARCHAR(255) NULL,
  agent_id VARCHAR(255) NULL,
  ocean_freight DECIMAL(16, 4) NULL,
  origin_cfs DECIMAL(16, 4) NULL,
  origin_customs DECIMAL(16, 4) NULL,
  origin_docs DECIMAL(16, 4) NULL,
  origin_vgm DECIMAL(16, 4) NULL,
  destination_cc_fee DECIMAL(16, 4) NULL,
  destination_thc DECIMAL(16, 4) NULL,
  destination_do_fee DECIMAL(16, 4) NULL,
  destination_deconsole_fee DECIMAL(16, 4) NULL,
  destination_gst DECIMAL(16, 4) NULL,
  clearance_agency DECIMAL(16, 4) NULL,
  clearance_loading DECIMAL(16, 4) NULL,
  clearance_edi DECIMAL(16, 4) NULL,
  clearance_exam DECIMAL(16, 4) NULL,
  clearance_cfs_actual DECIMAL(16, 4) NULL,
  clearance_transport_actual DECIMAL(16, 4) NULL,
  clearance_misc DECIMAL(16, 4) NULL,
  exchange_rate DECIMAL(18, 6) NULL,
  total_cost_inr DECIMAL(16, 2) NULL,
  remarks TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_import_crm_agent_quotations_agent (crm_agent_id),
  CONSTRAINT fk_import_crm_agent_quotations_agent
    FOREIGN KEY (crm_agent_id) REFERENCES import_crm_agents (id)
    ON DELETE CASCADE ON UPDATE CASCADE
)`;

export async function ensureImportCrmTables() {
  const conn = await getDbConnection();
  await conn.execute(CREATE_SUPPLIERS);
  try {
    await conn.execute(
      `ALTER TABLE import_crm_suppliers ADD COLUMN quote_link_token VARCHAR(64) NULL`,
    );
  } catch (e) {
    if (e?.errno !== 1060) throw e;
  }
  try {
    await conn.execute(
      `ALTER TABLE import_crm_suppliers ADD UNIQUE KEY uq_import_crm_suppliers_quote_token (quote_link_token)`,
    );
  } catch (e) {
    if (e?.errno !== 1061) throw e;
  }
  try {
    await conn.execute(
      `ALTER TABLE import_crm_suppliers ADD COLUMN import_quote_submitted_at TIMESTAMP NULL`,
    );
  } catch (e) {
    if (e?.errno !== 1060) throw e;
  }
  const supplierExtraCols = [
    "ADD COLUMN alt_phone VARCHAR(50) NULL",
    "ADD COLUMN state VARCHAR(100) NULL",
    "ADD COLUMN city VARCHAR(100) NULL",
    "ADD COLUMN pincode VARCHAR(20) NULL",
    "ADD COLUMN factory_name VARCHAR(255) NULL",
    "ADD COLUMN supplier_type VARCHAR(100) NULL",
    "ADD COLUMN main_products VARCHAR(255) NULL",
    "ADD COLUMN pickup_address TEXT NULL",
    "ADD COLUMN gst_no VARCHAR(50) NULL",
    "ADD COLUMN pan_no VARCHAR(20) NULL",
    "ADD COLUMN iec_no VARCHAR(50) NULL",
    "ADD COLUMN tax_registration_no VARCHAR(100) NULL",
    "ADD COLUMN registration_no VARCHAR(100) NULL",
    "ADD COLUMN default_origin_country VARCHAR(100) NULL",
    "ADD COLUMN default_origin_city VARCHAR(100) NULL",
    "ADD COLUMN nearest_port VARCHAR(100) NULL",
    "ADD COLUMN default_incoterm VARCHAR(20) NULL",
    "ADD COLUMN cargo_ready_lead_time VARCHAR(50) NULL",
    "ADD COLUMN bank_name VARCHAR(150) NULL",
    "ADD COLUMN account_holder_name VARCHAR(150) NULL",
    "ADD COLUMN account_number VARCHAR(100) NULL",
    "ADD COLUMN swift_code VARCHAR(50) NULL",
    "ADD COLUMN branch_name VARCHAR(100) NULL",
    "ADD COLUMN available_documents TEXT NULL",
    "ADD COLUMN remarks TEXT NULL",
    "ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'Active'",
  ];
  for (const frag of supplierExtraCols) {
    try {
      await conn.execute(`ALTER TABLE import_crm_suppliers ${frag}`);
    } catch (e) {
      if (e?.errno !== 1060) throw e;
    }
  }
  try {
    await conn.execute(
      `UPDATE import_crm_suppliers SET status = 'Active' WHERE status IS NULL OR TRIM(status) = ''`,
    );
  } catch {
    /* ignore */
  }
  await conn.execute(CREATE_IMPORT_CRM_QUOTATIONS);
  await conn.execute(CREATE_PURCHASE_ORDERS);
  await conn.execute(CREATE_IMPORT_CRM_SHIPMENTS);
  try {
    await conn.execute(
      `ALTER TABLE import_crm_shipments ADD COLUMN public_link_token VARCHAR(64) NULL`,
    );
  } catch (e) {
    if (e?.errno !== 1060) throw e;
  }
  try {
    await conn.execute(
      `ALTER TABLE import_crm_shipments ADD UNIQUE KEY uq_import_crm_shipments_public_token (public_link_token)`,
    );
  } catch (e) {
    if (e?.errno !== 1061) throw e;
  }
  try {
    await conn.execute(
      `UPDATE import_crm_shipments
       SET public_link_token = LOWER(REPLACE(UUID(), '-', ''))
       WHERE public_link_token IS NULL OR TRIM(public_link_token) = ''`,
    );
  } catch {
    /* ignore */
  }

  await conn.execute(CREATE_IMPORT_CRM_SHIPMENT_LINK_QUOTES);
  try {
    await conn.execute(
      `ALTER TABLE import_crm_shipment_link_quotes ADD COLUMN submitter_email VARCHAR(255) NULL`,
    );
  } catch (e) {
    if (e?.errno !== 1060) throw e;
  }
  try {
    await conn.execute(
      `UPDATE import_crm_shipment_link_quotes
       SET submitter_email = CONCAT('legacy-', id, '@shipment-quote.local')
       WHERE submitter_email IS NULL OR TRIM(submitter_email) = ''`,
    );
  } catch {
    /* ignore */
  }
  try {
    await conn.execute(
      `ALTER TABLE import_crm_shipment_link_quotes MODIFY COLUMN submitter_email VARCHAR(255) NOT NULL`,
    );
  } catch {
    /* ignore if column missing or already NOT NULL */
  }
  try {
    await conn.execute(
      `ALTER TABLE import_crm_shipment_link_quotes DROP INDEX uq_import_crm_shipment_link_quote_shipment`,
    );
  } catch {
    /* index missing on fresh installs with new CREATE */
  }
  try {
    await conn.execute(
      `ALTER TABLE import_crm_shipment_link_quotes ADD COLUMN public_link_token_at_submit VARCHAR(64) NULL`,
    );
  } catch (e) {
    if (e?.errno !== 1060) throw e;
  }
  try {
    await conn.execute(
      `UPDATE import_crm_shipment_link_quotes q
       INNER JOIN import_crm_shipments s ON s.id = q.shipment_id
       SET q.public_link_token_at_submit = s.public_link_token
       WHERE (q.public_link_token_at_submit IS NULL OR TRIM(q.public_link_token_at_submit) = '')
         AND s.public_link_token IS NOT NULL
         AND TRIM(s.public_link_token) != ''`,
    );
  } catch {
    /* ignore */
  }
  try {
    await conn.execute(
      `UPDATE import_crm_shipment_link_quotes
       SET public_link_token_at_submit = 'legacy-unknown'
       WHERE public_link_token_at_submit IS NULL OR TRIM(public_link_token_at_submit) = ''`,
    );
  } catch {
    /* ignore */
  }
  try {
    await conn.execute(
      `ALTER TABLE import_crm_shipment_link_quotes MODIFY COLUMN public_link_token_at_submit VARCHAR(64) NOT NULL`,
    );
  } catch {
    /* ignore */
  }
  try {
    await conn.execute(
      `ALTER TABLE import_crm_shipment_link_quotes DROP INDEX uq_import_crm_shipment_link_quote_ship_email`,
    );
  } catch {
    /* missing after new CREATE or already migrated */
  }
  try {
    await conn.execute(
      `ALTER TABLE import_crm_shipment_link_quotes ADD UNIQUE KEY uq_import_crm_slq_ship_email_token (shipment_id, submitter_email, public_link_token_at_submit)`,
    );
  } catch (e) {
    if (e?.errno !== 1061 && e?.errno !== 1826) throw e;
  }
  try {
    await conn.execute(
      `ALTER TABLE import_crm_shipment_link_quotes ADD COLUMN awarded_at TIMESTAMP NULL DEFAULT NULL`,
    );
  } catch (e) {
    if (e?.errno !== 1060) throw e;
  }
  const awardPortalCols = [
    "ADD COLUMN award_portal_token VARCHAR(64) NULL",
    "ADD COLUMN award_form_submitted_at TIMESTAMP NULL DEFAULT NULL",
    "ADD COLUMN af_pickup_person_details TEXT NULL",
    "ADD COLUMN af_supplier_address TEXT NULL",
    "ADD COLUMN af_cargo_ready_confirmation TEXT NULL",
    "ADD COLUMN af_booking_details TEXT NULL",
    "ADD COLUMN af_vessel_flight_details TEXT NULL",
    "ADD COLUMN af_container_details TEXT NULL",
    "ADD COLUMN af_bl_file VARCHAR(512) NULL",
    "ADD COLUMN af_invoice_file VARCHAR(512) NULL",
    "ADD COLUMN af_packing_list_file VARCHAR(512) NULL",
    "ADD COLUMN af_other_documents_json TEXT NULL",
    "ADD COLUMN af_approved_at TIMESTAMP NULL DEFAULT NULL",
    "ADD COLUMN af_approved_by VARCHAR(128) NULL",
    "ADD COLUMN af_reassign_fields_json TEXT NULL",
  ];
  for (const frag of awardPortalCols) {
    try {
      await conn.execute(
        `ALTER TABLE import_crm_shipment_link_quotes ${frag}`,
      );
    } catch (e) {
      if (e?.errno !== 1060) throw e;
    }
  }
  try {
    await conn.execute(
      `ALTER TABLE import_crm_shipment_link_quotes ADD UNIQUE KEY uq_import_crm_slq_award_token (award_portal_token)`,
    );
  } catch (e) {
    if (e?.errno !== 1061 && e?.errno !== 1826) throw e;
  }

  await conn.execute(CREATE_IMPORT_CRM_AGENTS);
  try {
    await conn.execute(
      `ALTER TABLE import_crm_agents ADD COLUMN quote_link_token VARCHAR(64) NULL`,
    );
  } catch (e) {
    if (e?.errno !== 1060) throw e;
  }
  try {
    await conn.execute(
      `ALTER TABLE import_crm_agents ADD UNIQUE KEY uq_import_crm_agents_quote_token (quote_link_token)`,
    );
  } catch (e) {
    if (e?.errno !== 1061) throw e;
  }
  try {
    await conn.execute(
      `ALTER TABLE import_crm_agents ADD COLUMN agent_quote_submitted_at TIMESTAMP NULL`,
    );
  } catch (e) {
    if (e?.errno !== 1060) throw e;
  }
  const agentExtraCols = [
    "ADD COLUMN company_name VARCHAR(255) NULL",
    "ADD COLUMN state VARCHAR(128) NULL",
    "ADD COLUMN city VARCHAR(128) NULL",
    "ADD COLUMN service_type VARCHAR(128) NULL",
    "ADD COLUMN mode_supported VARCHAR(255) NULL",
    "ADD COLUMN shipment_type_supported VARCHAR(255) NULL",
    "ADD COLUMN origin_coverage TEXT NULL",
    "ADD COLUMN destination_coverage TEXT NULL",
    "ADD COLUMN gst_no VARCHAR(64) NULL",
    "ADD COLUMN pan_no VARCHAR(32) NULL",
    "ADD COLUMN status VARCHAR(32) NULL",
    "ADD COLUMN remarks TEXT NULL",
  ];
  for (const frag of agentExtraCols) {
    try {
      await conn.execute(`ALTER TABLE import_crm_agents ${frag}`);
    } catch (e) {
      if (e?.errno !== 1060) throw e;
    }
  }
  try {
    await conn.execute(
      `UPDATE import_crm_agents
       SET company_name = agent_name
       WHERE company_name IS NULL OR TRIM(company_name) = ''`,
    );
  } catch {
    /* ignore */
  }
  try {
    await conn.execute(
      `ALTER TABLE import_crm_shipments ADD COLUMN crm_agent_id INT NULL`,
    );
  } catch (e) {
    if (e?.errno !== 1060) throw e;
  }
  try {
    await conn.execute(
      `UPDATE import_crm_shipments s
       LEFT JOIN import_crm_agents a ON a.id = s.crm_agent_id
       SET s.crm_agent_id = NULL
       WHERE s.crm_agent_id IS NOT NULL AND a.id IS NULL`,
    );
  } catch {
    /* ignore if column missing in edge cases */
  }
  try {
    await conn.execute(
      `ALTER TABLE import_crm_shipments
       ADD CONSTRAINT fk_import_crm_shipments_crm_agent
       FOREIGN KEY (crm_agent_id) REFERENCES import_crm_agents (id)
       ON DELETE SET NULL ON UPDATE CASCADE`,
    );
  } catch (e) {
    const msg = String(e?.sqlMessage ?? e?.message ?? "");
    const ignorable =
      e?.errno === 1826 ||
      e?.errno === 1215 ||
      e?.errno === 1061 ||
      e?.errno === 1005 ||
      e?.code === "ER_CANT_CREATE_TABLE" ||
      e?.code === "ER_DUP_KEYNAME" ||
      msg.includes("errno: 121") ||
      msg.includes("Duplicate key") ||
      msg.includes("already exists");
    if (!ignorable) throw e;
  }
  try {
    await conn.execute(
      `ALTER TABLE import_crm_shipments ADD COLUMN shipment_crm_agent_ids_json TEXT NULL`,
    );
  } catch (e) {
    if (e?.errno !== 1060) throw e;
  }
  try {
    await conn.execute(
      `UPDATE import_crm_shipments
       SET shipment_crm_agent_ids_json = CONCAT('[', crm_agent_id, ']')
       WHERE crm_agent_id IS NOT NULL
         AND (shipment_crm_agent_ids_json IS NULL OR TRIM(shipment_crm_agent_ids_json) = '' OR shipment_crm_agent_ids_json = '[]')`,
    );
  } catch {
    /* ignore */
  }
  try {
    await conn.execute(
      `ALTER TABLE import_crm_shipments ADD COLUMN supplier_id INT NULL`,
    );
  } catch (e) {
    if (e?.errno !== 1060) throw e;
  }
  try {
    await conn.execute(
      `UPDATE import_crm_shipments s
       LEFT JOIN import_crm_suppliers sup ON sup.id = s.supplier_id
       SET s.supplier_id = NULL
       WHERE s.supplier_id IS NOT NULL AND sup.id IS NULL`,
    );
  } catch {
    /* ignore */
  }
  try {
    await conn.execute(
      `ALTER TABLE import_crm_shipments
       ADD CONSTRAINT fk_import_crm_shipments_supplier
       FOREIGN KEY (supplier_id) REFERENCES import_crm_suppliers (id)
       ON DELETE SET NULL ON UPDATE CASCADE`,
    );
  } catch (e) {
    const msg = String(e?.sqlMessage ?? e?.message ?? "");
    const ignorable =
      e?.errno === 1826 ||
      e?.errno === 1215 ||
      e?.errno === 1061 ||
      e?.errno === 1005 ||
      e?.code === "ER_CANT_CREATE_TABLE" ||
      e?.code === "ER_DUP_KEYNAME" ||
      msg.includes("errno: 121") ||
      msg.includes("Duplicate key") ||
      msg.includes("already exists");
    if (!ignorable) throw e;
  }
  try {
    await conn.execute(
      `ALTER TABLE import_crm_shipments ADD COLUMN shipment_supplier_ids_json TEXT NULL`,
    );
  } catch (e) {
    if (e?.errno !== 1060) throw e;
  }
  try {
    await conn.execute(
      `UPDATE import_crm_shipments
       SET shipment_supplier_ids_json = CONCAT('[', supplier_id, ']')
       WHERE supplier_id IS NOT NULL
         AND (shipment_supplier_ids_json IS NULL OR TRIM(shipment_supplier_ids_json) = '' OR shipment_supplier_ids_json = '[]')`,
    );
  } catch {
    /* ignore */
  }
  await conn.execute(CREATE_IMPORT_CRM_AGENT_QUOTATIONS);

  // Shipment-level status: PENDING → AWARDED → EXECUTION_APPROVED → APPROVED_FOR_MOVEMENT
  try {
    await conn.execute(
      `ALTER TABLE import_crm_shipments ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'PENDING'`,
    );
  } catch (e) {
    if (e?.errno !== 1060) throw e;
  }
  // Backfill existing rows that were created before the status column was added
  try {
    await conn.execute(
      `UPDATE import_crm_shipments s
       INNER JOIN import_crm_shipment_link_quotes q ON q.shipment_id = s.id
       SET s.status = 'APPROVED_FOR_MOVEMENT'
       WHERE s.status = 'PENDING' AND q.af_approved_at IS NOT NULL`,
    );
  } catch { /* ignore */ }
  try {
    await conn.execute(
      `UPDATE import_crm_shipments s
       INNER JOIN import_crm_shipment_link_quotes q ON q.shipment_id = s.id
       SET s.status = 'EXECUTION_APPROVED'
       WHERE s.status = 'PENDING' AND q.award_form_submitted_at IS NOT NULL AND q.af_approved_at IS NULL`,
    );
  } catch { /* ignore */ }
  try {
    await conn.execute(
      `UPDATE import_crm_shipments s
       INNER JOIN import_crm_shipment_link_quotes q ON q.shipment_id = s.id
       SET s.status = 'AWARDED'
       WHERE s.status = 'PENDING' AND q.awarded_at IS NOT NULL AND q.award_form_submitted_at IS NULL`,
    );
  } catch { /* ignore */ }

  // Do NOT backfill import_quote_submitted_at from import_crm_quotations here.
  // That ran on every request and undid "regenerate link" (NULL after new token).
  // One-time legacy fix if needed:
  // UPDATE import_crm_suppliers s INNER JOIN (SELECT supplier_id, MIN(created_at) AS first_at FROM import_crm_quotations GROUP BY supplier_id) q ON q.supplier_id = s.id SET s.import_quote_submitted_at = q.first_at WHERE s.import_quote_submitted_at IS NULL;
}
