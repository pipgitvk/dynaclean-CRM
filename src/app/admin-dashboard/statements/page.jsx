import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import StatementTable from "./StatementTable";

const JWT_SECRET = process.env.JWT_SECRET;

export const dynamic = "force-dynamic";

export default async function StatementsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return <p className="text-red-600 p-4">Unauthorized</p>;
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
  } catch (err) {
    return <p className="text-red-600 p-4">Invalid Token</p>;
  }

  let rows = [];
  try {
    const conn = await getDbConnection();
    try {
      await conn.execute("SELECT txn_posted_date FROM statements LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE statements ADD COLUMN txn_posted_date DATE NULL AFTER txn_dated_deb");
      } catch (__) {}
    }
    try {
      await conn.execute("SELECT invoice_number FROM statements LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE statements ADD COLUMN invoice_number VARCHAR(100) NULL");
      } catch (__) {}
    }
    try {
      await conn.execute("SELECT invoice_status FROM statements LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE statements ADD COLUMN invoice_status VARCHAR(50) NULL");
      } catch (__) {}
    }
    try {
      await conn.execute("SELECT closing_balance FROM statements LIMIT 1");
    } catch (_) {
      try {
        await conn.execute(
          "ALTER TABLE statements ADD COLUMN closing_balance DECIMAL(18,2) NULL COMMENT 'Bank running balance from import'"
        );
      } catch (__) {}
    }
    try {
      await conn.execute("SELECT linked_purchase_ids FROM statements LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE statements ADD COLUMN linked_purchase_ids TEXT NULL");
      } catch (__) {}
    }
    try {
      await conn.execute("SELECT dd_id FROM statements LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE statements ADD COLUMN dd_id INT NULL");
      } catch (__) {}
    }
    try {
      await conn.execute("SELECT linked_module_type FROM statements LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE statements ADD COLUMN linked_module_type ENUM('Invoice', 'Purchases', 'DD', 'Expense', 'Assets') NULL");
      } catch (__) {}
    }
    try {
      await conn.execute("SELECT linked_module_id FROM statements LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE statements ADD COLUMN linked_module_id INT UNSIGNED NULL");
      } catch (__) {}
    }
    // Ensure failed_transaction_id column exists
    try {
      await conn.execute("SELECT failed_transaction_id FROM statements LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE statements ADD COLUMN failed_transaction_id INT UNSIGNED NULL AFTER linked_module_id");
      } catch (__) {}
    }
    // Ensure cancelled_transaction_id column exists
    try {
      await conn.execute("SELECT cancelled_transaction_id FROM statements LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE statements ADD COLUMN cancelled_transaction_id INT UNSIGNED NULL AFTER failed_transaction_id");
      } catch (__) {}
    }
    // Ensure bank_masters table exists and bank_id / account_number columns exist on statements
    try {
      await conn.execute("SELECT id FROM bank_masters LIMIT 1");
    } catch (_) {
      try {
        await conn.execute(`
          CREATE TABLE IF NOT EXISTS bank_masters (
            id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
            bank_name           VARCHAR(150) NOT NULL,
            ifsc                VARCHAR(20)  NULL,
            account_number      VARCHAR(50)  NULL,
            branch_address      TEXT         NULL,
            account_holder_name VARCHAR(200) NULL,
            created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at          TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
      } catch (__) {}
    }
    try {
      await conn.execute("SELECT bank_id FROM statements LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE statements ADD COLUMN bank_id INT UNSIGNED NULL");
      } catch (__) {}
    }
    try {
      await conn.execute("SELECT account_number FROM statements LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE statements ADD COLUMN account_number VARCHAR(50) NULL");
      } catch (__) {}
    }
    const [result] = await conn.execute(
      `SELECT s.id, s.trans_id, s.date, s.txn_dated_deb, s.txn_posted_date, s.cheq_no, s.description, s.type, s.amount, s.closing_balance, s.client_expense_id, s.invoice_number, s.invoice_status, s.linked_purchase_ids, s.dd_id, s.linked_module_type, s.linked_module_id, s.failed_transaction_id, s.cancelled_transaction_id, s.bank_id, s.account_number, s.created_at,
              bm.bank_name
       FROM statements s
       LEFT JOIN bank_masters bm ON bm.id = s.bank_id
       ORDER BY s.date DESC, s.id DESC`
    );
    rows = result;
  } catch (err) {
    console.error("[statements] DB error:", err?.message);
  }

  return (
    <div className="max-w-[1600px] mx-auto p-6 w-full">
      <StatementTable rows={rows} />
    </div>
  );
}
