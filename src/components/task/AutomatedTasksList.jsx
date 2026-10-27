"use client";

import { useEffect, useState } from "react";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { Pencil, RefreshCw, X } from "lucide-react";
import RecurringTaskForm from "@/components/recurring-tasks/RecurringTaskForm";

function formatDateTime(value) {
  if (!value) return "-";
  const d = dayjs(value);
  return d.isValid() ? d.format("DD MMM YYYY HH:mm") : "-";
}

function frequencyLabel(task) {
  const type = String(task.recurrence_type || "").toLowerCase();
  const interval = Number(task.repeat_interval || 1);
  const unit =
    type === "daily"
      ? "day"
      : type === "weekly"
      ? "week"
      : type === "monthly"
      ? "month"
      : type === "yearly"
      ? "year"
      : type || "—";
  const cap = type ? type.charAt(0).toUpperCase() + type.slice(1) : "—";
  if (interval > 1) return `${cap} (every ${interval} ${unit}s)`;
  return cap;
}

export default function AutomatedTasksList() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/recurring-tasks");
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Failed to load automated tasks");
      }
      setTasks(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to load automated tasks");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const filtered = tasks.filter((task) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      String(task.task_title || "").toLowerCase().includes(q) ||
      String(task.created_by_name || "").toLowerCase().includes(q) ||
      String(task.assigned_user_name || "").toLowerCase().includes(q) ||
      String(task.recurrence_type || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Automated Tasks</h2>
          <p className="text-sm text-gray-500">
            Recurring series created from task manager. Edit frequency, assignee, or schedule.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchTasks}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, creator, assignee, or frequency..."
        className="w-full max-w-md border p-2 rounded-md"
      />

      {loading ? (
        <div className="p-6 text-gray-500">Loading automated tasks...</div>
      ) : filtered.length === 0 ? (
        <div className="p-6 text-gray-500 bg-white rounded-lg shadow">
          No automated tasks found.
        </div>
      ) : (
        <div className="overflow-x-auto bg-white shadow rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-left text-gray-700">
              <tr>
                <th className="p-3">Task Name</th>
                <th className="p-3">Created by</th>
                <th className="p-3">Assigned to</th>
                <th className="p-3">Created on</th>
                <th className="p-3">Create every (date-time)</th>
                <th className="p-3">Frequency</th>
                <th className="p-3">Status</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((task) => (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-900">{task.task_title}</td>
                  <td className="p-3">{task.created_by_name || "-"}</td>
                  <td className="p-3">{task.assigned_user_name || "-"}</td>
                  <td className="p-3">{formatDateTime(task.created_at)}</td>
                  <td className="p-3">{formatDateTime(task.next_run_at || task.start_date)}</td>
                  <td className="p-3">{frequencyLabel(task)}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        task.status === "active" && task.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {task.status === "active" && task.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-3">
                    {task.can_modify ? (
                      <button
                        type="button"
                        onClick={() => setEditing(task)}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                      >
                        <Pencil className="w-4 h-4" />
                        Modify
                      </button>
                    ) : (
                      <span className="text-gray-400 text-xs">View only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-bold text-gray-800">Modify automated task</h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="text-gray-500 hover:text-gray-800"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <RecurringTaskForm
                initialData={editing}
                onSuccess={() => {
                  setEditing(null);
                  fetchTasks();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
