"use client";

export default function OrderPoDateField({ value, onChange, className = "" }) {
  return (
    <div>
      <label className="block font-medium mb-1">Order Date / PO Date *</label>
      <input
        type="date"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3 py-2 border rounded bg-white ${className}`}
      />
    </div>
  );
}
