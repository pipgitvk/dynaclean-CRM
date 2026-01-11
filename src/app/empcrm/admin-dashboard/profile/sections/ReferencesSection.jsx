export default function ReferencesSection({ references, setReferences }) {
    const addReference = () => {
        setReferences([...references, { name: "", contact: "", address: "", relationship: "" }]);
    };

    const removeReference = (index) => {
        setReferences(references.filter((_, i) => i !== index));
    };

    const handleChange = (index, field, value) => {
        const updatedRef = [...references];
        updatedRef[index][field] = value;
        setReferences(updatedRef);
    };

    const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500";
    const labelClass = "block text-sm font-medium text-gray-700 mb-1";

    return (
        <div className="border-b pb-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                    Reference Verification Details (Minimum 3)
                </h3>
                <button
                    type="button"
                    onClick={addReference}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                    + Add Reference
                </button>
            </div>

            {references.map((ref, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 mb-4 bg-gray-50 rounded-lg border">
                    <div>
                        <label className={labelClass}>Reference Name *</label>
                        <input
                            type="text"
                            value={ref.name}
                            onChange={(e) => handleChange(index, "name", e.target.value)}
                            required
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Contact Number *</label>
                        <input
                            type="tel"
                            value={ref.contact}
                            onChange={(e) => handleChange(index, "contact", e.target.value)}
                            required
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Address *</label>
                        <input
                            type="text"
                            value={ref.address}
                            onChange={(e) => handleChange(index, "address", e.target.value)}
                            required
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Relationship w/ Applicant *</label>
                        <input
                            type="text"
                            value={ref.relationship}
                            onChange={(e) => handleChange(index, "relationship", e.target.value)}
                            required
                            className={inputClass}
                        />
                    </div>

                    <div className="col-span-1 md:col-span-2 lg:col-span-4 text-right">
                        <button
                            type="button"
                            onClick={() => removeReference(index)}
                            className="text-red-600 text-xs hover:underline"
                        >
                            Remove
                        </button>
                    </div>
                </div>
            ))}
            {references.length < 3 && (
                <p className="text-red-500 text-sm">Please add at least 3 references.</p>
            )}
        </div>
    );
}
