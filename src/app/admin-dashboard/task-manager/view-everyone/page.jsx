import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getDbConnection } from "@/lib/db";
import ClientTaskTable from "@/components/task//ClientTaskTableAdmin";

const JWT_SECRET = process.env.JWT_SECRET;
export const dynamic = "force-dynamic";

async function getTasks() {
  const conn = await getDbConnection();

  const query = `
    SELECT 
      t.task_id, 
      t.taskname, 
      t.createdby, 
      t.taskassignto, 
      (
        SELECT tf.reassign 
        FROM task_followup tf 
        WHERE tf.task_id = t.task_id 
        ORDER BY tf.id DESC 
        LIMIT 1
      ) AS reassign,
      (
        SELECT tf.taskassignto 
        FROM task_followup tf 
        WHERE tf.task_id = t.task_id 
        ORDER BY tf.id ASC 
        LIMIT 1
      ) AS first_assignto,
      t.followed_date, 
      t.next_followup_date, 
      t.status, 
      t.task_completion_date
    FROM 
      task t
    ORDER BY 
      t.task_id DESC
  `;
  const [rows] = await conn.execute(query);
  // await conn.end();
  return rows;
}

export default async function TaskPage() {
  const tasks = await getTasks();

  return (
    <div className="p-6 mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📋 All Tasks</h1>

        {/* Button to navigate to the page to view everyone's tasks */}
        <a href="/admin-dashboard/task-manager" passHref>
          <button className="px-4 py-2 bg-blue-500 text-white rounded-md cursor-pointer hover:bg-blue-600 transition">
            Back
          </button>
        </a>
      </div>
      <ClientTaskTable initialTasks={tasks} />
    </div>
  );
}
