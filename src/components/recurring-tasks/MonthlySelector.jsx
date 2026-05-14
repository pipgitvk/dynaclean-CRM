"use client";

export default function MonthlySelector({ value = 1, onChange }) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Day of Month
      </label>
      <select
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
      >
        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
          <option key={day} value={day}>
            {day}
          </option>
        ))}
      </select>
      <p className="text-xs text-gray-500">
        If the selected date doesn't exist in a month (e.g., 31st in February),
        the system will use the last valid day of that month.
      </p>
    </div>
  );
}
