export default function BankingSection({ formData, setFormData }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="border-b pb-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Banking Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Name as per Bank</label>
          <input type="text" name="name_as_per_bank" value={formData.name_as_per_bank || ""} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Bank Name</label>
          <input type="text" name="bank_name" value={formData.bank_name || ""} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>IFSC Code</label>
          <input type="text" name="ifsc_code" value={formData.ifsc_code || ""} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Bank Account Number</label>
          <input type="text" name="bank_account_number" value={formData.bank_account_number || ""} onChange={handleChange} className={inputClass} />
        </div>
      </div>
    </div>
  );
}
