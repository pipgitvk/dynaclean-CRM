import { ensureRegisteredSparesTable } from "@/lib/ensureRegisteredSparesTable";
import { sqlTrimUtf8EqColumns } from "@/lib/sqlUtf8Compare";

function intOrNull(v) {
  const n = parseInt(String(v || ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * @param {import("mysql2/promise").Pool | import("mysql2/promise").Connection} conn
 */
export async function insertRegisteredSpare(conn, {
  warrantyProductId,
  form,
  username,
  spareInstallationStatus,
  installationCompletedBy,
  installationCompletedDate,
}) {
  await ensureRegisteredSparesTable(conn);

  const f = form;
  const dispatchId = intOrNull(f.dispatch_id);
  const spareCode = String(f.model || "").trim() || null;
  const spareName = String(f.product_name || "").trim() || null;
  const orderId = String(f.order_id || "").trim() || null;

  if (spareCode) {
    const [productHit] = await conn.execute(
      `SELECT 1 FROM products_list pl
       WHERE ${sqlTrimUtf8EqColumns("pl.item_code", "?")}
       LIMIT 1`,
      [spareCode],
    );
    if (productHit.length > 0) {
      return;
    }
  }

  const rowValues = {
    warrantyProductId,
    dispatchId,
    orderId,
    quote_number: String(f.quote_number || "").trim() || null,
    spareCode,
    spareName,
    serial: String(f.serial_number || "").trim() || null,
    customer_name: String(f.customer_name || "").trim() || null,
    contact_person: String(f.contact_person || "").trim() || null,
    contact: String(f.contact || "").trim() || null,
    email: String(f.email || "").trim() || null,
    customer_address: String(f.customer_address || "").trim() || null,
    state: String(f.state || "").trim() || null,
    installed_by: String(f.installed_by || "").trim() || null,
    spareInstallationStatus,
    installationCompletedBy,
    installationCompletedDate,
    invoice_number: String(f.invoice_number || "").trim() || null,
    invoice_date: f.invoice_date || null,
    username,
  };

  const updateSql = `
    UPDATE registered_spares SET
      warranty_product_id = ?,
      dispatch_id = COALESCE(?, dispatch_id),
      order_id = COALESCE(?, order_id),
      quote_number = COALESCE(?, quote_number),
      spare_item_code = COALESCE(?, spare_item_code),
      spare_item_name = COALESCE(?, spare_item_name),
      serial_number = COALESCE(?, serial_number),
      product_name = COALESCE(?, product_name),
      model = COALESCE(?, model),
      customer_name = COALESCE(?, customer_name),
      contact_person = COALESCE(?, contact_person),
      contact = COALESCE(?, contact),
      email = COALESCE(?, email),
      customer_address = COALESCE(?, customer_address),
      state = COALESCE(?, state),
      installed_by = ?,
      spare_installation_status = ?,
      installation_completed_by = ?,
      installation_completed_date = ?,
      invoice_number = COALESCE(?, invoice_number),
      invoice_date = COALESCE(?, invoice_date),
      created_by = ?,
      updated_at = NOW()
    WHERE
  `;

  const updateValues = [
    rowValues.warrantyProductId,
    rowValues.dispatchId,
    rowValues.orderId,
    rowValues.quote_number,
    rowValues.spareCode,
    rowValues.spareName,
    rowValues.serial,
    rowValues.spareName,
    rowValues.spareCode,
    rowValues.customer_name,
    rowValues.contact_person,
    rowValues.contact,
    rowValues.email,
    rowValues.customer_address,
    rowValues.state,
    rowValues.installed_by,
    rowValues.spareInstallationStatus,
    rowValues.installationCompletedBy,
    rowValues.installationCompletedDate,
    rowValues.invoice_number,
    rowValues.invoice_date,
    rowValues.username,
  ];

  if (dispatchId) {
    const [u] = await conn.execute(`${updateSql} dispatch_id = ? LIMIT 1`, [
      ...updateValues,
      dispatchId,
    ]);
    if (u.affectedRows > 0) return;
  }

  if (orderId && spareCode) {
    const [u] = await conn.execute(
      `${updateSql}
        warranty_product_id IS NULL
        AND ${sqlTrimUtf8EqColumns("order_id", "?")}
        AND ${sqlTrimUtf8EqColumns("spare_item_code", "?")}
      LIMIT 1`,
      [...updateValues, orderId, spareCode],
    );
    if (u.affectedRows > 0) return;
  }

  const sql = `
    INSERT INTO registered_spares (
      warranty_product_id, dispatch_id, order_id, quote_number,
      spare_item_code, spare_item_name, serial_number,
      product_name, model, customer_name, contact_person, contact,
      email, customer_address, state,
      installed_by, spare_installation_status,
      installation_completed_by, installation_completed_date,
      invoice_number, invoice_date, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await conn.execute(sql, [
    rowValues.warrantyProductId,
    rowValues.dispatchId,
    rowValues.orderId,
    rowValues.quote_number,
    rowValues.spareCode,
    rowValues.spareName,
    rowValues.serial,
    rowValues.spareName,
    rowValues.spareCode,
    rowValues.customer_name,
    rowValues.contact_person,
    rowValues.contact,
    rowValues.email,
    rowValues.customer_address,
    rowValues.state,
    rowValues.installed_by,
    rowValues.spareInstallationStatus,
    rowValues.installationCompletedBy,
    rowValues.installationCompletedDate,
    rowValues.invoice_number,
    rowValues.invoice_date,
    rowValues.username,
  ]);
}