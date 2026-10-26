"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Calendar, Filter } from "lucide-react";

export default function TaskFilterForm() {
  const [search, setSearch] = useState("");
  const [assignDate, setAssignDate] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [status, setStatus] = useState("");

  const router = useRouter();

  const handleSearch = (e) => {
    e.preventDefault();

    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (assignDate) params.append("assignDate", assignDate);
    if (deadlineDate) params.append("deadlineDate", deadlineDate);
    if (status) params.append("statusFilter", status);

    router.push(`/task-manager?${params.toString()}`);
  };

  return (
    <form
      onSubmit={handleSearch}
      className="bg-white p-4 rounded-lg shadow-md mb-6 space-y-4 md:space-y-0 md:flex md:items-end md:space-x-4"
    >
      <div className="flex flex-col w-full md:w-1/4">
        <label className="text-sm font-medium text-gray-600">
          Employee Name
        </label>
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded-md px-3 py-2"
        />
      </div>

      <div className="flex flex-col w-full md:w-1/4">
        <label className="text-sm font-medium text-gray-600">Assign Date</label>
        <input
          type="date"
          value={assignDate}
          onChange={(e) => setAssignDate(e.target.value)}
          className="border rounded-md px-3 py-2"
        />
      </div>

      <div className="flex flex-col w-full md:w-1/4">
        <label className="text-sm font-medium text-gray-600">
          Deadline Date
        </label>
        <input
          type="date"
          value={deadlineDate}
          onChange={(e) => setDeadlineDate(e.target.value)}
          className="border rounded-md px-3 py-2"
        />
      </div>

      <div className="flex flex-col w-full md:w-1/4">
        <label className="text-sm font-medium text-gray-600">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border rounded-md px-3 py-2"
        >
          <option value="">-- Select Status --</option>
          <option value="Completed">Completed</option>
          <option value="Working">Working</option>
          <option value="Pending">Pending</option>
        </select>
      </div>

      <button
        type="submit"
        className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"
      >
        <Search size={16} />
        Search
      </button>
    </form>
  );
}
