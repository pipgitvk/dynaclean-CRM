// src/components/ClientTaskTable.jsx
"use client";

import { useState, useEffect } from "react";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

export default function ClientTaskTable({ initialTasks }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assignedToFilter, setAssignedToFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortBy, setSortBy] = useState("task_id");
  const [sortOrder, setSortOrder] = useState("desc");
  const [filteredTasks, setFilteredTasks] = useState(initialTasks);

  useEffect(() => {
    let filtered = initialTasks.filter((task) => {
      // Search filter
      const matchesSearch = !search || 
        (task.taskname?.toLowerCase() || "").includes(search.toLowerCase()) ||
        (task.taskassignto?.toLowerCase() || "").includes(search.toLowerCase()) ||
        (task.createdby?.toLowerCase() || "").includes(search.toLowerCase()) ||
        (task.status?.toLowerCase() || "").includes(search.toLowerCase()) ||
        (task.first_assignto?.toLowerCase() || "").includes(search.toLowerCase());
      
      // Status filter
      const matchesStatus = !statusFilter || task.status === statusFilter;
      
      // Assigned To filter (check taskassignto, first_assignto, AND reassign)
      const matchesAssignedTo = !assignedToFilter || 
        task.taskassignto === assignedToFilter || 
        task.first_assignto === assignedToFilter ||
        task.reassign === assignedToFilter;
      
      // Date range filter
      let matchesDateRange = true;
      if (fromDate || toDate) {
        const assignDate = task.followed_date ? dayjs(task.followed_date) : null;
        if (assignDate && assignDate.isValid()) {
          if (fromDate && toDate) {
            matchesDateRange = assignDate.isSameOrAfter(dayjs(fromDate), 'day') && 
                              assignDate.isSameOrBefore(dayjs(toDate), 'day');
          } else if (fromDate) {
            matchesDateRange = assignDate.isSameOrAfter(dayjs(fromDate), 'day');
          } else if (toDate) {
            matchesDateRange = assignDate.isSameOrBefore(dayjs(toDate), 'day');
          }
        } else if (fromDate || toDate) {
          matchesDateRange = false; // Exclude tasks without valid date when date filter is active
        }
      }
      
      return matchesSearch && matchesStatus && matchesAssignedTo && matchesDateRange;
    });

    // Sorting
    filtered.sort((a, b) => {
      let aVal, bVal;
      
      switch(sortBy) {
        case 'taskname':
          aVal = (a.taskname || '').toLowerCase();
          bVal = (b.taskname || '').toLowerCase();
          break;
        case 'status':
          aVal = (a.status || '').toLowerCase();
          bVal = (b.status || '').toLowerCase();
          break;
        case 'deadline':
          aVal = a.next_followup_date ? dayjs(a.next_followup_date).unix() : 0;
          bVal = b.next_followup_date ? dayjs(b.next_followup_date).unix() : 0;
          break;
        case 'assignedTo':
          aVal = (a.first_assignto || a.taskassignto || '').toLowerCase();
          bVal = (b.first_assignto || b.taskassignto || '').toLowerCase();
          break;
        default: // task_id
          aVal = a.task_id;
          bVal = b.task_id;
      }
      
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredTasks(filtered);
  }, [search, statusFilter, assignedToFilter, fromDate, toDate, sortBy, sortOrder, initialTasks]);

  // Calculate KPIs
  const today = dayjs().startOf("day");
  const totalTasks = filteredTasks.length;
  const pendingTasks = filteredTasks.filter(task => task.status === "Pending").length;
  const completedTasks = filteredTasks.filter(task => task.status === "Completed").length;
  const workingTasks = filteredTasks.filter(task => task.status === "Working").length;
  const delayedTasks = filteredTasks.filter(task => {
    const deadline = dayjs(task.next_followup_date).startOf("day");
    return task.status !== "Completed" && today.isAfter(deadline);
  }).length;

  // Get unique assignees for filter (from all assignment columns)
  const uniqueAssignees = [...new Set(
    initialTasks.flatMap(task => [
      task.first_assignto,
      task.taskassignto,
      task.reassign
    ]).filter(Boolean)
  )].sort();

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("");
    setAssignedToFilter("");
    setFromDate("");
    setToDate("");
  };

  const getTableRowColor = (task) => {
    const today = dayjs().startOf("day");
    const deadline = dayjs(task.next_followup_date).startOf("day");
    const completionDate = task.task_completion_date
      ? dayjs(task.task_completion_date).startOf("day")
      : null;

    if (task.status === "Working") {
      return "bg-blue-100";
    }

    if (
      task.status === "Completed" &&
      completionDate &&
      completionDate.isAfter(deadline)
    ) {
      return "bg-orange-100";
    }

    if (task.status !== "Completed" && today.isAfter(deadline)) {
      return "bg-red-100";
    }

    if (
      task.status === "Completed" &&
      completionDate &&
      (completionDate.isSameOrBefore(deadline) || !deadline.isValid())
    ) {
      return "bg-green-100";
    }

    return "bg-white";
  };

  const colors = [
    {
      color: "bg-green-500",
      label: "Task completed on or before the deadline.",
    },
    {
      color: "bg-orange-500",
      label: "Task completed, but after the deadline.",
    },
    {
      color: "bg-red-500",
      label: "Task is pending and the deadline has been missed.",
    },
    { color: "bg-blue-500", label: "Task is currently in progress." },
    {
      color: "bg-gray-300",
      label: "Task is pending and the deadline has not passed.",
    },
  ];

  return (
    <>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
          <div className="text-sm text-gray-600">Total Tasks</div>
          <div className="text-2xl font-bold text-blue-700">{totalTasks}</div>
        </div>
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
          <div className="text-sm text-gray-600">Pending</div>
          <div className="text-2xl font-bold text-yellow-700">{pendingTasks}</div>
        </div>
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
          <div className="text-sm text-gray-600">Completed</div>
          <div className="text-2xl font-bold text-green-700">{completedTasks}</div>
        </div>
        <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded">
          <div className="text-sm text-gray-600">Working</div>
          <div className="text-2xl font-bold text-purple-700">{workingTasks}</div>
        </div>
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <div className="text-sm text-gray-600">Delayed</div>
          <div className="text-2xl font-bold text-red-700">{delayedTasks}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-gray-50 p-4 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              placeholder="🔍 Search..."
              className="border p-2 rounded-md w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              className="border p-2 rounded-md w-full"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Working">Working</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
            <select
              className="border p-2 rounded-md w-full"
              value={assignedToFilter}
              onChange={(e) => setAssignedToFilter(e.target.value)}
            >
              <option value="">All Assignees</option>
              {uniqueAssignees.map(assignee => (
                <option key={assignee} value={assignee}>{assignee}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              className="border p-2 rounded-md w-full"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              className="border p-2 rounded-md w-full"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={resetFilters}
              className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 w-full"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Sleek Color Key */}
      <div className="mb-4 flex items-center gap-4 text-sm">
        <span className="font-semibold">Color Key:</span>
        {colors.map((item, index) => (
          <div key={index} className="relative group">
            <div
              className={`w-4 h-4 rounded-full ${item.color} shadow-sm cursor-help`}
              title={item.label}
            ></div>
            <span
              className="absolute bottom-6 left-1/2 -translate-x-1/2 scale-0 
              transition-all duration-300 ease-in-out 
              group-hover:scale-100 
              bg-gray-800 text-white text-xs rounded-lg 
              py-1 px-2 whitespace-nowrap opacity-0 group-hover:opacity-100"
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Table Wrapper */}
      <div className="overflow-x-auto rounded-lg shadow">
        <table className="min-w-full hidden md:table bg-white text-sm text-gray-700">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th 
                className="px-4 py-2 cursor-pointer hover:bg-gray-200"
                onClick={() => handleSort('task_id')}
              >
                Task ID {sortBy === 'task_id' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-4 py-2 cursor-pointer hover:bg-gray-200"
                onClick={() => handleSort('taskname')}
              >
                Task Name {sortBy === 'taskname' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-4 py-2">Created By</th>
              <th 
                className="px-4 py-2 cursor-pointer hover:bg-gray-200"
                onClick={() => handleSort('assignedTo')}
              >
                Assigned To {sortBy === 'assignedTo' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-4 py-2">Reassigned</th>
              <th className="px-4 py-2">Assign Date</th>
              <th 
                className="px-4 py-2 cursor-pointer hover:bg-gray-200"
                onClick={() => handleSort('deadline')}
              >
                Deadline {sortBy === 'deadline' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-4 py-2 cursor-pointer hover:bg-gray-200"
                onClick={() => handleSort('status')}
              >
                Status {sortBy === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-4 py-2">Completion</th>
              <th className="px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task) => (
                <tr
                  key={task.task_id}
                  className={`border-t ${getTableRowColor(task)}`}
                >
                  <td className="px-4 py-2">{task.task_id}</td>
                  <td className="px-4 py-2">{task.taskname}</td>
                  <td className="px-4 py-2">{task.createdby}</td>
                  <td className="px-4 py-2">{task.first_assignto}</td>
                  <td className="px-4 py-2">{task.reassign}</td>
                  <td className="px-4 py-2">
                    {task.followed_date
                      ? dayjs(task.followed_date).format("DD/MM/YYYY")
                      : "-"}
                  </td>
                  <td className="px-4 py-2">
                    {task.next_followup_date
                      ? dayjs(task.next_followup_date).format("DD/MM/YYYY")
                      : "-"}
                  </td>
                  <td className="px-4 py-2">{task.status}</td>
                  <td className="px-4 py-2">
                    {task.task_completion_date
                      ? dayjs(task.task_completion_date).format("DD/MM/YYYY")
                      : "-"}
                  </td>
                  <td className="px-4 py-2">
                    <a
                      href={`/user-dashboard/view-task/${task.task_id}`}
                      className="text-blue-600 hover:underline"
                    >
                      View
                    </a>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="10"
                  className="text-center px-4 py-6 text-gray-500"
                >
                  No tasks found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Mobile view cards */}
        <div className="md:hidden space-y-4 p-2">
          {filteredTasks.length > 0 ? (
            filteredTasks.map((task) => (
              <div
                key={task.task_id}
                className={`border rounded-lg p-4 shadow-sm ${getTableRowColor(
                  task
                )}`}
              >
                <div className="text-sm mb-2">
                  <strong>Task ID:</strong> {task.task_id}
                </div>
                <div className="text-sm mb-2">
                  <strong>Task Name:</strong> {task.taskname}
                </div>
                <div className="text-sm mb-2">
                  <strong>Created By:</strong> {task.createdby}
                </div>
                <div className="text-sm mb-2">
                  <strong>Assigned To:</strong> {task.first_assignto}
                </div>
                <div className="text-sm mb-2">
                  <strong>Reassigned:</strong> {task.reassign}
                </div>
                <div className="text-sm mb-2">
                  <strong>Assign Date:</strong>{" "}
                  {task.followed_date
                    ? dayjs(task.followed_date).format("DD/MM/YYYY")
                    : "-"}
                </div>
                <div className="text-sm mb-2">
                  <strong>Deadline:</strong>{" "}
                  {task.next_followup_date
                    ? dayjs(task.next_followup_date).format("DD/MM/YYYY")
                    : "-"}
                </div>
                <div className="text-sm mb-2">
                  <strong>Status:</strong> {task.status}
                </div>
                <div className="text-sm mb-2">
                  <strong>Completion:</strong>{" "}
                  {task.task_completion_date
                    ? dayjs(task.task_completion_date).format("DD/MM/YYYY")
                    : "-"}
                </div>
                <div className="text-sm mt-2">
                  <a
                    href={`/user-dashboard/view-task/${task.task_id}`}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    View Task →
                  </a>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-gray-500 py-6">
              No tasks found.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
