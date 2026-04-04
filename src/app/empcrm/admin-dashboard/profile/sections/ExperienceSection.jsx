import { Plus, Trash2 } from "lucide-react";
import { shouldShowExperienceColumn } from "@/lib/reassignFieldVisibility";

export default function ExperienceSection({
  experience,
  setExperience,
  reviewMode = false,
  /** Nested under Banking Details: compact title and panel styling. */
  embedded = false,
  reassignFieldKeys = null,
}) {
  const ro = reviewMode;
  const rf = reassignFieldKeys;
  const col = (k) => shouldShowExperienceColumn(rf, k);
  const addExperience = () => {
    if (ro) return;
    setExperience([...experience, { company_name: "", designation: "", gross_salary_ctc: "", period_from: "", period_to: "", reason_for_leaving: "" }]);
  };

  const removeExperience = (index) => {
    if (ro) return;
    setExperience(experience.filter((_, i) => i !== index));
  };

  const updateExperience = (index, field, value) => {
    if (ro) return;
    const updated = [...experience];
    updated[index][field] = value;
    setExperience(updated);
  };

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const inactive = (cls) => (ro ? `${cls} bg-gray-50 cursor-not-allowed` : cls);

  const rowPanel = embedded
    ? "bg-white/90 border border-amber-100 rounded-lg"
    : "bg-gray-50 rounded-lg";

  return (
    <div className={embedded ? "space-y-3" : "border-b pb-6"}>
      <div className="flex justify-between items-center gap-3 flex-wrap mb-1">
        {embedded ? (
          <h4 className="text-sm font-semibold text-gray-800">Work experience</h4>
        ) : (
          <h3 className="text-lg font-semibold text-gray-800">Work Experience</h3>
        )}
        {!ro && (
          <button
            type="button"
            onClick={addExperience}
            className={`flex items-center gap-2 text-blue-600 hover:text-blue-800 ${
              embedded ? "text-sm font-medium" : ""
            }`}
          >
            <Plus className="w-4 h-4" /> Add Experience
          </button>
        )}
      </div>
      {experience.length === 0 && (
        <p
          className={
            embedded
              ? "text-amber-900/80 bg-amber-50/80 border border-amber-100 rounded-lg px-4 py-3 text-sm text-center"
              : "text-gray-500 text-center py-4"
          }
        >
          No experience added. Click &quot;Add Experience&quot; to start.
        </p>
      )}
      {experience.map((exp, index) => (
        <div key={index} className={`grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 relative ${rowPanel}`}>
          {experience.length > 1 && !ro && (
            <button type="button" onClick={() => removeExperience(index)} className="absolute top-2 right-2 text-red-600">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {col("experience_company_name") && (
            <div>
              <label className={labelClass}>Company Name</label>
              <input
                type="text"
                value={exp.company_name}
                onChange={(e) => updateExperience(index, "company_name", e.target.value)}
                readOnly={ro}
                className={inactive(inputClass)}
              />
            </div>
          )}
          {col("experience_designation") && (
            <div>
              <label className={labelClass}>Designation</label>
              <input
                type="text"
                value={exp.designation}
                onChange={(e) => updateExperience(index, "designation", e.target.value)}
                readOnly={ro}
                className={inactive(inputClass)}
              />
            </div>
          )}
          {col("experience_gross_salary_ctc") && (
            <div>
              <label className={labelClass}>Gross Salary (CTC)</label>
              <input
                type="number"
                value={exp.gross_salary_ctc}
                onChange={(e) => updateExperience(index, "gross_salary_ctc", e.target.value)}
                readOnly={ro}
                className={inactive(inputClass)}
              />
            </div>
          )}
          {col("experience_period_from") && (
            <div>
              <label className={labelClass}>Period From</label>
              <input
                type="date"
                value={exp.period_from}
                onChange={(e) => updateExperience(index, "period_from", e.target.value)}
                disabled={ro}
                className={inactive(inputClass)}
              />
            </div>
          )}
          {col("experience_period_to") && (
            <div>
              <label className={labelClass}>Period To</label>
              <input
                type="date"
                value={exp.period_to}
                onChange={(e) => updateExperience(index, "period_to", e.target.value)}
                disabled={ro}
                className={inactive(inputClass)}
              />
            </div>
          )}
          {col("experience_reason_for_leaving") && (
            <div className="md:col-span-3">
              <label className={labelClass}>Reason for Leaving *</label>
              <textarea
                value={exp.reason_for_leaving}
                onChange={(e) => updateExperience(index, "reason_for_leaving", e.target.value)}
                rows="2"
                readOnly={ro}
                required={!ro}
                className={inactive(inputClass)}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
