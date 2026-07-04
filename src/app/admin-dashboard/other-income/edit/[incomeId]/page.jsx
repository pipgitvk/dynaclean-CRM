import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { notFound } from "next/navigation";
import EditOtherIncomeForm from "@/app/accounts-dashboard/other-income/edit/EditOtherIncomeForm";

export const dynamic = "force-dynamic";

export default async function EditOtherIncomePage({ params }) {
  const { incomeId } = params;

  const payload = await getSessionPayload();
  if (!payload) {
    return null;
  }

  const conn = await getDbConnection();

  // Admin can edit any entry
  const query = `
    SELECT * FROM other_income
    WHERE id = ?
  `;

  const [rows] = await conn.execute(query, [incomeId]);

  if (!rows || rows.length === 0) {
    notFound();
  }

  const income = rows[0];

  return <EditOtherIncomeForm income={income} />;
}
