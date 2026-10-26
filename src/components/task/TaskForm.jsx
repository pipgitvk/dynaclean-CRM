"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import AssignToInput from "@/components/AssigneInput/AssignToInput";

/** Current local time for `datetime-local` (minute precision). */
function nowDatetimeLocal() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}

/** Default deadline for one-off tasks: now + 2h. */
function defaultDeadlineLocal() {
  const d = new Date();
  d.setTime(d.getTime() + 2 * 60 * 60 * 1000);
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}

const initialFormData = () => {
  const now = nowDatetimeLocal();

  return {
    taskname: "",
    taskassignto: "",
    next_followup_date: defaultDeadlineLocal(),
    task_prior: "Medium",
    task_catg: "Software Development",
    notes: "",
    is_recurring: false,
    recurrence_type: "daily",
    repeat_interval: 1,
    weekly_days: [],
    monthly_date: 1,
    yearly_month: 1,
    yearly_date: 1,
    recurrence_start_date: now,
    recurrence_end_date: "",
  };
};

export default function TaskForm({ username }) {
  const router = useRouter();
  const [formData, setFormData] = useState(initialFormData);

  const [attachments, setAttachments] = useState([]); // images/docs (multiple)
  const [taskVideo, setTaskVideo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => {
      const next = {
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      };

      // Recurring: use current time (not +2h deadline default) and keep fields in sync
      if (name === "is_recurring" && checked) {
        const now = nowDatetimeLocal();
        next.next_followup_date = now;
        next.recurrence_start_date = now;
      }
      if (next.is_recurring) {
        if (name === "recurrence_start_date") {
          next.next_followup_date = value;
        }
        if (name === "next_followup_date") {
          next.recurrence_start_date = value;
        }
      }

      return next;
    });
  };

  const handleFileChange = (e, setter) => {
    setter(e.target.files[0]);
  };

  const handleMultiFiles = (e) => {
    const files = Array.from(e.target.files || []);
    setAttachments(files);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return; // prevent double submit
    setIsLoading(true);

    const body = new FormData();
    body.append("createdby", username);
    body.append(
      "todaydate",
      new Date().toISOString().slice(0, 19).replace("T", " ")
    );

    Object.entries(formData).forEach(([key, val]) => {
      if (key === "weekly_days" && Array.isArray(val)) {
        body.append(key, JSON.stringify(val));
      } else {
        body.append(key, val);
      }
    });

    // Append multiple attachments (images/docs)
    if (attachments && attachments.length) {
      attachments.forEach((f) => body.append("attachments", f));
    }
    if (taskVideo) body.append("task_video", taskVideo);

    try {
      const res = await fetch("/api/new-task", {
        method: "POST",
        body,
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.success(
          data.message ||
            (data.recurring_task_id
              ? `✅ Task created (ID ${data.task_id}). Recurring runs will continue automatically.`
              : "✅ Task added successfully")
        );
        router.push("/user-dashboard");
      } else if (res.status === 409) {
        const err = await res.json().catch(() => ({ error: "Duplicate task" }));
        toast.error(err.error || "A task with the same name and description already exists.");
      } else {
        const err = await res.json().catch(() => ({ error: "Failed to add task" }));
        toast.error(err.error || "❌ Failed to add task");
      }
    } catch (err) {
      console.error(err);
      toast.error("⚠️ Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 text-gray-600"
      encType="multipart/form-data"
    >
      <input type="hidden" name="createdby" value={username} />

      <div className="flex flex-wrap gap-4">
        <div className="flex-1">
          <label className="block font-semibold">Task Name</label>
          <input
            name="taskname"
            required
            value={formData.taskname}
            onChange={handleChange}
            className="input border border-gray-300 rounded-md p-2 w-full"
          />
        </div>

        <div className="flex-1">
          <label className="block font-semibold">Assign To</label>
          <AssignToInput
            value={formData.taskassignto}
            onChange={(val) =>
              setFormData((prev) => ({ ...prev, taskassignto: val }))
            }
          />
        </div>
      </div>

      {/* Deadline and Priority */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1">
          <label className="block font-semibold">
            {formData.is_recurring
              ? "Due date & time (each occurrence)"
              : "Deadline (Date & Time)"}
          </label>
          <input
            type="datetime-local"
            name="next_followup_date"
            required
            value={formData.next_followup_date}
            onChange={handleChange}
            className="input border border-gray-300 rounded-md p-2 w-full"
          />
          {formData.is_recurring && (
            <p className="text-xs text-gray-500 mt-1">
              First task saves now. Set this 1–2 minutes ahead to test — cron will create the
              second task at this time; after that, daily repeats continue.
            </p>
          )}
        </div>
        <div className="flex-1">
          <label className="block font-semibold">Priority</label>
          <select
            name="task_prior"
            required
            value={formData.task_prior}
            onChange={handleChange}
            className="input border border-gray-300 rounded-md p-2 w-full"
          >
            <option value="">Select</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </div>
      </div>

      {/* Category and Description */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1">
          <label className="block font-semibold">Category</label>
          <select
            name="task_catg"
            required
            value={formData.task_catg}
            onChange={handleChange}
            className="input border border-gray-300 rounded-md p-2 w-full"
          >
            <option value="">Select</option>
            <option value="Dispatch">Dispatch</option>
            <option value="Payment Collection">Payment Collection</option>
            <option value="Service">Service</option>
            <option value="Complaint">Complaint</option>
            <option value="Other General Task">Other General Task</option>
            <option value="Software Development">Software Development</option>
          </select>
        </div>

        <div className="flex-1">
          <label className="block font-semibold">Description</label>
          <textarea
            name="notes"
            required
            value={formData.notes}
            onChange={handleChange}
            className="input border border-gray-300 rounded-md p-2 w-full"
            rows={3}
          />
        </div>
      </div>

      {/* File Uploads */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1">
          <label className="block font-semibold">Upload Images/Docs (multiple, optional)</label>
          <input
            type="file"
            name="attachments"
            accept="image/*,.pdf,.doc,.docx"
            multiple
            onChange={handleMultiFiles}
            className="input border border-gray-300 rounded-md p-2 w-full"
          />
          {attachments?.length ? (
            <p className="text-xs text-gray-500 mt-1">{attachments.length} file(s) selected</p>
          ) : null}
        </div>

        <div className="flex-1">
          <label className="block font-semibold">Upload Video (optional)</label>
          <input
            type="file"
            name="task_video"
            accept="video/*"
            onChange={(e) => handleFileChange(e, setTaskVideo)}
            className="input border border-gray-300 rounded-md p-2 w-full"
          />
        </div>
      </div>

      {/* Recurrence Section */}
      <div className="border-t border-gray-200 pt-5">
        <div className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            name="is_recurring"
            id="is_recurring"
            checked={formData.is_recurring}
            onChange={handleChange}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="is_recurring" className="font-semibold text-gray-700">
            Make this a recurring task
          </label>
        </div>

        {formData.is_recurring && (
          <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1">
                <label className="block font-semibold mb-2">Recurrence Type</label>
                <select
                  name="recurrence_type"
                  value={formData.recurrence_type}
                  onChange={handleChange}
                  className="input border border-gray-300 rounded-md p-2 w-full"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block font-semibold mb-2">Repeat Every</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    name="repeat_interval"
                    value={formData.repeat_interval}
                    onChange={handleChange}
                    min="1"
                    className="input border border-gray-300 rounded-md p-2 w-24"
                  />
                  <span className="text-sm text-gray-600">
                    {formData.recurrence_type === "daily"
                      ? "day(s)"
                      : formData.recurrence_type === "weekly"
                      ? "week(s)"
                      : formData.recurrence_type === "monthly"
                      ? "month(s)"
                      : "year(s)"}
                  </span>
                </div>
              </div>
            </div>

            {formData.recurrence_type === "weekly" && (
              <div>
                <label className="block font-semibold mb-2">Select Weekdays</label>
                <div className="grid grid-cols-4 gap-2">
                  {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map(
                    (day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          const newDays = formData.weekly_days.includes(day)
                            ? formData.weekly_days.filter((d) => d !== day)
                            : [...formData.weekly_days, day];
                          setFormData((prev) => ({ ...prev, weekly_days: newDays }));
                        }}
                        className={`px-3 py-2 text-sm rounded-lg border ${
                          formData.weekly_days.includes(day)
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-gray-700 border-gray-300"
                        }`}
                      >
                        {day.charAt(0).toUpperCase() + day.slice(1)}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

            {formData.recurrence_type === "monthly" && (
              <div>
                <label className="block font-semibold mb-2">Day of Month</label>
                <select
                  name="monthly_date"
                  value={formData.monthly_date}
                  onChange={handleChange}
                  className="input border border-gray-300 rounded-md p-2 w-full"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formData.recurrence_type === "yearly" && (
              <div className="flex flex-wrap gap-4">
                <div className="flex-1">
                  <label className="block font-semibold mb-2">Month</label>
                  <select
                    name="yearly_month"
                    value={formData.yearly_month}
                    onChange={handleChange}
                    className="input border border-gray-300 rounded-md p-2 w-full"
                  >
                    {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(
                      (month, idx) => (
                        <option key={month} value={idx + 1}>
                          {month}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block font-semibold mb-2">Day</label>
                  <select
                    name="yearly_date"
                    value={formData.yearly_date}
                    onChange={handleChange}
                    className="input border border-gray-300 rounded-md p-2 w-full"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-4">
              <div className="flex-1">
                <label className="block font-semibold mb-2">
                  First run / series start
                </label>
                <input
                  type="datetime-local"
                  name="recurrence_start_date"
                  value={formData.recurrence_start_date}
                  onChange={handleChange}
                  className="input border border-gray-300 rounded-md p-2 w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Same time as due date above (kept in sync).
                </p>
              </div>
              <div className="flex-1">
                <label className="block font-semibold mb-2">End Date (Optional)</label>
                <input
                  type="datetime-local"
                  name="recurrence_end_date"
                  value={formData.recurrence_end_date}
                  onChange={handleChange}
                  className="input border border-gray-300 rounded-md p-2 w-full"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4">
        <button
          type="submit"
          disabled={isLoading}
          className={`bg-green-500 text-white px-6 py-2 rounded-md w-full sm:w-auto transition-all duration-200 ${
            isLoading ? "bg-green-300 cursor-wait pointer-events-none" : "hover:bg-green-700"
          }`}
        >
          {isLoading ? "Adding..." : "Add Task"}
        </button>
      </div>
    </form>
  );
}
