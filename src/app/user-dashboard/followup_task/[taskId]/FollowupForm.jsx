"use client";

import TaskFollowupForm from "@/components/task/TaskFollowupForm";

export default function FollowupForm({ taskId, status, onSuccess }) {
  return (
    <TaskFollowupForm
      taskId={taskId}
      status={status}
      onSuccess={onSuccess}
      useRouterBack={!onSuccess}
    />
  );
}
