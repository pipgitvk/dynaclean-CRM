import { ensureRegisteredSparesTable } from "@/lib/ensureRegisteredSparesTable";
import { sqlTrimUtf8EqColumns } from "@/lib/sqlUtf8Compare";
import { pendingNeworderPredicates } from "@/lib/upcomingInstallationOrderEligibility";
import {
  SPARE_PIPELINE_BASE_FROM,
  SPARE_BOARD_PIPELINE_WHERE,
} from "@/lib/registeredSparesBoardQuery";

/**
 * Insert open spare dispatch lines into registered_spares (warranty_product_id NULL = not registered yet).
 * @param {import("mysql2/promise").Pool | import("mysql2/promise").Connection} conn
 */
export async function syncPendingSparesToRegisteredSpares(conn) {
  await ensureRegisteredSparesTable(conn);

  const pendingInsert = `
    INSERT INTO registered_spares (
      dispatch_id, order_id, quote_number,
      spare_item_code, spare_item_name, serial_number,
      product_name, model,
      customer_name, contact_person, contact,
      invoice_number, spare_installation_status, created_by
    )
    SELECT
      d.id,
      no.order_id,
      no.quote_number,
      d.item_code,
      d.item_name,
      NULLIF(TRIM(d.serial_no), ''),
      d.item_name,
      d.item_code,
      no.company_name,
      NULLIF(TRIM(no.client_name), ''),
      no.contact,
      no.invoice_number,
      'pending',
      'pending-pipeline'
    ${SPARE_PIPELINE_BASE_FROM}
    LEFT JOIN registered_spares rs_existing ON rs_existing.dispatch_id = d.id
    ${SPARE_BOARD_PIPELINE_WHERE}
      AND rs_existing.id IS NULL
      AND wp.id IS NULL
  `;

  const [ins] = await conn.execute(pendingInsert);

  const refreshPending = `
    UPDATE registered_spares rs
    INNER JOIN dispatch d ON d.id = rs.dispatch_id
    INNER JOIN neworder no
      ON ${sqlTrimUtf8EqColumns("d.quote_number", "no.quote_number")}
    SET
      rs.order_id = no.order_id,
      rs.quote_number = no.quote_number,
      rs.spare_item_code = d.item_code,
      rs.spare_item_name = d.item_name,
      rs.product_name = d.item_name,
      rs.model = d.item_code,
      rs.serial_number = NULLIF(TRIM(d.serial_no), ''),
      rs.customer_name = no.company_name,
      rs.contact_person = NULLIF(TRIM(no.client_name), ''),
      rs.contact = no.contact,
      rs.invoice_number = no.invoice_number,
      rs.updated_at = NOW()
    WHERE rs.warranty_product_id IS NULL
      AND (rs.created_by = 'pending-pipeline' OR rs.spare_installation_status = 'pending')
  `;

  const [upd] = await conn.execute(refreshPending);

  return {
    inserted: ins?.affectedRows ?? 0,
    updated: upd?.affectedRows ?? 0,
  };
}