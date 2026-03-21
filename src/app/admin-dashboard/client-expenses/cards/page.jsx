import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import ClientExpensesCardsClient from "./ClientExpensesCardsClient";

const JWT_SECRET = process.env.JWT_SECRET;

export const dynamic = "force-dynamic";

export default async function ClientExpensesCardsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return <p className="text-red-600 p-4">Unauthorized</p>;
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
  } catch {
    return <p className="text-red-600 p-4">Invalid Token</p>;
  }

  let rows = [];
  try {
    const conn = await getDbConnection();
    try {
      await conn.execute("SELECT transaction_id FROM client_expenses LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE client_expenses ADD COLUMN transaction_id VARCHAR(255) NULL AFTER hsn");
      } catch (__) {}
    }
    const [result] = await conn.execute(
      `SELECT ce.id, ce.expense_name, ce.client_name, ce.group_name, ce.amount, ce.transaction_id,
              GROUP_CONCAT(cesh.sub_head SEPARATOR ', ') as sub_head,
              COALESCE(
                NULLIF(
                  (SELECT GROUP_CONCAT(DISTINCT s.trans_id ORDER BY s.id SEPARATOR ', ')
                   FROM statements s WHERE s.client_expense_id = ce.id),
                  ''
                ),
                NULLIF(
                  (SELECT GROUP_CONCAT(DISTINCT s2.trans_id ORDER BY s2.id SEPARATOR ', ')
                   FROM statements s2
                   WHERE TRIM(COALESCE(ce.transaction_id, '')) != ''
                     AND s2.trans_id = ce.transaction_id),
                  ''
                ),
                NULLIF(TRIM(ce.transaction_id), '')
              ) AS statement_trans_ids
       FROM client_expenses ce
       LEFT JOIN client_expense_sub_heads cesh ON ce.id = cesh.client_expense_id
       GROUP BY ce.id
       ORDER BY ce.id DESC`,
    );
    rows = result;
  } catch (err) {
    console.error("[client-expenses cards] DB error:", err?.message);
  }

  return <ClientExpensesCardsClient rows={rows} />;
}
