"use client";

import TaskFollowupForm from "@/components/task/TaskFollowupForm";

export default function FollowupForm({ taskId, status, onSuccess }) {
  return (
    <TaskFollowupForm
      taskId={taskId}
      status={status}
      onSuccess={onSuccess}
      redirectAfterSubmit={
        onSuccess ? null : "/admin-dashboard?message=followup-success"
      }
    />
  );
}
