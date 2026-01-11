// server component
import { getDbConnection } from "@/lib/db";
import dayjs from "dayjs";
import FollowupForm from "./FollowupForm";

export default async function FollowupTaskPage({ params }) {
  const taskId = params.taskId;

  const conn = await getDbConnection();

  const [[taskRow]] = await conn.execute(
    `SELECT * FROM task WHERE task_id = ?`,
    [taskId]
  );

  const [followups] = await conn.execute(
    `SELECT followed_date, notes, status FROM task_followup WHERE task_id = ? ORDER BY followed_date DESC`,
    [taskId]
  );

  // await conn.end();

  if (!taskRow)
    return <p className="text-center p-8 text-red-500">Task not found.</p>;

  return (
    <div className=" mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Follow-up Task</h1>

      {/* Task Info */}
      <div className="bg-white shadow-md rounded-lg p-6 space-y-2 text-sm text-gray-700">
        <p>
          <strong>Task Name:</strong> {taskRow.taskname}
        </p>
        <p>
          <strong>Assigned To:</strong> {taskRow.taskassignto}
        </p>
        <p>
          <strong>Deadline:</strong>{" "}
          {dayjs(taskRow.next_followup_date).format("DD MMM YYYY, hh:mm A")}
        </p>
        <p className="flex items-center gap-2">
          <strong>Status:</strong>
          <span
            className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${
              taskRow.status === "Completed"
                ? "bg-green-100 text-green-700"
                : taskRow.status === "Working"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {taskRow.status}
          </span>
        </p>
      </div>

      {/* Follow-up Form (Client Component) */}
      <FollowupForm taskId={taskId} status={taskRow.status} />

      {/* Follow-up History */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="font-semibold mb-4 text-gray-800">Follow-up History</h2>
        {followups.length > 0 ? (
          <ul className="space-y-3 text-sm text-gray-700">
            {followups.map((f, i) => (
              <li key={i} className="border-b pb-2 last:border-none">
                <p className="text-xs text-gray-500">
                  {dayjs(f.followed_date).format("DD MMM YYYY, hh:mm A")}
                </p>
                <p>{f.notes}</p>
                <p className="italic text-xs text-gray-600">
                  Status: {f.status}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No follow-ups yet.</p>
        )}
      </div>
    </div>
  );
}
