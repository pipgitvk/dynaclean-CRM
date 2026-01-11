"use server";

import { getDbConnection } from "@/lib/db";
import AssignServiceForm from "@/components/services/AssignServiceForm";

// Server Action
export async function updateServiceAssignment(formData) {
  const serviceIdToUpdate = formData.get("service_id");
  const assigned_to = formData.get("assigned_to");

  if (!serviceIdToUpdate || !assigned_to) {
    return { error: "Service ID and assigned user are required." };
  }

  let connection;
  try {
    connection = await getDbConnection();
    const [result] = await connection.execute(
      "UPDATE service_records SET assigned_to = ? WHERE service_id = ?",
      [assigned_to, serviceIdToUpdate]
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
  const service_id = params.service_id;
  const message = searchParams?.message || "";

  let engineers = [];
  let connection;
  try {
    connection = await getDbConnection();
    const [rows] = await connection.execute(
      "SELECT username FROM rep_list WHERE userRole = 'SERVICE ENGINEER'"
    );
    engineers = rows.map((row) => row.username);
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
          engineers={engineers}
          serviceId={service_id}
          updateServiceAssignment={updateServiceAssignment}
          message={message}
        />
      </div>
    </div>
  );
}
