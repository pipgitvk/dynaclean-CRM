import { redirect } from "next/navigation";
import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import ClientExpensesTable from "./ClientExpensesTable";

const JWT_SECRET = process.env.JWT_SECRET;

export const dynamic = "force-dynamic";

export default async function ClientExpensesPage({ searchParams }) {
  const sp = await searchParams;
  const selectedClient = sp?.client || null;
  const selectedGroup = sp?.group || null;
  const selectedSubHead = sp?.sub_head || null;

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

  if (!selectedClient || !selectedGroup) {
    redirect("/admin-dashboard/client-expenses/cards");
  }

  let rows = [];
  try {
    const conn = await getDbConnection();
    const [result] = await conn.execute(
      `SELECT ce.id, ce.expense_name, ce.client_name, ce.group_name, ce.main_head, ce.head, ce.supply, ce.type_of_ledger, ce.cgst, ce.sgst, ce.igst, ce.hsn, ce.gst_rate, ce.amount, ce.created_at,
              GROUP_CONCAT(cesh.sub_head SEPARATOR ', ') as sub_head
       FROM client_expenses ce
       LEFT JOIN client_expense_sub_heads cesh ON ce.id = cesh.client_expense_id
       GROUP BY ce.id
       ORDER BY ce.id DESC`,
    );
    rows = result;
  } catch (err) {
    console.error("[client-expenses] DB error:", err?.message);
  }

  const filteredRows = rows.filter((r) => {
    const client = r.client_name || "—";
    const group = r.group_name || "—";
    return client === selectedClient && group === selectedGroup;
  });

  const rowsBySubHead = selectedSubHead
    ? filteredRows.filter((r) => {
        const sh = (r.sub_head || "").split(",").map((s) => s.trim()).filter(Boolean);
        if (selectedSubHead === "—") return sh.length === 0;
        return sh.includes(selectedSubHead);
      })
    : filteredRows;

  return (
    <ClientExpensesTable
      rows={rowsBySubHead}
      client={selectedClient}
      group={selectedGroup}
    />
  );
}

