import { getDbConnection } from "@/lib/db";

const CREATE_PARTY_PAYMENTS = `
CREATE TABLE IF NOT EXISTS party_payments (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id   VARCHAR(32)     NOT NULL DEFAULT '',
  name          VARCHAR(255)    NOT NULL DEFAULT '',
  company_name  VARCHAR(255)    NOT NULL DEFAULT '',
  phone         VARCHAR(32)     NOT NULL DEFAULT '',
  payment_date  DATE            NULL,
  amount_in     DECIMAL(18,2)   NOT NULL DEFAULT 0.00,
  amount_out    DECIMAL(18,2)   NOT NULL DEFAULT 0.00,
  balance       DECIMAL(18,2)   NOT NULL DEFAULT 0.00,
  status        VARCHAR(32)     NOT NULL DEFAULT 'un-utilize',
  utilized      DECIMAL(18,2)   NOT NULL DEFAULT 0.00,
  un_utilized   DECIMAL(18,2)   NOT NULL DEFAULT 0.00,
  linked_statement_ids TEXT NULL,
  linked_order_id   BIGINT UNSIGNED NULL,
  order_id          VARCHAR(32)     NULL,
  invoice_number    VARCHAR(128)    NULL,
  created_by    VARCHAR(100)    NULL,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP       NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_party_payments_customer (customer_id),
  KEY idx_party_payments_payment_date (payment_date),
  KEY idx_party_payments_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

let ensured = false;

export async function ensurePartyPaymentsTable(conn) {
  if (ensured) return;
  const db = conn || (await getDbConnection());
  await db.execute(CREATE_PARTY_PAYMENTS);
  try {
    await db.execute("SELECT linked_statement_ids FROM party_payments LIMIT 1");
  } catch {
    try {
      await db.execute(
        "ALTER TABLE party_payments ADD COLUMN linked_statement_ids TEXT NULL AFTER un_utilized",
      );
    } catch {
      /* column may already exist */
    }
  }
  try {
    await db.execute("SELECT status FROM party_payments LIMIT 1");
  } catch {
    try {
      await db.execute(
        "ALTER TABLE party_payments ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'un-utilize' AFTER balance",
      );
    } catch {
      /* column may already exist */
    }
  }
  try {
    await db.execute("SELECT linked_order_id FROM party_payments LIMIT 1");
  } catch {
    try {
      await db.execute(
        "ALTER TABLE party_payments ADD COLUMN linked_order_id BIGINT UNSIGNED NULL AFTER linked_statement_ids",
      );
    } catch {
      /* column may already exist */
    }
  }
  try {
    await db.execute("SELECT order_id FROM party_payments LIMIT 1");
  } catch {
    try {
      await db.execute(
        "ALTER TABLE party_payments ADD COLUMN order_id VARCHAR(32) NULL AFTER linked_order_id",
      );
    } catch {
      /* column may already exist */
    }
  }
  try {
    await db.execute("SELECT invoice_number FROM party_payments LIMIT 1");
  } catch {
    try {
      await db.execute(
        "ALTER TABLE party_payments ADD COLUMN invoice_number VARCHAR(128) NULL AFTER order_id",
      );
    } catch {
      /* column may already exist */
    }
  }
  ensured = true;
}
