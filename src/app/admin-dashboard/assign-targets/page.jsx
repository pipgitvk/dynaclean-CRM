"use client";
import Link from "next/link";
import React, { useState, useEffect } from "react";

const TargetAssignForm = () => {
  const [formData, setFormData] = useState({
    username: "",
    target: "",
    target_start_date: "",
    target_end_date: "",
    created_by: "",
  });

  const [usernames, setUsernames] = useState([]);
  const [allUsernames, setAllUsernames] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const resUsers = await fetch("/api/target-usrname");
        if (!resUsers.ok) throw new Error("Failed to fetch usernames.");
        const users = await resUsers.json();
        setAllUsernames(users);
        setUsernames(users);

        const resPayload = await fetch("/api/me");
        if (resPayload.ok) {
          const me = await resPayload.json();
          setFormData((prev) => ({ ...prev, created_by: me.username }));
        }
      } catch (error) {
        setMessage("Error loading data. Try again later.");
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, []);

  // Fetch available users when dates change
  useEffect(() => {
    const fetchAvailableUsers = async () => {
      if (formData.target_start_date && formData.target_end_date) {
        try {
          const resUsers = await fetch(
            `/api/target-usrname?startDate=${formData.target_start_date}&endDate=${formData.target_end_date}`
          );
          if (!resUsers.ok) throw new Error("Failed to fetch available usernames.");
          const users = await resUsers.json();
          setUsernames(users);
          
          // Reset username if current selection is not available
          if (formData.username && !users.includes(formData.username)) {
            setFormData((prev) => ({ ...prev, username: "" }));
          }
        } catch (error) {
          console.error("Error fetching available users:", error);
        }
      } else {
        setUsernames(allUsernames);
      }
    };
    fetchAvailableUsers();
  }, [formData.target_start_date, formData.target_end_date]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("Submitting...");

    try {
      const response = await fetch("/api/assign-target", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage("Target assigned successfully! 🎯");
        setFormData({
          username: "",
          target: "",
          target_start_date: "",
          target_end_date: "",
          created_by: formData.created_by,
        });
      } else {
        setMessage(`Error: ${data.message || "Something went wrong."}`);
      }
    } catch (error) {
      setMessage("Network error. Please try again.");
      console.error("Submission error:", error);
    }
  };

  return (
    <div className="flex justify-center px-4 py-8 bg-gray-100 min-h-screen">
      <div className="p-8 rounded-xl shadow-2xl w-full max-w-lg">
        <h2 className="text-3xl font-extrabold mb-8 text-center text-gray-800">
          Assign Target
        </h2>

        {message && (
          <div
            className={`p-4 mb-6 rounded-lg text-sm text-center font-medium ${
              message.includes("successfully")
                ? "bg-green-600 text-white"
                : "bg-red-600 text-white"
            }`}
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">
              Start Date
            </label>
            <input
              type="date"
              name="target_start_date"
              value={formData.target_start_date}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-600 rounded-lg"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">
              End Date
            </label>
            <input
              type="date"
              name="target_end_date"
              value={formData.target_end_date}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-600 rounded-lg"
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">
              Username
            </label>
            <select
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              disabled={!formData.target_start_date || !formData.target_end_date}
              className="w-full px-4 py-3 border border-gray-800 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="" disabled>
                {!formData.target_start_date || !formData.target_end_date
                  ? "Please select dates first"
                  : usernames.length === 0
                  ? "No users available for this period"
                  : "Select user"}
              </option>
              {usernames.map((user) => (
                <option key={user} value={user}>
                  {user}
                </option>
              ))}
            </select>
            {formData.target_start_date && formData.target_end_date && usernames.length === 0 && (
              <p className="text-sm text-orange-600 mt-1">
                All users already have targets for this period.
              </p>
            )}
          </div>

          {/* Target */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">
              Target Amount
            </label>
            <input
              type="number"
              name="target"
              value={formData.target}
              onChange={handleChange}
              placeholder="Enter target amount"
              min="1"
              required
              className="w-full px-4 py-3 border border-gray-600 rounded-lg"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 rounded-lg text-lg font-bold text-white bg-gray-600 hover:bg-gray-700"
          >
            Assign Target
          </button>
        </form>

        <div className="w-full flex justify-center mt-6">
          <Link href="/admin-dashboard/monitor-targets">
            <span className="py-2 px-4 rounded-lg text-base font-bold text-white bg-gray-600 hover:bg-gray-700 cursor-pointer">
              View All Targets
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default TargetAssignForm;
