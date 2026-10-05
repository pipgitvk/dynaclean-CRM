"use client";
import { useState, useEffect } from "react";

export default function AssetFormModal({ type, onClose }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    brand_name: "",
    model: "",
    other_accessories: "",
    asset_condition: "New",
    given_to: "",
    given_by: "",
    notes: "",
    status: "",
    password: "",
    is_return: false,
  });

  useEffect(() => {
    fetch("/api/reps")
      .then((res) => res.json())
      .then((data) => setUsers(data.users));
  }, []);

  const handleSubmit = async () => {
    const res = await fetch("/api/assets", {
      method: "POST",
      body: JSON.stringify({ ...form, type }),
    });
    const data = await res.json();
    if (data.success) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-xl max-w-2xl w-full space-y-4">
        <h3 className="text-xl font-bold mb-2">Add New {type}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input
            placeholder="Brand Name"
            onChange={(e) =>
              setForm((f) => ({ ...f, brand_name: e.target.value }))
            }
            className="input"
          />
          <input
            placeholder="Model"
            onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
            className="input"
          />
          <input
            placeholder="Other Accessories"
            onChange={(e) =>
              setForm((f) => ({ ...f, other_accessories: e.target.value }))
            }
            className="input"
          />
          <select
            onChange={(e) =>
              setForm((f) => ({ ...f, asset_condition: e.target.value }))
            }
            className="input"
          >
            <option>New</option>
            <option>Old</option>
          </select>
          <select
            onChange={(e) =>
              setForm((f) => ({ ...f, given_to: e.target.value }))
            }
            className="input"
          >
            <option value="">-- Given To --</option>
            {users.map((u) => (
              <option key={u.username}>{u.username}</option>
            ))}
          </select>
          <select
            onChange={(e) =>
              setForm((f) => ({ ...f, given_by: e.target.value }))
            }
            className="input"
          >
            <option value="">-- Given By --</option>
            {users.map((u) => (
              <option key={u.username}>{u.username}</option>
            ))}
          </select>
          <input
            placeholder="Status"
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            className="input"
          />
          <input
            placeholder="Password"
            onChange={(e) =>
              setForm((f) => ({ ...f, password: e.target.value }))
            }
            className="input"
          />
          <textarea
            placeholder="Notes"
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="input col-span-full"
          />
          <label className="col-span-full">
            <input
              type="checkbox"
              onChange={(e) =>
                setForm((f) => ({ ...f, is_return: e.target.checked }))
              }
            />
            <span className="ml-2">Is Return?</span>
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
