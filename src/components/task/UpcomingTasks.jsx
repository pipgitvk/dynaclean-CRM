// app/components/task/UpcomingTasks.jsx
import { getDbConnection } from "@/lib/db";
import TaskCard from "./TaskCard";
import { getGradientColor } from "@/utils/getGradientColor";
import dayjs from "dayjs";
import TaskTable from "./TaskTable";
import Link from "next/link";

export default async function UpcomingTasks({ leadSource }) {
  const connection = await getDbConnection();

  const [rows] = await connection.execute(
    `
    SELECT task_id, taskname, createdby, taskassignto, followed_date, next_followup_date, notes, status
    FROM task
    WHERE taskassignto = ? AND status != 'Completed'
    `,
    [leadSource]
  );

  // await connection.end();

  return (
    <div
      // style={{ paddingRight: "5rem" }}
      className="bg-white lg:p-6 rounded-xl shadow-md mx-auto mt-2 "
    >
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h2 className="text-2xl sm:text-3xl font-semibold text-gray-700">
          Upcoming Tasks ({rows.length})
        </h2>
        <Link href="/user-dashboard/new-task">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-800 transition cursor-pointer">
            Add Task
          </button>
        </Link>
      </div>

      {/* This is the horizontal slider container */}
      <div className="w-82 md:w-[77vw] lg:w-[71vw] overflow-x-scroll py-5 hide-scrollbar ">
        <div className="flex flex-row gap-4 flex-nowrap min-w-max">
          {rows.map((task, index) => {
            const nextDate = task.next_followup_date;
            const hours = nextDate
              ? (new Date(nextDate).getTime() - Date.now()) / 1000 / 60 / 60
              : null;

            const bgColor = nextDate
              ? getGradientColor(hours)
              : "rgb(255, 165, 0)"; // orange if no deadline

            return (
              // This container ensures each card has a fixed width
              <div key={task.task_id} className="w-[300px] flex-shrink-0">
                <TaskCard
                  taskId={task.task_id}
                  title={task.taskname || "Untitled"}
                  description={task.notes || "No notes"}
                  dueDate={
                    task.next_followup_date
                      ? dayjs(task.next_followup_date).format(
                          "DD MMM, YYYY hh:mm A"
                        )
                      : "Not set"
                  }
                  assignDate={
                    task.followed_date
                      ? dayjs(task.followed_date).format("DD MMM, YYYY hh:mm A")
                      : "Unknown"
                  }
                  assignedBy={task.createdby || "Unknown"}
                  status={task.status || "Pending"}
                  bgColor={bgColor}
                />
              </div>
            );
          })}
        </div>
      </div>

      <TaskTable tasks={rows} />
    </div>
  );
}
