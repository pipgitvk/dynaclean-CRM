"use client";

import { useState, useEffect } from "react";

export default function AssignModal({ asset, onClose }) {
  const [users, setUsers] = useState([]);
  const [adminAccountantUsers, setAdminAccountantUsers] = useState([]);
  const [formData, setFormData] = useState({
    Assigned_to: "",
    Assigned_by: "",
  });

  useEffect(() => {
    async function fetchUsers() {
      try {
        const response = await fetch("/api/assets/users"); // Updated to use /api/users endpoint
        const data = await response.json();

        setUsers(data.users); // All users for Assigned_to
        setAdminAccountantUsers(data.adminAccountantUsers); // Users for Assigned_by
      } catch (error) {
        console.error("Failed to fetch users:", error);
      }
    }
    fetchUsers();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`/api/assets/${asset.asset_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, action: "assign" }),
      });
      if (!response.ok) throw new Error("Failed to assign asset.");
      onClose(); // Close modal on success
      alert("Asset assigned successfully!");
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred. Please try again.");
    }
  };

  return (
    <div>
      <h3 className="text-xl font-bold mb-4 text-gray-800">Assign Asset</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Assigned To
          </label>
          <select
            name="Assigned_to"
            value={formData.Assigned_to}
            onChange={handleChange}
            required
            className="mt-1 p-2 w-full border rounded-md"
          >
            <option value="">Select a user</option>
            {users.map((user, index) => (
              <option key={index} value={user.username}>
                {user.username}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Assigned By
          </label>
          <select
            name="Assigned_by"
            value={formData.Assigned_by}
            onChange={handleChange}
            required
            className="mt-1 p-2 w-full border rounded-md"
          >
            <option value="">Select a user</option>
            {adminAccountantUsers.map((user, index) => (
              <option key={index} value={user.username}>
                {user.username}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="w-full bg-green-600 text-white p-2 rounded-md hover:bg-green-700"
        >
          Assign
        </button>
      </form>
    </div>
  );
}
