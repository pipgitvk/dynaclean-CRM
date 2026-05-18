import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getDbConnection } from "@/lib/db";
import ClientTaskTable from "@/components/task//ClientTaskTableAdmin"; // ⬅️ NEW
import { TASK_LIST_SELECT_SQL } from "@/lib/taskListQuery";
import RecurrenceService from "@/lib/services/RecurrenceService";

const JWT_SECRET = process.env.JWT_SECRET;
export const dynamic = "force-dynamic";

async function getUsernameFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET),
    );
    return payload.username;
  } catch (e) {
    console.error("JWT Error:", e);
    return null;
  }
}

async function getTasks(username, role) {
  const pool = await getDbConnection();
  const setupConn = await pool.getConnection();
  try {
    await RecurrenceService.ensureRecurringSchema(setupConn);
    await RecurrenceService.backfillAutomaticTaskAssignDates(setupConn);
  } finally {
    setupConn.release();
  }

  const isPrivileged = ["SUPERADMIN", "DIRECTOR"].includes(String(role).toUpperCase());

  const query = `
    SELECT 
      ${TASK_LIST_SELECT_SQL}
    FROM 
      task t
    ${isPrivileged ? "" : "WHERE t.createdby = ? OR t.taskassignto = ?"}
    ORDER BY 
      t.task_id DESC
  `;

  const [rows] = await pool.execute(query, isPrivileged ? [] : [username, username]);
  // await conn.end();
  return rows;
}
export default async function TaskPage() {
  const username = await getUsernameFromToken();
  if (!username) {
    return <p className="text-red-600 p-4">❌ Unauthorized</p>;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  let role = "";
  if (token) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
      role = payload.role || "";
    } catch {}
  }

  const tasks = await getTasks(username, role);

  return (
    <div className="p-6 mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📋 My Tasks</h1>

        {/* Button to navigate to the page to view everyone's tasks */}
        <a href="/admin-dashboard/task-manager/view-everyone" passHref>
          <button className="px-4 py-2 bg-blue-500 text-white rounded-md cursor-pointer hover:bg-blue-600 transition">
            All Tasks
          </button>
        </a>
      </div>
      <ClientTaskTable initialTasks={tasks} currentUser={username} />
    </div>
  );
}
