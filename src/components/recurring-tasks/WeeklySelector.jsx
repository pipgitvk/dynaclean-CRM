"use client";

export default function WeeklySelector({ value = [], onChange }) {
  const toggleDay = (day) => {
    const newDays = value.includes(day)
      ? value.filter((d) => d !== day)
      : [...value, day];
    onChange(newDays);
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Select Weekdays
      </label>
      <div className="grid grid-cols-4 gap-2">
        {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map(
          (day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                value.includes(day)
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
              }`}
            >
              {day.charAt(0).toUpperCase() + day.slice(1)}
            </button>
          )
        )}
      </div>
      {value.length === 0 && (
        <p className="text-xs text-gray-500">Select at least one weekday</p>
      )}
    </div>
  );
}
