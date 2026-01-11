"use client";

import { useEffect, useState, useMemo } from "react";
import {
  CalendarDays,
  Eye,
  Repeat,
  PenLine,
  Search,
  User,
  Clock,
} from "lucide-react";
import dayjs from "dayjs";
import ReassignModal from "@/components/models/ReassignModal";
import toast from "react-hot-toast";

const TaskTable = ({ tasks = [] }) => {
  const [isClient, setIsClient] = useState(false);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTask, setModalTask] = useState(null);
  const [repList, setRepList] = useState([]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const filteredTasks = useMemo(() => {
    const keyword = search.toLowerCase();
    return tasks.filter((task) => {
      return (
        (task.taskname || "").toLowerCase().includes(keyword) ||
        (task.createdby || "").toLowerCase().includes(keyword) ||
        (task.status || "").toLowerCase().includes(keyword)
      );
    });
  }, [search, tasks]);

  if (!isClient) return null;

  const openReassign = (task) => {
    setModalTask(task);
    setIsModalOpen(true);
  };

  const closeModal = (didUpdate = false) => {
    setIsModalOpen(false);
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case "in progress":
        return "bg-yellow-500";
      case "completed":
        return "bg-green-500";
      case "pending":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="mt-8">
      {/* 🔍 Search Box */}
      <div className="mb-4 flex items-center gap-2 px-2">
        <Search className="text-gray-500" size={18} />
        <input
          type="text"
          placeholder="Search by task name, assigned by, or status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-4 py-2 border border-gray-300 text-amber-950 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
      </div>

      {/* 📋 Table View (Large Screens) */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 bg-white text-sm text-left">
          <thead className="bg-gray-100 text-gray-700 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Assigned By</th>
              <th className="px-4 py-3">Task Name</th>
              <th className="px-4 py-3">Assign Date</th>
              <th className="px-4 py-3">Deadline</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task) => (
                <tr key={task.task_id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {task.createdby || "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{task.taskname}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {dayjs(task.followed_date).format("DD MMM, YYYY hh:mm A")}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {task.next_followup_date
                      ? dayjs(task.next_followup_date).format(
                          "DD MMM, YYYY hh:mm A"
                        )
                      : "Not set"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 text-xs font-semibold text-white rounded-full ${getStatusColor(
                        task.status
                      )}`}
                    >
                      {task.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <a
                        href={`/admin-dashboard/view-task/${task.task_id}`}
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Eye size={14} /> View
                      </a>
                      <a
                        href={`/admin-dashboard/followup_task/${task.task_id}`}
                        className="text-green-600 hover:underline flex items-center gap-1"
                      >
                        <PenLine size={14} /> Follow
                      </a>
                      <button
                        onClick={() => openReassign(task)}
                        className="flex items-center gap-1 text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1 rounded-md text-xs cursor-pointer"
                      >
                        <Repeat size={14} /> Reassign
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="px-4 py-6 text-center text-gray-500">
                  No tasks match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 📱 Card View (Mobile and Small Screens) */}
      <div className="md:hidden">
        {filteredTasks.length > 0 ? (
          <div className="grid gap-4">
            {filteredTasks.map((task) => (
              <div
                key={task.task_id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="font-semibold text-gray-800 text-base">
                    {task.taskname}
                  </div>
                  <span
                    className={`inline-block px-2 py-1 text-xs font-semibold text-white rounded-full ${getStatusColor(
                      task.status
                    )}`}
                  >
                    {task.status}
                  </span>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-gray-500" />
                    <span>
                      <strong className="text-gray-700">Assigned By:</strong>{" "}
                      {task.createdby || "-"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarDays size={16} className="text-gray-500" />
                    <span>
                      <strong className="text-gray-700">Assigned:</strong>{" "}
                      {dayjs(task.followed_date).format("DD MMM, YYYY hh:mm A")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-gray-500" />
                    <span>
                      <strong className="text-gray-700">Deadline:</strong>{" "}
                      {task.next_followup_date
                        ? dayjs(task.next_followup_date).format(
                            "DD MMM, YYYY hh:mm A"
                          )
                        : "Not set"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2 mt-4 border-t pt-3">
                  <a
                    href={`/admin-dashboard/view-task/${task.task_id}`}
                    className="flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <Eye size={14} /> View
                  </a>
                  <a
                    href={`/admin-dashboard/followup_task/${task.task_id}`}
                    className="flex items-center gap-1 text-green-600 hover:underline"
                  >
                    <PenLine size={14} /> Follow
                  </a>
                  <button
                    onClick={() => openReassign(task)}
                    className="flex items-center gap-1 text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1 rounded-md text-xs"
                  >
                    <Repeat size={14} /> Reassign
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-6 text-center text-gray-500 rounded-xl border border-gray-200 shadow-sm bg-white">
            No tasks match your search.
          </div>
        )}
      </div>

      <ReassignModal open={isModalOpen} onClose={closeModal} task={modalTask} />
    </div>
  );
};

export default TaskTable;
