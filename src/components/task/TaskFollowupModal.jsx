"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import { X } from "lucide-react";
import FollowupForm from "@/components/task/TaskFollowupForm";

export default function TaskFollowupModal({ open, task, onClose }) {
  const router = useRouter();
  const [followups, setFollowups] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [formStatus, setFormStatus] = useState(task?.status ?? "Pending");

  const loadFollowups = useCallback(async () => {
    if (!task?.task_id) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/followup_task/${task.task_id}`);
      const data = await res.json();
      if (data.success) {
        setFollowups(Array.isArray(data.followups) ? data.followups : []);
        if (data.task?.status) setFormStatus(data.task.status);
      }
    } catch {
      /* keep prior history */
    } finally {
      setLoadingHistory(false);
    }
  }, [task?.task_id]);

  useEffect(() => {
    if (!open || !task?.task_id) return;
    setFormStatus(task.status ?? "Pending");
    void loadFollowups();
  }, [open, task, loadFollowups]);

  const handleSuccess = () => {
    router.refresh();
    onClose();
  };

  if (!open || !task) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-followup-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92vh,800px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
          <div>
            <h2
              id="task-followup-modal-title"
              className="text-lg font-semibold text-gray-800"
            >
              Task follow-up
            </h2>
            <p className="text-sm text-gray-500">
              #{task.task_id} · {task.taskname}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 space-y-4">
          <div className="rounded-lg bg-white p-4 text-sm text-gray-700 shadow-sm space-y-1">
            <p>
              <strong>Assigned to:</strong>{" "}
              {task.taskassignto || task.first_assignto || "—"}
            </p>
            <p>
              <strong>Deadline:</strong>{" "}
              {task.next_followup_date
                ? dayjs(task.next_followup_date).format("DD MMM YYYY, hh:mm A")
                : "—"}
            </p>
            <p>
              <strong>Status:</strong> {formStatus}
            </p>
          </div>

          <FollowupForm
            key={`${task.task_id}-${open}`}
            taskId={String(task.task_id)}
            status={formStatus}
            onSuccess={handleSuccess}
          />

          <div className="rounded-lg bg-white p-4 shadow-sm">
            <h3 className="font-semibold mb-3 text-gray-800">Follow-up history</h3>
            {loadingHistory ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : followups.length > 0 ? (
              <ul className="space-y-3 text-sm text-gray-700 max-h-48 overflow-y-auto">
                {followups.map((f, i) => (
                  <li key={i} className="border-b pb-2 last:border-none">
                    <p className="text-xs text-gray-500">
                      {f.followed_date
                        ? dayjs(f.followed_date).format("DD MMM YYYY, hh:mm A")
                        : "—"}
                    </p>
                    <p>{f.notes}</p>
                    {f.image_path ? (
                      <a
                        href={f.image_path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={f.image_path}
                          alt="Follow-up"
                          className="max-w-24 max-h-24 rounded border object-cover"
                        />
                      </a>
                    ) : null}
                    {f.status ? (
                      <p className="italic text-xs text-gray-600 mt-1">
                        Status: {f.status}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No follow-ups yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
