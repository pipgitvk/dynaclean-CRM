"use client";

import { useState } from "react";
import Link from "next/link";
import ReassignModal from "@/components/models/ReassignModal";

export default function ViewTaskActions({ task, currentUser = "", basePath = "user-dashboard" }) {
  const [reassignOpen, setReassignOpen] = useState(false);
  const canReassign = currentUser && (task.createdby || "").trim().toLowerCase() === currentUser.trim().toLowerCase();

  return (
    <>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/${basePath}/followup_task/${task.task_id}`}
          className="inline-block bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg text-sm"
        >
          Follow Task
        </Link>
        {canReassign && (
          <button
            type="button"
            onClick={() => setReassignOpen(true)}
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm"
          >
            Reassign
          </button>
        )}
      </div>
      <ReassignModal
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        task={task}
      />
    </>
  );
}
