import {
  shouldShowField,
  shouldShowBankingBlock,
  shouldShowExperienceSection,
} from "@/lib/reassignFieldVisibility";
import ExperienceSection from "./ExperienceSection";

export default function BankingDetailsSection({
  formData,
  setFormData,
  experience,
  setExperience,
  isExperienced,
  reviewMode = false,
  reassignFieldKeys = null,
  bankingDocumentsSlot = null,
}) {
  const ro = reviewMode;
  const rf = reassignFieldKeys;
  const show = (k) => shouldShowField(rf, k);

  const handleChange = (e) => {
    if (ro) return;
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const inactive = (cls) => (ro ? `${cls} bg-gray-50 cursor-not-allowed` : cls);

  const showTax =
    show("pan_number") ||
    show("aadhar_number") ||
    show("pf_uan") ||
    show("esic_number");
  const showBankFields = shouldShowBankingBlock(rf);
  const showExperienceBlock =
    isExperienced && shouldShowExperienceSection(rf);

  if (!showTax && !showBankFields && !showExperienceBlock && !bankingDocumentsSlot) {
    return null;
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/85 p-5 md:p-6 space-y-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-800 pb-2 border-b border-amber-200/80">
        Banking Details
      </h3>

      {showTax && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-800">Tax & compliance</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-white/90 border border-amber-100 rounded-lg">
            {show("pan_number") && (
              <div>
                <label className={labelClass}>PAN Number *</label>
                <input
                  type="text"
                  name="pan_number"
                  value={formData.pan_number || ""}
                  onChange={handleChange}
                  className={inactive(inputClass)}
                  required={!rf || show("pan_number")}
                  readOnly={ro}
                />
              </div>
            )}
            {show("aadhar_number") && (
              <div>
                <label className={labelClass}>Aadhaar Number *</label>
                <input
                  type="text"
                  name="aadhar_number"
                  value={formData.aadhar_number || ""}
                  onChange={handleChange}
                  className={inactive(inputClass)}
                  required={!rf || show("aadhar_number")}
                  readOnly={ro}
                />
              </div>
            )}
            {show("pf_uan") && (
              <div>
                <label className={labelClass}>PF UAN Number</label>
                <input
                  type="text"
                  name="pf_uan"
                  value={formData.pf_uan || ""}
                  onChange={handleChange}
                  readOnly={ro}
                  className={inactive(inputClass)}
                  required={Boolean(rf && show("pf_uan"))}
                />
              </div>
            )}
            {show("esic_number") && (
              <div>
                <label className={labelClass}>ESIC Number (If Available)</label>
                <input
                  type="text"
                  name="esic_number"
                  value={formData.esic_number || ""}
                  onChange={handleChange}
                  readOnly={ro}
                  className={inactive(inputClass)}
                  required={Boolean(rf && show("esic_number"))}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {showBankFields && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-800">Bank account</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white/90 border border-amber-100 rounded-lg">
            {show("name_as_per_bank") && (
              <div>
                <label className={labelClass}>Name as per Bank</label>
                <input
                  type="text"
                  name="name_as_per_bank"
                  value={formData.name_as_per_bank || ""}
                  onChange={handleChange}
                  readOnly={ro}
                  className={inactive(inputClass)}
                />
              </div>
            )}
            {show("bank_name") && (
              <div>
                <label className={labelClass}>Bank Name</label>
                <input
                  type="text"
                  name="bank_name"
                  value={formData.bank_name || ""}
                  onChange={handleChange}
                  readOnly={ro}
                  className={inactive(inputClass)}
                />
              </div>
            )}
            {show("ifsc_code") && (
              <div>
                <label className={labelClass}>IFSC Code</label>
                <input
                  type="text"
                  name="ifsc_code"
                  value={formData.ifsc_code || ""}
                  onChange={handleChange}
                  readOnly={ro}
                  className={inactive(inputClass)}
                />
              </div>
            )}
            {show("bank_account_number") && (
              <div>
                <label className={labelClass}>Bank Account Number</label>
                <input
                  type="text"
                  name="bank_account_number"
                  value={formData.bank_account_number || ""}
                  onChange={handleChange}
                  readOnly={ro}
                  className={inactive(inputClass)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {bankingDocumentsSlot}

      {showExperienceBlock && (
        <div className="space-y-3 pt-2 border-t border-amber-200/80">
          <ExperienceSection
            experience={experience}
            setExperience={setExperience}
            reviewMode={reviewMode}
            embedded
            reassignFieldKeys={reassignFieldKeys}
          />
        </div>
      )}
    </div>
  );
}
