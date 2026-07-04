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
    const [result] = await conn.execute(
      `SELECT id, trans_id, date, txn_dated_deb, txn_posted_date, cheq_no, description, type, amount, closing_balance, client_expense_id, invoice_number, invoice_status, linked_purchase_ids, dd_id, linked_module_type, linked_module_id, failed_transaction_id, cancelled_transaction_id, created_at
       FROM statements
       ORDER BY date DESC, id DESC`
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
