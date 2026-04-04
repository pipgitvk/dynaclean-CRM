import { Plus, Trash2 } from "lucide-react";
import {
  shouldShowEducationDataRows,
  shouldShowQualificationColumn,
} from "@/lib/reassignFieldVisibility";

export default function EducationSection({
  education,
  setEducation,
  reviewMode = false,
  /** Renders inside the same “Qualification Details” card (e.g. educational document uploads). */
  qualificationDocumentsSlot = null,
  reassignFieldKeys = null,
}) {
  const ro = reviewMode;
  const rf = reassignFieldKeys;
  const showRows = shouldShowEducationDataRows(rf);
  const col = (k) => shouldShowQualificationColumn(rf, k);
  const addEducation = () => {
    if (ro) return;
    setEducation([...education, { exam_name: "", board_university: "", year_of_passing: "", grade_percentage: "" }]);
  };

  const removeEducation = (index) => {
    if (ro) return;
    setEducation(education.filter((_, i) => i !== index));
  };

  const updateEducation = (index, field, value) => {
    if (ro) return;
    const updated = [...education];
    updated[index][field] = value;
    setEducation(updated);
  };

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const inactive = (cls) => (ro ? `${cls} bg-gray-50 cursor-not-allowed` : cls);

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/85 p-5 md:p-6 space-y-5 shadow-sm">
      <div className="flex justify-between items-center gap-3 flex-wrap pb-2 border-b border-emerald-200/80">
        <h3 className="text-lg font-semibold text-gray-800">
          Qualification Details <span className="text-red-500">*</span>
        </h3>
        {!ro && (
          <button type="button" onClick={addEducation} className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium">
            <Plus className="w-4 h-4" /> Add Education
          </button>
        )}
      </div>
      {showRows && education.length === 0 && (
        <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-center">
          At least one education entry is required. Click &quot;Add Education&quot; to add a row.
        </p>
      )}
      {showRows &&
        education.map((edu, index) => (
          <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 p-4 bg-white/90 border border-emerald-100 rounded-lg relative">
            {education.length > 1 && !ro && (
              <button type="button" onClick={() => removeEducation(index)} className="absolute top-2 right-2 text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            {col("qualification_exam_name") && (
              <div>
                <label className={labelClass}>Exam/Degree</label>
                <input
                  type="text"
                  value={edu.exam_name}
                  onChange={(e) => updateEducation(index, "exam_name", e.target.value)}
                  placeholder="e.g., B.Com"
                  readOnly={ro}
                  className={inactive(inputClass)}
                />
              </div>
            )}
            {col("qualification_board_university") && (
              <div>
                <label className={labelClass}>Board/University</label>
                <input
                  type="text"
                  value={edu.board_university}
                  onChange={(e) => updateEducation(index, "board_university", e.target.value)}
                  readOnly={ro}
                  className={inactive(inputClass)}
                />
              </div>
            )}
            {col("qualification_year_of_passing") && (
              <div>
                <label className={labelClass}>Year of Passing</label>
                <input
                  type="text"
                  value={edu.year_of_passing}
                  onChange={(e) => updateEducation(index, "year_of_passing", e.target.value)}
                  placeholder="2020"
                  readOnly={ro}
                  className={inactive(inputClass)}
                />
              </div>
            )}
            {col("qualification_grade_percentage") && (
              <div>
                <label className={labelClass}>Grade/Percentage</label>
                <input
                  type="text"
                  value={edu.grade_percentage}
                  onChange={(e) => updateEducation(index, "grade_percentage", e.target.value)}
                  placeholder="75%"
                  readOnly={ro}
                  className={inactive(inputClass)}
                />
              </div>
            )}
          </div>
        ))}

      {qualificationDocumentsSlot}
    </div>
  );
}
