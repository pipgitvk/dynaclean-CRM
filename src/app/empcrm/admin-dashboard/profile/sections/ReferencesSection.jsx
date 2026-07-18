import { shouldShowReferenceColumn, isReassignFieldMode } from "@/lib/reassignFieldVisibility";
import { REFERENCE_COLUMN_KEYS } from "@/lib/profileReassignFields";

export default function ReferencesSection({ references, setReferences, reviewMode = false, reassignFieldKeys = null }) {
    const ro = reviewMode;
    const rf = reassignFieldKeys;

    // If ANY reference column is reassigned, show ALL columns (reassigned ones editable, others read-only for context)
    const anyRefColReassigned =
      isReassignFieldMode(rf) &&
      Array.from(REFERENCE_COLUMN_KEYS).some((k) => rf.includes(k));

    const col = (k) => {
      if (!isReassignFieldMode(rf)) return true;
      if (rf.includes("section_references")) return true;
      if (anyRefColReassigned) return true;
      return shouldShowReferenceColumn(rf, k);
    };

    // A column is editable when: not in reassign mode, full section reassigned, OR any reference column reassigned (full row editing)
    const colEditable = (k) => {
      if (!isReassignFieldMode(rf)) return !ro;
      if (ro) return false;
      if (rf.includes("section_references")) return true;
      // If any reference column is reassigned, make ALL columns editable for better UX
      if (anyRefColReassigned) return true;
      return rf.includes(k);
    };
    const addReference = () => {
        if (ro) return;
        setReferences([...references, { name: "", contact: "", address: "", relationship: "" }]);
    };

    const removeReference = (index) => {
        if (ro) return;
        setReferences(references.filter((_, i) => i !== index));
    };

    const handleChange = (index, field, value) => {
        if (ro) return;
        const updatedRef = [...references];
        updatedRef[index][field] = value;
        setReferences(updatedRef);
    };

    const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500";
    const labelClass = "block text-sm font-medium text-gray-700 mb-1";
    const inactive = (cls) => (ro ? `${cls} bg-gray-50 cursor-not-allowed` : cls);

    return (
        <div className="border-b pb-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                    Reference Verification Details (Minimum 3)
                </h3>
                {!ro && (
                    <button
                        type="button"
                        onClick={addReference}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                        + Add Reference
                    </button>
                )}
            </div>

            {references.map((ref, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 mb-4 bg-gray-50 rounded-lg border">
                    {col("reference_name") && (
                    <div>
                        <label className={labelClass}>Reference Name *</label>
                        <input
                            type="text"
                            value={ref.name}
                            onChange={(e) => colEditable("reference_name") && handleChange(index, "name", e.target.value)}
                            required={colEditable("reference_name")}
                            readOnly={!colEditable("reference_name")}
                            className={!colEditable("reference_name") ? `${inputClass} bg-gray-50 cursor-not-allowed` : inactive(inputClass)}
                        />
                    </div>
                    )}
                    {col("reference_contact") && (
                    <div>
                        <label className={labelClass}>Contact Number *</label>
                        <input
                            type="tel"
                            value={ref.contact}
                            onChange={(e) => colEditable("reference_contact") && handleChange(index, "contact", e.target.value)}
                            required={colEditable("reference_contact")}
                            readOnly={!colEditable("reference_contact")}
                            className={!colEditable("reference_contact") ? `${inputClass} bg-gray-50 cursor-not-allowed` : inactive(inputClass)}
                        />
                    </div>
                    )}
                    {col("reference_address") && (
                    <div>
                        <label className={labelClass}>Address *</label>
                        <input
                            type="text"
                            value={ref.address}
                            onChange={(e) => colEditable("reference_address") && handleChange(index, "address", e.target.value)}
                            required={colEditable("reference_address")}
                            readOnly={!colEditable("reference_address")}
                            className={!colEditable("reference_address") ? `${inputClass} bg-gray-50 cursor-not-allowed` : inactive(inputClass)}
                        />
                    </div>
                    )}
                    {col("reference_relationship") && (
                    <div>
                        <label className={labelClass}>Relationship w/ Applicant *</label>
                        <select
                            value={ref.relationship || ""}
                            onChange={(e) => colEditable("reference_relationship") && handleChange(index, "relationship", e.target.value)}
                            required={colEditable("reference_relationship")}
                            disabled={!colEditable("reference_relationship")}
                            className={!colEditable("reference_relationship") ? `${inputClass} bg-gray-50 cursor-not-allowed` : inactive(inputClass)}
                        >
                            <option value="">Select Neighbours or Relation</option>
                            <option value="neighbours">Neighbours</option>
                            <option value="relation">Relation</option>
                        </select>
                    </div>
                    )}

                    {!ro && (
                        <div className="col-span-1 md:col-span-2 lg:col-span-4 text-right">
                            <button
                                type="button"
                                onClick={() => removeReference(index)}
                                className="text-red-600 text-xs hover:underline"
                            >
                                Remove
                            </button>
                        </div>
                    )}
                </div>
            ))}
            {references.length < 3 && (
                <p className="text-red-500 text-sm">Please add at least 3 references.</p>
            )}
        </div>
    );
}
