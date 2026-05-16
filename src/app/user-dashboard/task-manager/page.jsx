import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getDbConnection } from "@/lib/db";
import ClientTaskTable from "@/components/task/ClientTaskTable";
import { TASK_LIST_SELECT_SQL } from "@/lib/taskListQuery";
import { getSessionPayload } from "@/lib/auth";

const JWT_SECRET = process.env.JWT_SECRET;
export const dynamic = "force-dynamic";

async function getUsernameFromToken() {
  const token = cookies().get("token")?.value;
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

async function getTasks(username) {
  const conn = await getDbConnection();

  const query = `
    SELECT 
      ${TASK_LIST_SELECT_SQL}
    FROM 
      task t
    WHERE 
      t.createdby = ? 
      OR t.taskassignto = ?
    ORDER BY 
      t.task_id DESC
  `;

  const [rows] = await conn.execute(query, [username, username]);
  // await conn.end();
  return rows;
}

export default async function TaskPage() {
  let username = "Unknown";
  const payload = await getSessionPayload();
  if (!payload) {
    // You can handle unauthorized access here, e.g., redirect or return an error
    return null;
  }
  username = payload.username;
  if (!username) {
    return <p className="text-red-600 p-4">❌ Unauthorized</p>;
  }

  const tasks = await getTasks(username);
  // console.log("Fetched Tasks:", tasks);

  return (
    <div className="p-6 mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">📋 My Tasks</h1>
      <ClientTaskTable initialTasks={tasks} currentUser={username || ""} />
    </div>
  );
}
