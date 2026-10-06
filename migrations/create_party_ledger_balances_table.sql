-- One row per party: total debit, credit, net balance (Dr / Cr / flat).
CREATE TABLE IF NOT EXISTS `party_ledger_balances` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `customer_id`   VARCHAR(32)     NOT NULL DEFAULT '',
  `party_name`    VARCHAR(255)    NOT NULL,
  `total_debit`   DECIMAL(18,2)   NOT NULL DEFAULT 0.00,
  `total_credit`  DECIMAL(18,2)   NOT NULL DEFAULT 0.00,
  `net_balance`   DECIMAL(18,2)   NOT NULL DEFAULT 0.00,
  `balance_side`  VARCHAR(8)      NOT NULL DEFAULT 'flat',
  `line_count`    INT UNSIGNED    NOT NULL DEFAULT 0,
  `synced_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_party_ledger_balance` (`customer_id`, `party_name`),
  KEY `idx_plb_customer` (`customer_id`),
  KEY `idx_plb_net` (`net_balance`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
