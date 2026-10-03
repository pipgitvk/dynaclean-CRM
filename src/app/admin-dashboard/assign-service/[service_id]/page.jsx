"use server";

import { getDbConnection } from "@/lib/db";
import AssignServiceForm from "@/components/services/AssignServiceForm";

// Server Action
export async function updateServiceAssignment(formData) {
  const serviceIdToUpdate = formData.get("service_id");
  const assigned_to_type = formData.get("assigned_to_type");
  const assigned_to = formData.get("assigned_to");
  const assigned_to_id = formData.get("assigned_to_id") || null;

  if (!serviceIdToUpdate || !assigned_to_type || !assigned_to) {
    return { error: "Service ID, assignment type, and assigned user are required." };
  }

  let connection;
  try {
    connection = await getDbConnection();
    
    // Update both assigned_to (username for internal) and new fields for tracking type and third-party ID
    const [result] = await connection.execute(
      "UPDATE service_records SET assigned_to = ?, assigned_to_type = ?, assigned_to_id = ? WHERE service_id = ?",
      [assigned_to, assigned_to_type, assigned_to_id, serviceIdToUpdate]
    );

    if (result.affectedRows === 0) {
      return { error: "No record found with that Service ID." };
    }

    return {
      success: true,
      redirectTo: "/user-dashboard/view_service_reports",
    };
  } catch (err) {
    console.error("Database update error:", err);
    return { error: "Failed to update record." };
  } finally {
    if (connection?.release) connection.release?.();
  }
}

// Page Component
export default async function AssignServicePage({ params, searchParams }) {
  const { service_id } = await params;
  const message = searchParams?.message || "";

  let internalEngineers = [];
  let thirdPartyEngineers = [];
  let connection;
  try {
    connection = await getDbConnection();
    
    // Fetch internal engineers (SERVICE ENGINEER, SERVICE TECHNICIAN, SERVICE SUPPORT)
    const [internalRows] = await connection.execute(
      "SELECT username FROM rep_list WHERE userRole IN ('SERVICE ENGINEER', 'SERVICE TECHNICIAN', 'SERVICE SUPPORT ') AND status = 1"
    );
    internalEngineers = internalRows.map((row) => row.username);

    // Fetch third-party engineers (active only)
    const [thirdPartyRows] = await connection.execute(
      "SELECT engineer_id, name FROM third_party_service_engineers WHERE status = 'active' ORDER BY name ASC"
    );
    thirdPartyEngineers = thirdPartyRows;
  } catch (err) {
    console.error("Database query error:", err);
  } finally {
    if (connection?.release) connection.release?.();
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
      <h2 className="text-3xl font-extrabold text-center text-gray-900 mb-8">
        Assign Service
      </h2>
      <div className="max-w-md mx-auto bg-white p-8 rounded-xl shadow-lg">
        <AssignServiceForm
          internalEngineers={internalEngineers}
          thirdPartyEngineers={thirdPartyEngineers}
          serviceId={service_id}
          updateServiceAssignment={updateServiceAssignment}
          message={message}
        />
      </div>
    </div>
  );
}
