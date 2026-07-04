import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import OtherIncomeTable from "./OtherIncomeTable";

export const dynamic = "force-dynamic";

export default async function AdminOtherIncomePage() {
  const payload = await getSessionPayload();
  if (!payload) {
    return null;
  }

  const role = payload.role;

  const conn = await getDbConnection();

  // Admin can see all entries (not filtered by username)
  const query = `
    SELECT 
      id,
      income_name,
      income_source,
      income_category,
      amount,
      income_date,
      transaction_date,
      gst_applicable,
      gst_rate,
      gst_amount,
      tds_deducted,
      tds_amount,
      receipt_mode,
      bank_cash_account,
      approval_status,
      username,
      receipt_attachment_path,
      proof_attachment_path,
      invoice_attachment_path,
      supporting_document_path,
      remarks,
      created_at
    FROM other_income
    ORDER BY income_date DESC
  `;

  const [rows] = await conn.execute(query);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-700">All Other Income Entries</h1>

        <div className="flex gap-4">
          <a
            href="other-income/add"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow"
          >
            Add Other Income
          </a>
        </div>
      </div>

      <OtherIncomeTable rows={rows} role={role} isAdmin={true} />
    </div>
  );
}
