import { getDbConnection } from "@/lib/db";

const CREATE_SUPPLIERS = `
CREATE TABLE IF NOT EXISTS import_crm_suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_name VARCHAR(255) NOT NULL,
  country VARCHAR(128) NULL,
  contact_person VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(64) NULL,
  address TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_import_crm_suppliers_name (supplier_name(64))
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

export async function ensureImportCrmTables() {
  const conn = await getDbConnection();
  await conn.execute(CREATE_SUPPLIERS);
  await conn.execute(CREATE_PURCHASE_ORDERS);
}
