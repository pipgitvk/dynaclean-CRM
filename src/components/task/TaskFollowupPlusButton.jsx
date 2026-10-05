"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import TaskFollowupModal from "@/components/task/TaskFollowupModal";

const defaultButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-md border border-green-200 bg-green-50 text-green-700 hover:bg-green-100";

/**
 * @param {{ task: Record<string, unknown>|null|undefined, className?: string, title?: string, size?: number }} props
 */
export default function TaskFollowupPlusButton({
  task,
  className = defaultButtonClass,
  title = "Add follow-up",
  size = 16,
}) {
  const [open, setOpen] = useState(false);
  const taskId = task?.task_id;
  if (taskId == null) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        title={title}
        aria-label={`${title} task ${taskId}`}
      >
        <Plus size={size} strokeWidth={2.5} />
      </button>
      <TaskFollowupModal
        open={open}
        task={task}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
