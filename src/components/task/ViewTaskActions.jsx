"use client";

import Link from "next/link";

export default function ViewTaskActions({ task, basePath = "user-dashboard" }) {
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <Link
        href={`/${basePath}/followup_task/${task.task_id}`}
        className="inline-block bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg text-sm"
      >
        Follow Task
      </Link>
    </div>
  );
}
