"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { DEFAULT_TASK_CATEGORIES } from "@/lib/taskCategories";

export default function TaskCategorySelect({
  value,
  onChange,
  required = false,
  className = "input border border-gray-300 rounded-md p-2 w-full",
}) {
  const [customCategories, setCustomCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCategory, setNewCategory] = useState("");
  const [adding, setAdding] = useState(false);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/task-categories");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to load categories");
      }
      setCustomCategories(data.custom || []);
    } catch (error) {
      toast.error(error.message || "Could not load custom categories");
      setCustomCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const customNames = useMemo(
    () => customCategories.map((item) => item.category_name),
    [customCategories],
  );

  const handleAddCategory = async () => {
    const trimmed = newCategory.trim().replace(/\s+/g, " ");
    if (!trimmed) {
      toast.error("Enter a category name");
      return;
    }

    setAdding(true);
    try {
      const res = await fetch("/api/task-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to add category");
      }

      const savedName = data.category?.category_name || trimmed;
      setCustomCategories((prev) => {
        if (prev.some((item) => item.category_name === savedName)) {
          return prev;
        }
        return [
          ...prev,
          {
            id: data.category?.id,
            category_name: savedName,
          },
        ].sort((a, b) => a.category_name.localeCompare(b.category_name));
      });
      onChange(savedName);
      setNewCategory("");
      toast.success("Custom category added");
    } catch (error) {
      toast.error(error.message || "Could not add category");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-2">
      <select
        name="task_catg"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
        disabled={loading}
      >
        <option value="">Select</option>
        <optgroup label="Default categories">
          {DEFAULT_TASK_CATEGORIES.map((category) => (
            <option key={`default-${category}`} value={category}>
              {category}
            </option>
          ))}
        </optgroup>
        {customNames.length > 0 && (
          <optgroup label="My custom categories">
            {customNames.map((category) => (
              <option key={`custom-${category}`} value={category}>
                {category}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          placeholder="Add custom category"
          maxLength={100}
          className="flex-1 min-w-[180px] border border-gray-300 rounded-md p-2 text-sm"
        />
        <button
          type="button"
          onClick={handleAddCategory}
          disabled={adding || !newCategory.trim()}
          className="px-3 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {adding ? "Adding..." : "Add"}
        </button>
      </div>
      <p className="text-xs text-gray-500">
        Custom categories are saved only for your account.
      </p>
    </div>
  );
}
