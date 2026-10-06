import { getDbConnection } from "@/lib/db";

const CREATE_PARTY_LEDGER_LINES = `
CREATE TABLE IF NOT EXISTS party_ledger_lines (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id  VARCHAR(32)     NOT NULL DEFAULT '',
  party_name   VARCHAR(255)    NOT NULL,
  source_key   VARCHAR(128)    NOT NULL,
  entry_date   DATE            NOT NULL,
  particulars  VARCHAR(500)    NOT NULL,
  vch_type     VARCHAR(100)    NOT NULL DEFAULT '',
  vch_no       VARCHAR(100)    NOT NULL DEFAULT '',
  debit        DECIMAL(18,2)   NOT NULL DEFAULT 0.00,
  credit       DECIMAL(18,2)   NOT NULL DEFAULT 0.00,
  source       VARCHAR(64)     NOT NULL DEFAULT '',
  sort_order   INT             NOT NULL DEFAULT 0,
  synced_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_party_ledger_line (customer_id, party_name, source_key),
  KEY idx_pll_customer (customer_id),
  KEY idx_pll_party_name (party_name),
  KEY idx_pll_entry_date (entry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

const CREATE_PARTY_LEDGER_BALANCES = `
CREATE TABLE IF NOT EXISTS party_ledger_balances (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id   VARCHAR(32)     NOT NULL DEFAULT '',
  party_name    VARCHAR(255)    NOT NULL,
  total_debit   DECIMAL(18,2)   NOT NULL DEFAULT 0.00,
  total_credit  DECIMAL(18,2)   NOT NULL DEFAULT 0.00,
  net_balance   DECIMAL(18,2)   NOT NULL DEFAULT 0.00,
  balance_side  VARCHAR(8)      NOT NULL DEFAULT 'flat',
  line_count    INT UNSIGNED    NOT NULL DEFAULT 0,
  synced_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_party_ledger_balance (customer_id, party_name),
  KEY idx_plb_customer (customer_id),
  KEY idx_plb_net (net_balance)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

export function netBalanceSide(netBalance) {
  const net = Number(netBalance || 0);
  if (Math.abs(net) <= 0.01) {
    return { net_balance: 0, balance_side: "flat" };
  }
  if (net > 0) {
    return { net_balance: Number(net.toFixed(2)), balance_side: "Dr" };
  }
  return { net_balance: Number(net.toFixed(2)), balance_side: "Cr" };
}

export async function ensurePartyLedgerLinesTable(conn) {
  const db = conn || (await getDbConnection());
  await db.execute(CREATE_PARTY_LEDGER_LINES);
  await db.execute(CREATE_PARTY_LEDGER_BALANCES);
  return db;
}
