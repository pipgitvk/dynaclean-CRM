// src/app/assignments/page.jsx
import { getDbConnection } from "@/lib/db";
import AssignmentsTable from "@/components/assets/AssignmentsTable";

async function fetchAssetAssignments() {
  let conn;
  try {
    conn = await getDbConnection();
    const [rows] = await conn.execute(
      `SELECT 
         aa.assignment_id,
         aa.asset_id,
         aa.submit_report_path,
         a.asset_name,
         aa.Assigned_to,
         aa.Assigned_by,
         aa.Assigned_Date,
         aa.is_submit,
         aa.submit_date,
         aa.receipt_path
       FROM asset_assignments aa
       JOIN assets a ON aa.asset_id = a.asset_id
       ORDER BY aa.Assigned_Date DESC`
    );
    return rows;
  } catch (error) {
    console.error("Failed to fetch asset assignments:", error);
    return [];
  } finally {
    console.log("Closing database connection.");
  }
}

export default async function AssignmentsPage() {
  const assignments = await fetchAssetAssignments();

  return (
    <div className="container mx-auto p-4 sm:p-8">
      <h1 className="text-xl font-bold text-gray-900 mb-6">
        Asset Assignment History
      </h1>
      <AssignmentsTable assignments={assignments} />
    </div>
  );
}
