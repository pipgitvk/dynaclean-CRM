import { Plus, Trash2 } from "lucide-react";

export default function EducationSection({ education, setEducation }) {
  const addEducation = () => {
    setEducation([...education, { exam_name: "", board_university: "", year_of_passing: "", grade_percentage: "" }]);
  };

  const removeEducation = (index) => {
    setEducation(education.filter((_, i) => i !== index));
  };

  const updateEducation = (index, field, value) => {
    const updated = [...education];
    updated[index][field] = value;
    setEducation(updated);
  };

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="border-b pb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Education Qualifications</h3>
        <button type="button" onClick={addEducation} className="flex items-center gap-2 text-blue-600 hover:text-blue-800">
          <Plus className="w-4 h-4" /> Add Education
        </button>
      </div>
      {education.length === 0 && (
        <p className="text-gray-500 text-center py-4">No education added. Click "Add Education" to start.</p>
      )}
      {education.map((edu, index) => (
        <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg relative">
          {education.length > 1 && (
            <button type="button" onClick={() => removeEducation(index)} className="absolute top-2 right-2 text-red-600">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <div>
            <label className={labelClass}>Exam/Degree</label>
            <input type="text" value={edu.exam_name} onChange={(e) => updateEducation(index, "exam_name", e.target.value)} placeholder="e.g., B.Com" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Board/University</label>
            <input type="text" value={edu.board_university} onChange={(e) => updateEducation(index, "board_university", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Year of Passing</label>
            <input type="text" value={edu.year_of_passing} onChange={(e) => updateEducation(index, "year_of_passing", e.target.value)} placeholder="2020" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Grade/Percentage</label>
            <input type="text" value={edu.grade_percentage} onChange={(e) => updateEducation(index, "grade_percentage", e.target.value)} placeholder="75%" className={inputClass} />
          </div>
        </div>
      ))}
    </div>
  );
}
