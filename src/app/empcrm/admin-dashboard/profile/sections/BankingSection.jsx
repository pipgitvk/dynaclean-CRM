import { shouldShowField } from "@/lib/reassignFieldVisibility";

export default function BankingSection({ formData, setFormData, reviewMode = false, reassignFieldKeys = null }) {
  const ro = reviewMode;
  const show = (k) => shouldShowField(reassignFieldKeys, k);
  const handleChange = (e) => {
    if (ro) return;
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const inactive = (cls) => (ro ? `${cls} bg-gray-50 cursor-not-allowed` : cls);

  return (
    <div className="border-b pb-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Banking Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {show("name_as_per_bank") && (
        <div>
          <label className={labelClass}>Name as per Bank</label>
          <input type="text" name="name_as_per_bank" value={formData.name_as_per_bank || ""} onChange={handleChange} readOnly={ro} className={inactive(inputClass)} />
        </div>
        )}
        {show("bank_name") && (
        <div>
          <label className={labelClass}>Bank Name</label>
          <input type="text" name="bank_name" value={formData.bank_name || ""} onChange={handleChange} readOnly={ro} className={inactive(inputClass)} />
        </div>
        )}
        {show("ifsc_code") && (
        <div>
          <label className={labelClass}>IFSC Code</label>
          <input type="text" name="ifsc_code" value={formData.ifsc_code || ""} onChange={handleChange} readOnly={ro} className={inactive(inputClass)} />
        </div>
        )}
        {show("bank_account_number") && (
        <div>
          <label className={labelClass}>Bank Account Number</label>
          <input type="text" name="bank_account_number" value={formData.bank_account_number || ""} onChange={handleChange} readOnly={ro} className={inactive(inputClass)} />
        </div>
        )}
      </div>
    </div>
  );
}
