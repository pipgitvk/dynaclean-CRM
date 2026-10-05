-- Party ledger snapshot (one row per ledger line per party).
-- Run on your MySQL DB, e.g.:
--   mysql -u USER -p DB_NAME < migrations/create_party_ledger_lines_table.sql
--
-- After table exists, fill data via app (logged in as ADMIN/SUPERADMIN):
--   POST /api/parties/ledger/sync  body: { "syncAll": true }
-- Or open parties in UI — each ledger load also saves to this table.

CREATE TABLE IF NOT EXISTS `party_ledger_lines` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `customer_id`  VARCHAR(32)     NOT NULL DEFAULT '',
  `party_name`   VARCHAR(255)    NOT NULL,
  `source_key`   VARCHAR(128)    NOT NULL,
  `entry_date`   DATE            NOT NULL,
  `particulars`  VARCHAR(500)    NOT NULL,
  `vch_type`     VARCHAR(100)    NOT NULL DEFAULT '',
  `vch_no`       VARCHAR(100)    NOT NULL DEFAULT '',
  `debit`        DECIMAL(18,2)   NOT NULL DEFAULT 0.00,
  `credit`       DECIMAL(18,2)   NOT NULL DEFAULT 0.00,
  `source`       VARCHAR(64)     NOT NULL DEFAULT '',
  `sort_order`   INT             NOT NULL DEFAULT 0,
  `synced_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_party_ledger_line` (`customer_id`, `party_name`, `source_key`),
  KEY `idx_pll_customer` (`customer_id`),
  KEY `idx_pll_party_name` (`party_name`),
  KEY `idx_pll_entry_date` (`entry_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
