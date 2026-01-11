import { Plus, Trash2 } from "lucide-react";

export default function ExperienceSection({ experience, setExperience }) {
  const addExperience = () => {
    setExperience([...experience, { company_name: "", designation: "", gross_salary_ctc: "", period_from: "", period_to: "", reason_for_leaving: "" }]);
  };

  const removeExperience = (index) => {
    setExperience(experience.filter((_, i) => i !== index));
  };

  const updateExperience = (index, field, value) => {
    const updated = [...experience];
    updated[index][field] = value;
    setExperience(updated);
  };

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="border-b pb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Work Experience</h3>
        <button type="button" onClick={addExperience} className="flex items-center gap-2 text-blue-600 hover:text-blue-800">
          <Plus className="w-4 h-4" /> Add Experience
        </button>
      </div>
      {experience.length === 0 && (
        <p className="text-gray-500 text-center py-4">No experience added. Click "Add Experience" to start.</p>
      )}
      {experience.map((exp, index) => (
        <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg relative">
          {experience.length > 1 && (
            <button type="button" onClick={() => removeExperience(index)} className="absolute top-2 right-2 text-red-600">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <div>
            <label className={labelClass}>Company Name</label>
            <input type="text" value={exp.company_name} onChange={(e) => updateExperience(index, "company_name", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Designation</label>
            <input type="text" value={exp.designation} onChange={(e) => updateExperience(index, "designation", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Gross Salary (CTC)</label>
            <input type="number" value={exp.gross_salary_ctc} onChange={(e) => updateExperience(index, "gross_salary_ctc", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Period From</label>
            <input type="date" value={exp.period_from} onChange={(e) => updateExperience(index, "period_from", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Period To</label>
            <input type="date" value={exp.period_to} onChange={(e) => updateExperience(index, "period_to", e.target.value)} className={inputClass} />
          </div>
          <div className="md:col-span-3">
            <label className={labelClass}>Reason for Leaving</label>
            <textarea value={exp.reason_for_leaving} onChange={(e) => updateExperience(index, "reason_for_leaving", e.target.value)} rows="2" className={inputClass} />
          </div>
        </div>
      ))}
    </div>
  );
}
