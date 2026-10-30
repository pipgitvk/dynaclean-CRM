let trackingDataTableReady = false;

const ORDER_ID_SQL =
  "VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL";

export async function ensureTrackingDataTable(conn) {
  if (trackingDataTableReady) return;
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS tracking_data (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tracking_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'Delhivery LR / waybill (from tracking_id.lr_number)',
      order_id ${ORDER_ID_SQL},
      shipment_type VARCHAR(16) NULL COMMENT 'delivery | return',
      status VARCHAR(128) NULL,
      mwbn VARCHAR(64) NULL,
      scan_remark VARCHAR(512) NULL,
      location VARCHAR(255) NULL,
      payload LONGTEXT NOT NULL COMMENT 'Delhivery API JSON response',
      fetch_error TEXT NULL,
      fetched_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_tracking_data_tracking_id (tracking_id),
      KEY idx_tracking_data_order (order_id),
      KEY idx_tracking_data_status (status),
      KEY idx_tracking_data_fetched (fetched_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);
  try {
    await conn.execute(`
      ALTER TABLE tracking_data
        MODIFY tracking_id VARCHAR(64)
          CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL
          COMMENT 'Delhivery LR / waybill (from tracking_id.lr_number)'
    `);
  } catch {
    /* table may not exist yet */
  }
  try {
    await conn.execute(`
      ALTER TABLE tracking_data
        MODIFY payload LONGTEXT NOT NULL COMMENT 'Delhivery API JSON response'
    `);
  } catch {
    /* table new or already LONGTEXT */
  }
  trackingDataTableReady = true;
}
