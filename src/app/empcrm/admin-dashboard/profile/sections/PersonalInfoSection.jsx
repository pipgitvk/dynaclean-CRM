export default function PersonalInfoSection({ formData, setFormData, isPrivilegedEditor = true, isExperienced, setIsExperienced }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="border-b pb-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        Employee Basic Details
      </h3>

      {/* Experience Level Toggle - MANDATORY before details */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
        <label className="block text-sm font-bold text-gray-700 mb-3">Employment Type (Select before filling details) *</label>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer p-2 bg-white rounded border border-gray-200 hover:border-blue-400">
            <input
              type="radio"
              name="experience_level"
              checked={!isExperienced}
              onChange={() => setIsExperienced(false)}
              className="w-5 h-5 text-blue-600"
            />
            <span className="text-gray-900 font-medium">Fresher</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer p-2 bg-white rounded border border-gray-200 hover:border-blue-400">
            <input
              type="radio"
              name="experience_level"
              checked={isExperienced}
              onChange={() => setIsExperienced(true)}
              className="w-5 h-5 text-blue-600"
            />
            <span className="text-gray-900 font-medium">Experienced</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <label className={labelClass}>Full Name *</label>
          <input
            type="text"
            name="full_name"
            value={formData.full_name || ""}
            onChange={handleChange}
            required
            className={inputClass}
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

        {/* Probation Period - requested default option */}
        <div>
          <label className={labelClass}>Probation Period *</label>
          <select
            name="probation_period"
            value={formData.probation_period || "6 Months"}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="3 Months">3 Months</option>
            <option value="6 Months">6 Months</option>
            <option value="1 Year">1 Year</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Department *</label>
          <input
            type="text"
            name="department"
            value={formData.department || ""}
            onChange={handleChange}
            className={inputClass}
            required
          />
        </div>

        <div>
          <label className={labelClass}>Designation *</label>
          <input
            type="text"
            name="designation"
            value={formData.designation || ""}
            onChange={handleChange}
            required
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Date of Joining *</label>
          <input
            type="date"
            name="date_of_joining"
            value={formData.date_of_joining || ""}
            onChange={handleChange}
            required
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Reporting Manager *</label>
          <input
            type="text"
            name="reporting_manager"
            value={formData.reporting_manager || ""}
            onChange={handleChange}
            required
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Work Location</label>
          <input
            type="text"
            name="work_location"
            value={formData.work_location || ""}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Employment Status *</label>
          <select
            name="employment_status"
            value={formData.employment_status || "probation"}
            onChange={handleChange}
            className={inputClass}
            required
          >
            <option value="probation">Probation</option>
            <option value="permanent">Permanent</option>
            <option value="notice_period">Notice Period</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Date of Birth *</label>
          <input
            type="date"
            name="date_of_birth"
            value={formData.date_of_birth || ""}
            onChange={handleChange}
            required
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Contact Mobile *</label>
          <input
            type="tel"
            name="contact_mobile"
            value={formData.contact_mobile || ""}
            onChange={handleChange}
            required
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            name="email"
            value={formData.email || ""}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Blood Group</label>
          <input
            type="text"
            name="blood_group"
            value={formData.blood_group || ""}
            onChange={handleChange}
            placeholder="e.g., B+"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Marital Status *</label>
          <select
            name="marital_status"
            value={formData.marital_status || "Single"}
            onChange={handleChange}
            required
            className={inputClass}
          >
            <option value="Single">Single</option>
            <option value="Married">Married</option>
            <option value="Divorced">Divorced</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Parents Info */}
        <div>
          <label className={labelClass}>Father's Name *</label>
          <input
            type="text"
            name="father_name"
            value={formData.father_name || ""}
            onChange={handleChange}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Father's Contact *</label>
          <input
            type="tel"
            name="father_phone"
            value={formData.father_phone || ""}
            onChange={handleChange}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Mother's Name *</label>
          <input
            type="text"
            name="mother_name"
            value={formData.mother_name || ""}
            onChange={handleChange}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Mother's Contact *</label>
          <input
            type="tel"
            name="mother_phone"
            value={formData.mother_phone || ""}
            onChange={handleChange}
            required
            className={inputClass}
          />
        </div>

        {/* Emergency Contact */}
        <div>
          <label className={labelClass}>Emergency Contact Name</label>
          <input
            type="text"
            name="emergency_contact_name"
            value={formData.emergency_contact_name || ""}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Emergency Contact Number</label>
          <input
            type="tel"
            name="emergency_contact_number"
            value={formData.emergency_contact_number || ""}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        {/* Tax & Compliance */}
        <div className="md:col-span-3 mt-4 border-t pt-4 bg-gray-50 p-4 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-800 mb-3">Tax & Compliance Info</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>PAN Number *</label>
              <input
                type="text"
                name="pan_number"
                value={formData.pan_number || ""}
                onChange={handleChange}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Aadhaar Number *</label>
              <input
                type="text"
                name="aadhar_number"
                value={formData.aadhar_number || ""}
                onChange={handleChange}
                className={inputClass}
                required
              />
            </div>
            {/* {isExperienced && ( */}
            <div>
              <label className={labelClass}>PF UAN Number</label>
              <input
                type="text"
                name="pf_uan"
                value={formData.pf_uan || ""}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            {/* )} */}
            <div>
              <label className={labelClass}>ESIC Number (If Available)</label>
              <input
                type="text"
                name="esic_number"
                value={formData.esic_number || ""}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <label className={labelClass}>Current Address *</label>
          <textarea
            name="correspondence_address"
            value={formData.correspondence_address || ""}
            onChange={handleChange}
            rows="2"
            required
            className={inputClass}
          />
        </div>
        <div className="md:col-span-2">
          <label className={labelClass}>Permanent Address *</label>
          <textarea
            name="permanent_address"
            value={formData.permanent_address || ""}
            onChange={handleChange}
            rows="2"
            required
            className={inputClass}
          />
        </div>

        {isPrivilegedEditor && (
          <>
            {/* Leave Policy Config - Admin only */}
            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4 mt-2 p-4 border rounded-lg bg-gray-50">
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
          </>
        )}
      </div>
    </div>
  );
}
