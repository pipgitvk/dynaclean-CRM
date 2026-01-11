import { Upload, Eye, Paperclip, CheckCircle } from "lucide-react";

export default function DocumentsSection({
  documents,
  setDocuments,
  files,
  setFiles,
  existingDocs = [],
  existingPhotoUrl = "",
  existingSignatureUrl = "",
  isExperienced = false,
  fileUrls = {} // Map of key -> url for existing documents
}) {

  const handleDocumentCheckbox = (key) => {
    setDocuments(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFileChange = (e, fieldName) => {
    const file = e.target.files?.[0];
    if (file) {
      setFiles(prev => ({ ...prev, [fieldName]: file }));
      setDocuments(prev => ({ ...prev, [fieldName]: true }));
    } else {
      setFiles(prev => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
      setDocuments(prev => ({ ...prev, [fieldName]: false }));
    }
  };

  const documentCategories = [
    {
      title: "Identity Proof (Mandatory)",
      items: [
        { key: "doc_pan_card", label: "PAN Card", required: true },
        { key: "doc_voter_id", label: "Voter ID", required: false },
      ]
    },
    {
      title: "Address Proof (Mandatory)",
      items: [
        { key: "doc_aadhaar_card", label: "Aadhaar Card", required: true },
        { key: "doc_electricity_bill", label: "Electricity Bill (Permanent & Current)", required: true },
        { key: "doc_rent_agreement", label: "Rent Agreement (If Applicable)", required: false },
      ]
    },
    {
      title: "Educational Documents",
      items: [
        { key: "doc_10th_certificate", label: "10th Qualification Certificate", required: true },
        { key: "doc_12th_certificate", label: "12th Qualification Certificate", required: true },
        { key: "doc_degree_diploma", label: "Diploma / Degree Certificate", required: false },
        { key: "doc_technical_cert", label: "Relevant Technical Certification", required: false },
      ]
    },
    {
      title: "Experience Documents (If Experienced)",
      condition: isExperienced,
      items: [
        { key: "doc_appt_letter_prev", label: "Appointment Letter (Previous Company)", required: true },
        { key: "doc_exp_letter", label: "Experience Letter", required: true },
        { key: "doc_relieving_letter", label: "Relieving Letter", required: true },
        { key: "doc_salary_slips", label: "Last 3 Months Salary Slips", required: true },
      ]
    },
    {
      title: "Employment & HR Documents",
      items: [
        { key: "doc_loi_appointment", label: "LOI Appointment of Probation Period", required: false },
        { key: "doc_joining_form", label: "Joining Form (Signed)", required: false },
        { key: "doc_emp_verification", label: "Employee Verification Form", required: false },
        { key: "doc_code_conduct", label: "Code of Conduct Acceptance", required: false },
      ]
    },
    {
      title: "Bank & Payroll Details",
      items: [
        { key: "doc_cancelled_cheque", label: "Cancelled Cheque / Bank Passbook (Front)", required: true },
      ]
    },
    {
      title: "Confidentiality & Company Policy",
      items: [
        { key: "doc_nda", label: "NDA (Non-Disclosure Agreement – Signed)", required: false },
        { key: "doc_company_policy", label: "Company Policy Acceptance Form", required: false },
      ]
    },
    {
      title: "Other / Verification",
      items: [
        { key: "doc_police_verification", label: "Police Verification Form", required: false },
      ]
    }
  ];

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Mandatory Documents Upload</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Passport Size Photograph *</label>
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileChange(e, "profile_photo")}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {existingPhotoUrl && !files.profile_photo && (
              <a
                href={existingPhotoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 text-sm underline shrink-0"
              >
                View Existing
              </a>
            )}
            {files.profile_photo && (
              <a
                href={URL.createObjectURL(files.profile_photo)}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 text-sm underline shrink-0"
              >
                Preview New
              </a>
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Signature *</label>
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileChange(e, "signature")}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {existingSignatureUrl && !files.signature && (
              <a
                href={existingSignatureUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 text-sm underline shrink-0"
              >
                View Existing
              </a>
            )}
            {files.signature && (
              <a
                href={URL.createObjectURL(files.signature)}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 text-sm underline shrink-0"
              >
                Preview New
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {documentCategories.map((category, catIdx) => {
          if (category.condition === false) return null;

          return (
            <div key={catIdx} className="border rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                {category.title}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {category.items.map((doc) => (
                  <div key={doc.key} className="flex items-center justify-between gap-3 p-3 bg-white border rounded-md hover:shadow-sm transition-shadow">
                    <div className="flex-1 min-w-0">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={documents[doc.key] || false}
                          onChange={() => handleDocumentCheckbox(doc.key)}
                          className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-700 block truncate" title={doc.label}>
                            {doc.label} {doc.required && <span className="text-red-500">*</span>}
                          </span>
                          {(documents[doc.key] || files[doc.key]) && (
                            <span className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
                              <CheckCircle className="w-3 h-3" /> Selected
                            </span>
                          )}
                        </div>
                      </label>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        id={`file_${doc.key}`}
                        type="file"
                        onChange={(e) => handleFileChange(e, doc.key)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => document.getElementById(`file_${doc.key}`)?.click()}
                        className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
                        title="Upload File"
                      >
                        <Upload className="w-4 h-4" />
                      </button>

                      {/* View New Button */}
                      {files[doc.key] && (
                        <button
                          type="button"
                          onClick={() => {
                            try { window.open(URL.createObjectURL(files[doc.key]), "_blank"); } catch { }
                          }}
                          className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
                          title="View New Upload"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}

                      {/* View Existing Button (from URL map) */}
                      {!files[doc.key] && fileUrls[doc.key] && (
                        <button
                          type="button"
                          onClick={() => window.open(fileUrls[doc.key], "_blank")}
                          className="p-2 rounded-full hover:bg-blue-50 text-blue-600"
                          title="View Existing Document"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
