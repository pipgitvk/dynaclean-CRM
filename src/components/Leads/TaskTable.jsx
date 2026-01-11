"use client";

import { useEffect, useState, useMemo } from "react";
import { Eye, PenLine, Repeat, Search } from "lucide-react";
import dayjs from "dayjs";

const TaskTable = ({ tasks = [] }) => {
  const [isClient, setIsClient] = useState(false);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    setIsClient(true);
  }, []);

  const filteredTasks = useMemo(() => {
    const keyword = search.toLowerCase();
    return tasks.filter((task) => {
      return (
        (task.createdby || "").toLowerCase().includes(keyword) ||
        (task.status || "").toLowerCase().includes(keyword) ||
        (task.stage || "").toLowerCase().includes(keyword) ||
        (task.first_name || "").toLowerCase().includes(keyword) ||
        (task.phone || "").toLowerCase().includes(keyword) ||
        (task.company || "").toLowerCase().includes(keyword)
      );
    });
  }, [search, tasks]);

  const totalPages = Math.ceil(filteredTasks.length / rowsPerPage);
  const currentTasks = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredTasks.slice(start, end);
  }, [currentPage, filteredTasks]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  if (!isClient) return null;

  return (
    <div className="mt-8">
      {/* 🔍 Search Box */}
      <div className="mb-4 flex items-center gap-2 px-2">
        <Search className="text-gray-500" size={18} />
        <input
          type="text"
          placeholder="Search by name, phone, or status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-4 py-2 border border-gray-300 text-amber-950 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
      </div>

      {/* 📋 Table View for large screens */}
      <div className="hidden lg:block overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 bg-white text-sm text-left text-black">
          <thead className="bg-gray-100 text-gray-700 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Next Follow-up</th>
              <th className="px-4 py-3">Followed Date</th>
              <th className="px-4 py-3">Last Note</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {currentTasks.length > 0 ? (
              currentTasks.map((task) => (
                <tr
                  key={`${task.customer_id}_${
                    task.next_followup_date || "noDate"
                  }`}
                  className="hover:bg-gray-50 transition"
                >
                  <td className="px-4 py-3">{task.customer_id}</td>
                  <td className="px-4 py-3">{task.first_name || "-"}</td>
                  <td className="px-4 py-3">{task.company || "-"}</td>
                  <td className="px-4 py-3">{task.phone || "-"}</td>
                  <td className="px-4 py-3">
                    {task.next_followup_date
                      ? dayjs(task.next_followup_date).format(
                          "DD MMM, YYYY hh:mm A"
                        )
                      : "Not set"}
                  </td>
                  <td className="px-4 py-3">
                    {task.followed_date
                      ? dayjs(task.followed_date).format("DD MMM, YYYY hh:mm A")
                      : "-"}
                  </td>
                  <td className="px-4 py-3">{task.notes || "-"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-1 text-xs font-semibold text-white rounded-full bg-yellow-500">
                      {task.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-1 text-xs font-semibold text-white rounded-full bg-blue-500">
                      {task.stage || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <a
                        href={`/user-dashboard/view-customer/${task.customer_id}`}
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Eye size={14} /> View
                      </a>
                      <a
                        href={`/user-dashboard/view-customer/${task.customer_id}/follow-up`}
                        className="text-green-600 hover:underline flex items-center gap-1"
                      >
                        <PenLine size={14} /> Follow
                      </a>
                      <a
                        href={`/user-dashboard/view-customer/${task.customer_id}/edit`}
                        className="flex items-center gap-1 text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1 rounded-md text-xs"
                      >
                        <Repeat size={14} /> Edit
                      </a>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="px-4 py-6 text-center text-gray-500">
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 📱 Card View for small screens */}
      <div className="lg:hidden space-y-4">
        {currentTasks.length > 0 ? (
          currentTasks.map((task) => (
            <div
              key={`${task.customer_id}_${task.next_followup_date || "noDate"}`}
              className="bg-white shadow border rounded-xl p-4 space-y-2"
            >
              <div className="font-medium text-gray-800">
                #{task.customer_id} - {task.first_name || "No Name"}
              </div>
              <div className="text-sm text-gray-600">
                <strong>Company:</strong> {task.company || "-"}
              </div>
              <div className="text-sm text-gray-600">
                <strong>Contact:</strong> {task.phone || "-"}
              </div>
              <div className="text-sm text-gray-600">
                <strong>Next Follow-up:</strong>{" "}
                {task.next_followup_date
                  ? dayjs(task.next_followup_date).format(
                      "DD MMM, YYYY hh:mm A"
                    )
                  : "Not set"}
              </div>
              <div className="text-sm text-gray-600">
                <strong>Followed Date:</strong>{" "}
                {task.followed_date
                  ? dayjs(task.followed_date).format("DD MMM, YYYY hh:mm A")
                  : "-"}
              </div>
              <div className="text-sm text-gray-600">
                <strong>Last Note:</strong> {task.notes || "-"}
              </div>
              <div className="text-sm space-x-2">
                <span className="inline-block mt-1 px-2 py-1 text-xs font-semibold text-white rounded-full bg-yellow-500">
                  {task.status}
                </span>
                <span className="inline-block mt-1 px-2 py-1 text-xs font-semibold text-white rounded-full bg-blue-500">
                  {task.stage || "-"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <a
                  href={`/user-dashboard/view-customer/${task.customer_id}`}
                  className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
                >
                  <Eye size={14} /> View
                </a>
                <a
                  href={`/user-dashboard/view-customer/${task.customer_id}/follow-up`}
                  className="text-green-600 hover:underline flex items-center gap-1 text-sm"
                >
                  <PenLine size={14} /> Follow
                </a>
                <a
                  href={`/user-dashboard/view-customer/${task.customer_id}/edit`}
                  className="flex items-center gap-1 text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1 rounded-md text-xs"
                >
                  <Repeat size={14} /> Edit
                </a>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500 italic">
            No customers found.
          </p>
        )}
      </div>

      {/* 📄 Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center items-center gap-2 text-sm flex-wrap">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          >
            Prev
          </button>

          {currentPage > 1 && (
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              {currentPage - 1}
            </button>
          )}

          <button
            className="px-3 py-1 rounded-md bg-blue-600 text-white font-medium"
            disabled
          >
            {currentPage}
          </button>

          {currentPage < totalPages && (
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              {currentPage + 1}
            </button>
          )}

          <button
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
            className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default TaskTable;
