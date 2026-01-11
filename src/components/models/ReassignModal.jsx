"use client";
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function ReassignModal({ open, onClose, task }) {
  const [newAssignee, setNewAssignee] = useState(""); // Stores selected user's username
  const [options, setOptions] = useState([]); // Stores users fetched from API
  const [searchQuery, setSearchQuery] = useState(""); // Holds the search input
  const [loading, setLoading] = useState(false); // To manage loading state

  const router = useRouter();

  // API request to fetch users
  const fetchUsers = async (query) => {
    if (!query) {
      setOptions([]); // Clear options if query is empty
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/reassignresp?search=${query}`);
      const data = await res.json();
      if (res.ok) {
        setOptions(data.users || []); // Update the options list with users (safe fallback)
      } else {
        toast.error(data.error || "Failed to load users");
        setOptions([]); // Clear options on error
      }
    } catch (error) {
      toast.error("Network error");
      console.error(error);
      setOptions([]); // Clear options on network error
    } finally {
      setLoading(false); // Turn off loading once the request completes
    }
  };

  // Handle input change (search for users)
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value); // Update search query
    setNewAssignee(""); // Clear newAssignee when typing starts
  };

  // Handle selection from dropdown
  const handleSelectAssignee = (username) => {
    setNewAssignee(username); // Set the selected username for submission
    setSearchQuery(username); // Autofill the input field with the selected username
    setOptions([]); // Clear options after selection to hide the dropdown
  };

  // UseEffect to fetch users whenever searchQuery changes
  useEffect(() => {
    // Only fetch if searchQuery is not empty and not identical to newAssignee (meaning a selection has been made)
    if (searchQuery && searchQuery !== newAssignee) {
      const timeoutId = setTimeout(() => {
        fetchUsers(searchQuery); // Fetch users after typing stops for 500ms (debounce)
      }, 500);

      return () => clearTimeout(timeoutId); // Cleanup timeout if component unmounts or query changes
    } else if (!searchQuery) {
      setOptions([]); // Clear options immediately if search query is empty
    }
  }, [searchQuery, newAssignee]); // Add newAssignee to dependencies to prevent fetching after selection

  if (!open || !task) return null;

  const handleSubmit = async () => {
    if (!newAssignee) return toast.warn("Please select a user to reassign.");
    try {
      const res = await fetch(`/api/tasks/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: task.task_id, newAssignee }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        router.refresh();
        onClose(true); // Close the modal with success
      } else {
        toast.error(data.error || "Something went wrong");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center  bg-opacity-50">
      <div className="bg-white rounded-lg w-full max-w-md p-6 border border-gray-300 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Reassign Task</h2>
          <button
            onClick={() => onClose(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 font-medium">
              Task Name:
            </label>
            <p className="text-sm text-gray-500 mt-1">{task.taskname}</p>
          </div>

          <div className="relative">
            {" "}
            {/* Use relative positioning for dropdown */}
            <label
              htmlFor="newAssigneeInput"
              className="block text-sm text-gray-700 font-medium"
            >
              New Assignee:
            </label>
            <input
              id="newAssigneeInput"
              type="text"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Search for a user..."
              value={searchQuery} // Bind input value to searchQuery
              onChange={handleSearchChange}
              autoComplete="off" // Disable browser autocomplete
            />
            {/* Dropdown list for showing results */}
            {loading && (
              <div className="mt-2 text-gray-500 text-sm">Loading users...</div>
            )}
            {!loading &&
              searchQuery &&
              Array.isArray(options) &&
              options.length > 0 && (
                <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg">
                  {options.map((rep, index) => (
                    <li
                      key={index}
                      className="p-3 cursor-pointer hover:bg-blue-50 hover:text-blue-700 transition-colors duration-200 text-sm"
                      onClick={() => handleSelectAssignee(rep.username)} // Call handler for selection
                    >
                      {rep.username}
                    </li>
                  ))}
                </ul>
              )}
            {!loading &&
              searchQuery &&
              Array.isArray(options) &&
              options.length === 0 && (
                <div className="mt-2 text-gray-500 text-sm">
                  No users found for "{searchQuery}"
                </div>
              )}
          </div>

          <button
            onClick={handleSubmit}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200"
          >
            Reassign Task
          </button>
        </div>
      </div>
    </div>
  );
}
