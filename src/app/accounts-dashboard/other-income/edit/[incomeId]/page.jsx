import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { notFound } from "next/navigation";
import EditOtherIncomeForm from "../EditOtherIncomeForm";

export const dynamic = "force-dynamic";

export default async function EditOtherIncomePage({ params }) {
  const { incomeId } = params;

  const payload = await getSessionPayload();
  if (!payload) {
    return null;
  }

  const conn = await getDbConnection();

  const query = `
    SELECT * FROM other_income
    WHERE id = ? AND username = ?
  `;

  const [rows] = await conn.execute(query, [incomeId, payload.username]);

  if (!rows || rows.length === 0) {
    notFound();
  }

  const income = rows[0];

  return <EditOtherIncomeForm income={income} />;
}
