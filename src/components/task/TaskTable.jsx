"use client";

import { useEffect, useState, useMemo } from "react";
import { CalendarDays, Eye, Repeat, PenLine, Search } from "lucide-react";
import dayjs from "dayjs";
import ReassignModal from "@/components/models/ReassignModal";
import toast from "react-hot-toast";

const TaskTable = ({ tasks = [] }) => {
  const [isClient, setIsClient] = useState(false);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTask, setModalTask] = useState(null); // Store the selected task here
  const [repList, setRepList] = useState([]); // Assume repList is populated via API

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Filter tasks based on search
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
    setModalTask(task); // Set the task when clicking "Reassign"
    setIsModalOpen(true); // Open the modal
  };

  const closeModal = (didUpdate = false) => {
    setIsModalOpen(false);
  };

  return (
    <div className="mt-8 p-4">
      {/* 🔍 Search Box */}
      <div className="mb-4 flex items-center gap-2">
        <Search className="text-gray-500" size={18} />
        <input
          type="text"
          placeholder="Search by task name, assigned by, or status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-4 py-2 border border-gray-300 text-amber-950 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
      </div>

      {/* 📋 Table - Visible on medium screens and larger */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm hidden md:block">
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
                    <span className="inline-block px-2 py-1 text-xs font-semibold text-white rounded-full bg-yellow-500">
                      {task.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <a
                        href={`/user-dashboard/view-task/${task.task_id}`}
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Eye size={14} /> View
                      </a>
                      <a
                        href={`/user-dashboard/followup_task/${task.task_id}`}
                        className="text-green-600 hover:underline flex items-center gap-1"
                      >
                        <PenLine size={14} /> Follow
                      </a>

                      <button
                        onClick={() => openReassign(task)} // Pass task here
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

      {/* 📄 Cards - Visible on small screens */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {filteredTasks.length > 0 ? (
          filteredTasks.map((task) => (
            <div
              key={task.task_id}
              className="bg-white p-4 rounded-lg shadow-md border border-gray-200"
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-lg text-gray-900">
                  {task.taskname}
                </h3>
                <span className="inline-block px-2 py-1 text-xs font-semibold text-white rounded-full bg-yellow-500">
                  {task.status}
                </span>
              </div>
              <p className="text-gray-700 text-sm mb-1">
                <strong className="font-medium">Assigned By:</strong>{" "}
                {task.createdby || "-"}
              </p>
              <p className="text-gray-700 text-sm mb-1">
                <strong className="font-medium">Assign Date:</strong>{" "}
                {dayjs(task.followed_date).format("DD MMM, YYYY hh:mm A")}
              </p>
              <p className="text-gray-700 text-sm mb-4">
                <strong className="font-medium">Deadline:</strong>{" "}
                {task.next_followup_date
                  ? dayjs(task.next_followup_date).format(
                      "DD MMM, YYYY hh:mm A"
                    )
                  : "Not set"}
              </p>
              <div className="flex flex-wrap gap-2 justify-start items-center">
                <a
                  href={`/user-dashboard/view-task/${task.task_id}`}
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline px-2 py-1 rounded transition text-xs font-semibold"
                >
                  <Eye size={14} /> View
                </a>
                <a
                  href={`/user-dashboard/followup_task/${task.task_id}`}
                  className="inline-flex items-center gap-1 text-green-600 hover:underline px-2 py-1 rounded transition text-xs font-semibold"
                >
                  <PenLine size={14} /> Follow
                </a>
                <button
                  onClick={() => openReassign(task)}
                  className="inline-flex items-center gap-1 text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1 rounded-md text-xs transition"
                >
                  <Repeat size={14} /> Reassign
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="p-4 text-center text-gray-500">
            No tasks match your search.
          </div>
        )}
      </div>

      {/* Pass the modal props here */}
      <ReassignModal open={isModalOpen} onClose={closeModal} task={modalTask} />
    </div>
  );
};

export default TaskTable;
