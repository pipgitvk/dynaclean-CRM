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
    const [result] = await conn.execute(
      `SELECT id, trans_id, date, txn_dated_deb, txn_posted_date, cheq_no, description, type, amount, closing_balance, client_expense_id, invoice_number, invoice_status, linked_purchase_ids, created_at
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
