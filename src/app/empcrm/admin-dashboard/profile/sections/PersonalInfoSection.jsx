import { shouldShowField, isReassignFieldMode } from "@/lib/reassignFieldVisibility";

export default function PersonalInfoSection({
  formData,
  setFormData,
  isPrivilegedEditor = true,
  isExperienced,
  setIsExperienced,
  reviewMode = false,
  reassignFieldKeys = null,
  documentsSlot = null,
}) {
  const ro = reviewMode;
  const rf = reassignFieldKeys;
  const show = (k) => shouldShowField(rf, k);
  const hideIdRow = isReassignFieldMode(rf);

  const handleChange = (e) => {
    if (ro) return;
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const inactive = (cls) => (ro ? `${cls} bg-gray-50 cursor-not-allowed` : cls);

  const hasPersonalDetailsContent =
    Boolean(documentsSlot) ||
    show("date_of_birth") ||
    show("contact_mobile") ||
    show("email") ||
    show("blood_group") ||
    show("marital_status") ||
    show("father_name") ||
    show("father_phone") ||
    show("mother_name") ||
    show("mother_phone") ||
    show("emergency_contact_name") ||
    show("emergency_contact_number") ||
    show("correspondence_address") ||
    show("permanent_address");

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-sky-200 bg-sky-50/90 p-5 md:p-6 shadow-sm space-y-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-1 pb-2 border-b border-sky-200/80">
        Employee Basic Details
      </h3>

      {show("is_experienced") && (
      <div className="p-4 bg-white/80 rounded-lg border border-sky-100">
        <label className="block text-sm font-bold text-gray-700 mb-3">Employment Type (Select before filling details) *</label>
        <div className="flex gap-6">
          <label className={`flex items-center gap-2 p-2 bg-white rounded border border-gray-200 ${ro ? "cursor-default opacity-90" : "cursor-pointer hover:border-blue-400"}`}>
            <input
              type="radio"
              name="experience_level"
              checked={!isExperienced}
              onChange={() => !ro && setIsExperienced(false)}
              disabled={ro}
              className="w-5 h-5 text-blue-600"
            />
            <span className="text-gray-900 font-medium">Fresher</span>
          </label>
          <label className={`flex items-center gap-2 p-2 bg-white rounded border border-gray-200 ${ro ? "cursor-default opacity-90" : "cursor-pointer hover:border-blue-400"}`}>
            <input
              type="radio"
              name="experience_level"
              checked={isExperienced}
              onChange={() => !ro && setIsExperienced(true)}
              disabled={ro}
              className="w-5 h-5 text-blue-600"
            />
            <span className="text-gray-900 font-medium">Experienced</span>
          </label>
        </div>
      </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {!hideIdRow && (
          <>
        <div>
          <label className={labelClass}>Employee ID (Auto-Generated)</label>
          <input
            type="text"
            name="employee_code"
            value={formData.employee_code || formData.empId || ""}
            readOnly
            className={`${inputClass} bg-gray-100 cursor-not-allowed text-gray-500`}
            title="Employee Code is the same as Employee ID"
          />
        </div>

        <div>
          <label className={labelClass}>Username *</label>
          <input
            type="text"
            name="username"
            value={formData.username || ""}
            readOnly
            className={`${inputClass} bg-gray-100 cursor-not-allowed`}
          />
        </div>
          </>
        )}

        {show("full_name") && (
        <div>
          <label className={labelClass}>Full Name *</label>
          <input
            type="text"
            name="full_name"
            value={formData.full_name || ""}
            onChange={handleChange}
            required={!rf || show("full_name")}
            readOnly={ro}
            className={inactive(inputClass)}
          />
        </div>
        )}

        {show("probation_period") && (
        <div>
          <label className={labelClass}>Probation Period *</label>
          <select
            name="probation_period"
            value={formData.probation_period || "6 Months"}
            onChange={handleChange}
            disabled={ro}
            className={inactive(inputClass)}
          >
            <option value="3 Months">3 Months</option>
            <option value="6 Months">6 Months</option>
            <option value="1 Year">1 Year</option>
          </select>
        </div>
        )}

        {show("department") && (
        <div>
          <label className={labelClass}>Department *</label>
          <input
            type="text"
            name="department"
            value={formData.department || ""}
            onChange={handleChange}
            className={inactive(inputClass)}
            required={!rf || show("department")}
            readOnly={ro}
          />
        </div>
        )}

        {show("designation") && (
        <div>
          <label className={labelClass}>Designation *</label>
          <input
            type="text"
            name="designation"
            value={formData.designation || ""}
            onChange={handleChange}
            required={!rf || show("designation")}
            readOnly={ro}
            className={inactive(inputClass)}
          />
        </div>
        )}

        {show("date_of_joining") && (
        <div>
          <label className={labelClass}>Date of Joining *</label>
          <input
            type="date"
            name="date_of_joining"
            value={formData.date_of_joining || ""}
            onChange={handleChange}
            required={!rf || show("date_of_joining")}
            disabled={ro}
            className={inactive(inputClass)}
          />
        </div>
        )}

        {show("reporting_manager") && (
        <div>
          <label className={labelClass}>Reporting Manager *</label>
          <input
            type="text"
            name="reporting_manager"
            value={formData.reporting_manager || ""}
            onChange={handleChange}
            required={!rf || show("reporting_manager")}
            readOnly={ro}
            className={inactive(inputClass)}
          />
        </div>
        )}

        {show("work_location") && (
        <div>
          <label className={labelClass}>Work Location</label>
          <input
            type="text"
            name="work_location"
            value={formData.work_location || ""}
            onChange={handleChange}
            readOnly={ro}
            className={inactive(inputClass)}
            required={Boolean(rf && show("work_location"))}
          />
        </div>
        )}

        {show("employment_status") && (
        <div>
          <label className={labelClass}>Employment Status *</label>
          <select
            name="employment_status"
            value={formData.employment_status || "probation"}
            onChange={handleChange}
            disabled={ro}
            className={inactive(inputClass)}
            required={!rf || show("employment_status")}
          >
            <option value="probation">Probation</option>
            <option value="permanent">Permanent</option>
            <option value="notice_period">Notice Period</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>
        )}
      </div>
      </div>

      {hasPersonalDetailsContent && (
      <div className="rounded-xl border border-violet-200 bg-violet-50/85 p-5 md:p-6 space-y-4 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-800 pb-2 border-b border-violet-200/80">
          Employee Personal Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {show("date_of_birth") && (
        <div>
          <label className={labelClass}>Date of Birth *</label>
          <input
            type="date"
            name="date_of_birth"
            value={formData.date_of_birth || ""}
            onChange={handleChange}
            required={!rf || show("date_of_birth")}
            disabled={ro}
            className={inactive(inputClass)}
          />
        </div>
        )}

        {show("contact_mobile") && (
        <div>
          <label className={labelClass}>Contact Mobile *</label>
          <input
            type="tel"
            name="contact_mobile"
            value={formData.contact_mobile || ""}
            onChange={handleChange}
            required={!rf || show("contact_mobile")}
            readOnly={ro}
            className={inactive(inputClass)}
          />
        </div>
        )}

        {show("email") && (
        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            name="email"
            value={formData.email || ""}
            onChange={handleChange}
            readOnly={ro}
            className={inactive(inputClass)}
            required={Boolean(rf && show("email"))}
          />
        </div>
        )}

        {show("blood_group") && (
        <div>
          <label className={labelClass}>Blood Group</label>
          <input
            type="text"
            name="blood_group"
            value={formData.blood_group || ""}
            onChange={handleChange}
            placeholder="e.g., B+"
            readOnly={ro}
            className={inactive(inputClass)}
            required={Boolean(rf && show("blood_group"))}
          />
        </div>
        )}
        {show("marital_status") && (
        <div>
          <label className={labelClass}>Marital Status *</label>
          <select
            name="marital_status"
            value={formData.marital_status || "Single"}
            onChange={handleChange}
            required={!rf || show("marital_status")}
            disabled={ro}
            className={inactive(inputClass)}
          >
            <option value="Single">Single</option>
            <option value="Married">Married</option>
            <option value="Divorced">Divorced</option>
            <option value="Other">Other</option>
          </select>
        </div>
        )}

        {show("father_name") && (
        <div>
          <label className={labelClass}>Father's Name *</label>
          <input
            type="text"
            name="father_name"
            value={formData.father_name || ""}
            onChange={handleChange}
            required={!rf || show("father_name")}
            readOnly={ro}
            className={inactive(inputClass)}
          />
        </div>
        )}
        {show("father_phone") && (
        <div>
          <label className={labelClass}>Father's Contact *</label>
          <input
            type="tel"
            name="father_phone"
            value={formData.father_phone || ""}
            onChange={handleChange}
            required={!rf || show("father_phone")}
            readOnly={ro}
            className={inactive(inputClass)}
          />
        </div>
        )}
        {show("mother_name") && (
        <div>
          <label className={labelClass}>Mother's Name *</label>
          <input
            type="text"
            name="mother_name"
            value={formData.mother_name || ""}
            onChange={handleChange}
            required={!rf || show("mother_name")}
            readOnly={ro}
            className={inactive(inputClass)}
          />
        </div>
        )}
        {show("mother_phone") && (
        <div>
          <label className={labelClass}>Mother's Contact *</label>
          <input
            type="tel"
            name="mother_phone"
            value={formData.mother_phone || ""}
            onChange={handleChange}
            required={!rf || show("mother_phone")}
            readOnly={ro}
            className={inactive(inputClass)}
          />
        </div>
        )}

        {show("emergency_contact_name") && (
        <div>
          <label className={labelClass}>Emergency Contact Name</label>
          <input
            type="text"
            name="emergency_contact_name"
            value={formData.emergency_contact_name || ""}
            onChange={handleChange}
            readOnly={ro}
            className={inactive(inputClass)}
            required={Boolean(rf && show("emergency_contact_name"))}
          />
        </div>
        )}
        {show("emergency_contact_number") && (
        <div>
          <label className={labelClass}>Emergency Contact Number</label>
          <input
            type="tel"
            name="emergency_contact_number"
            value={formData.emergency_contact_number || ""}
            onChange={handleChange}
            readOnly={ro}
            className={inactive(inputClass)}
            required={Boolean(rf && show("emergency_contact_number"))}
          />
        </div>
        )}

        {show("correspondence_address") && (
        <div className="md:col-span-2">
          <label className={labelClass}>Current Address *</label>
          <textarea
            name="correspondence_address"
            value={formData.correspondence_address || ""}
            onChange={handleChange}
            rows="2"
            required={!rf || show("correspondence_address")}
            readOnly={ro}
            className={inactive(inputClass)}
          />
        </div>
        )}
        {show("permanent_address") && (
        <div className="md:col-span-2">
          <label className={labelClass}>Permanent Address *</label>
          <textarea
            name="permanent_address"
            value={formData.permanent_address || ""}
            onChange={handleChange}
            rows="2"
            required={!rf || show("permanent_address")}
            readOnly={ro}
            className={inactive(inputClass)}
          />
        </div>
        )}
        </div>

        {documentsSlot}
      </div>
      )}

      {isPrivilegedEditor && !ro && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div>
                <label className={labelClass}>Sick Leave Enabled</label>
                <select
                  name="leave_policy_sick_enabled"
                  value={formData.leave_policy?.sick_enabled ? "true" : "false"}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    leave_policy: {
                      ...prev.leave_policy,
                      sick_enabled: e.target.value === "true"
                    }
                  }))}
                  className={inputClass}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Sick Leave Allowed</label>
                <input
                  type="number"
                  min="0"
                  name="leave_policy_sick_allowed"
                  value={formData.leave_policy?.sick_allowed ?? 0}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    leave_policy: {
                      ...prev.leave_policy,
                      sick_allowed: Number(e.target.value || 0)
                    }
                  }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Paid Leave Enabled</label>
                <select
                  name="leave_policy_paid_enabled"
                  value={formData.leave_policy?.paid_enabled ? "true" : "false"}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    leave_policy: {
                      ...prev.leave_policy,
                      paid_enabled: e.target.value === "true"
                    }
                  }))}
                  className={inputClass}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Paid Leave Allowed</label>
                <input
                  type="number"
                  min="0"
                  name="leave_policy_paid_allowed"
                  value={formData.leave_policy?.paid_allowed ?? 0}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    leave_policy: {
                      ...prev.leave_policy,
                      paid_allowed: Number(e.target.value || 0)
                    }
                  }))}
                  className={inputClass}
                />
              </div>
            </div>
      )}
    </div>
  );
}
