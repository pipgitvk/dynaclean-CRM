// app/components/task/UpcomingTasks.jsx
import { getDbConnection } from "@/lib/db";
import TaskCard from "./TaskCard";
import { getGradientColor } from "@/utils/getGradientColor";
import dayjs from "dayjs";
import TaskTable from "./TaskTable";
import Link from "next/link";
import { CalendarDays, User } from "lucide-react";

function statusBadgeClass(status) {
  const normalized = String(status || "Pending").toLowerCase();
  if (normalized.includes("work")) {
    return "bg-blue-100 text-blue-700";
  }
  if (normalized.includes("complete")) {
    return "bg-emerald-100 text-emerald-700";
  }
  return "bg-amber-100 text-amber-700";
}

function CompactTaskRow({ task, variant = "default", bgColor }) {
  const dueLabel = task.next_followup_date
    ? dayjs(task.next_followup_date).format("DD MMM, YYYY hh:mm A")
    : "Not set";

  if (variant === "sales") {
    return (
      <div
        className="rounded-xl border border-gray-200 p-3 text-white shadow-sm"
        style={{ backgroundColor: bgColor }}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <p className="line-clamp-2 flex-1 text-sm font-medium text-white">
            {task.taskname || "Untitled"}
          </p>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass(task.status)}`}
          >
            {task.status || "Pending"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-white/90">
          <User size={12} className="shrink-0 text-white/70" />
          <span>Assigned by: {task.createdby || "Unknown"}</span>
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-white/80">
          <CalendarDays size={12} className="shrink-0 text-white/70" />
          <span>{dueLabel}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
      <div className="mt-1 h-4 w-4 shrink-0 rounded-full border-2 border-slate-300" />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium text-slate-800">
          {task.taskname || "Untitled"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Assigned by: {task.createdby || "Unknown"}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">{dueLabel}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(task.status)}`}
      >
        {task.status || "Pending"}
      </span>
    </div>
  );
}

export default async function UpcomingTasks({
  leadSource,
  compact = false,
  variant = "default",
  dashboardPrefix = "/user-dashboard",
}) {
  const connection = await getDbConnection();

  const [rows] = await connection.execute(
    `
    SELECT task_id, taskname, createdby, taskassignto, followed_date, next_followup_date, notes, status
    FROM task
    WHERE taskassignto = ? AND status != 'Completed'
    ORDER BY next_followup_date ASC
    LIMIT 20
    `,
    [leadSource]
  );

  const isSales = variant === "sales";
  const shellClass =
    compact || isSales ? "" : "bg-white lg:p-6 rounded-xl shadow-md mx-auto mt-2";
  const displayRows = compact || isSales ? rows.slice(0, 4) : rows;

  if (compact || isSales) {
    return (
      <div className={`${shellClass} flex h-full flex-col`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2
            className={
              isSales
                ? "text-base font-bold text-slate-800"
                : "text-base font-semibold text-slate-800"
            }
          >
            Upcoming Tasks ({rows.length})
          </h2>
          <Link href={`${dashboardPrefix}/new-task`}>
            <button
              type="button"
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium text-white transition ${
                isSales
                  ? "bg-violet-600 hover:bg-violet-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              Add Task
            </button>
          </Link>
        </div>

        {isSales ? (
          <div className="relative flex-1 pl-5">
            <div className="absolute bottom-2 left-[7px] top-2 w-px bg-slate-200" />
            <div className="space-y-3">
              {displayRows.length > 0 ? (
                displayRows.map((task) => {
                  const nextDate = task.next_followup_date;
                  const hours = nextDate
                    ? (new Date(nextDate).getTime() - Date.now()) / 1000 / 60 / 60
                    : null;
                  const bgColor = nextDate
                    ? getGradientColor(hours)
                    : "rgb(255, 165, 0)";

                  return (
                  <Link
                    key={task.task_id}
                    href={`${dashboardPrefix}/view-task/${task.task_id}`}
                    className="relative block transition hover:opacity-90"
                  >
                    <div className="absolute -left-5 top-4 z-10 h-3.5 w-3.5 rounded-full border-2 border-slate-300 bg-white" />
                    <CompactTaskRow
                      task={task}
                      variant="sales"
                      bgColor={bgColor}
                    />
                  </Link>
                  );
                })
              ) : (
                <p className="py-6 text-center text-sm text-slate-500">
                  No upcoming tasks.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {displayRows.length > 0 ? (
              displayRows.map((task) => (
                <Link
                  key={task.task_id}
                  href={`${dashboardPrefix}/view-task/${task.task_id}`}
                  className="block transition hover:opacity-90"
                >
                  <CompactTaskRow task={task} dashboardPrefix={dashboardPrefix} />
                </Link>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">
                No upcoming tasks.
              </p>
            )}
          </div>
        )}

        {rows.length > 0 && (
          <div className="mt-4 text-right">
            <Link
              href={`${dashboardPrefix}/task-manager`}
              className="text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              View all tasks →
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-gray-700 sm:text-3xl">
          Upcoming Tasks ({rows.length})
        </h2>
        <Link href={`${dashboardPrefix}/new-task`}>
          <button className="cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-800">
            Add Task
          </button>
        </Link>
      </div>

      <div className="hide-scrollbar w-82 overflow-x-scroll py-5 md:w-[77vw] lg:w-[71vw]">
        <div className="flex min-w-max flex-row flex-nowrap gap-4">
          {rows.map((task) => {
            const nextDate = task.next_followup_date;
            const hours = nextDate
              ? (new Date(nextDate).getTime() - Date.now()) / 1000 / 60 / 60
              : null;

            const bgColor = nextDate
              ? getGradientColor(hours)
              : "rgb(255, 165, 0)";

            return (
              <div key={task.task_id} className="w-[300px] shrink-0">
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

      <TaskTable tasks={rows} currentUser={leadSource} />
    </div>
  );
}
