"use client";

import { useState } from "react";
import { Save, X } from "lucide-react";
import toast from "react-hot-toast";
import WeeklySelector from "./WeeklySelector";
import MonthlySelector from "./MonthlySelector";
import YearlySelector from "./YearlySelector";

export default function RecurringTaskForm({ onSuccess, initialData = null }) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    task_title: initialData?.task_title || "",
    description: initialData?.description || "",
    assigned_user_id: initialData?.assigned_user_id || "",
    recurrence_type: initialData?.recurrence_type || "daily",
    repeat_interval: initialData?.repeat_interval || 1,
    weekly_days: initialData?.weekly_days ? JSON.parse(initialData.weekly_days) : [],
    monthly_date: initialData?.monthly_date || 1,
    yearly_month: initialData?.yearly_month || 1,
    yearly_date: initialData?.yearly_date || 1,
    start_date: initialData?.start_date || "",
    end_date: initialData?.end_date || "",
    due_date: initialData?.due_date || "",
    status: initialData?.status || "active",
    is_active: initialData?.is_active !== undefined ? initialData.is_active : true,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const url = initialData
        ? `/api/recurring-tasks/${initialData.id}`
        : "/api/recurring-tasks";
      const method = initialData ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await res.json();
      if (result.success) {
        toast.success(
          initialData
            ? "Recurring task updated successfully"
            : "Recurring task created successfully"
        );
        onSuccess?.();
      } else {
        toast.error(result.error || "Failed to save recurring task");
      }
    } catch (error) {
      console.error("Error saving recurring task:", error);
      toast.error("Error saving recurring task");
    } finally {
      setIsLoading(false);
    }
  };

  const renderRecurrenceOptions = () => {
    switch (formData.recurrence_type) {
      case "daily":
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Repeat Every
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                name="repeat_interval"
                value={formData.repeat_interval}
                onChange={handleChange}
                min="1"
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">day(s)</span>
            </div>
          </div>
        );

      case "weekly":
        return (
          <div className="space-y-4">
            <WeeklySelector
              value={formData.weekly_days}
              onChange={(days) =>
                setFormData((prev) => ({ ...prev, weekly_days: days }))
              }
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Repeat Every
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  name="repeat_interval"
                  value={formData.repeat_interval}
                  onChange={handleChange}
                  min="1"
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">week(s)</span>
              </div>
            </div>
          </div>
        );

      case "monthly":
        return (
          <div className="space-y-4">
            <MonthlySelector
              value={formData.monthly_date}
              onChange={(date) =>
                setFormData((prev) => ({ ...prev, monthly_date: date }))
              }
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Repeat Every
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  name="repeat_interval"
                  value={formData.repeat_interval}
                  onChange={handleChange}
                  min="1"
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">month(s)</span>
              </div>
            </div>
          </div>
        );

      case "yearly":
        return (
          <div className="space-y-4">
            <YearlySelector
              month={formData.yearly_month}
              date={formData.yearly_date}
              onMonthChange={(month) =>
                setFormData((prev) => ({ ...prev, yearly_month: month }))
              }
              onDateChange={(date) =>
                setFormData((prev) => ({ ...prev, yearly_date: date }))
              }
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Repeat Every
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  name="repeat_interval"
                  value={formData.repeat_interval}
                  onChange={handleChange}
                  min="1"
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">year(s)</span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Task Title *
          </label>
          <input
            type="text"
            name="task_title"
            value={formData.task_title}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Enter task title"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows="3"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Enter task description"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Assigned User ID *
          </label>
          <input
            type="number"
            name="assigned_user_id"
            value={formData.assigned_user_id}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Enter user ID"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Recurrence Type *
          </label>
          <select
            name="recurrence_type"
            value={formData.recurrence_type}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        <div className="md:col-span-2">{renderRecurrenceOptions()}</div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Start Date *
          </label>
          <input
            type="datetime-local"
            name="start_date"
            value={formData.start_date}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            End Date (Optional)
          </label>
          <input
            type="datetime-local"
            name="end_date"
            value={formData.end_date}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Due Date *
          </label>
          <input
            type="datetime-local"
            name="due_date"
            value={formData.due_date}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            name="is_active"
            id="is_active"
            checked={formData.is_active}
            onChange={handleChange}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
            Active
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onSuccess}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isLoading ? "Saving..." : initialData ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}
