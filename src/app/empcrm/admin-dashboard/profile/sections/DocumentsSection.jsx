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
  fileUrls = {}, // Map of key -> url for existing documents
  reviewMode = false,
}) {
  const ro = reviewMode;

  const handleDocumentCheckbox = (key) => {
    if (ro) return;
    setDocuments(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFileChange = (e, fieldName) => {
    if (ro) return;
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
        { key: "doc_electricity_bill", label: "Electricity Bill", required: true },
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
              disabled={ro}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
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
              disabled={ro}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <div key={doc.key} className="p-3 bg-white border rounded-md hover:shadow-sm transition-shadow">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <label className={`flex items-start gap-2 ${ro ? "cursor-default" : "cursor-pointer"}`}>
                          <input
                            type="checkbox"
                            checked={documents[doc.key] || false}
                            onChange={() => handleDocumentCheckbox(doc.key)}
                            disabled={ro}
                            className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-60"
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
                          disabled={ro}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => !ro && document.getElementById(`file_${doc.key}`)?.click()}
                          disabled={ro}
                          className="p-2 rounded-full hover:bg-gray-100 text-gray-600 disabled:opacity-40 disabled:pointer-events-none"
                          title="Upload File"
                        >
                          <Upload className="w-4 h-4" />
                        </button>

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

                    {doc.key === "doc_electricity_bill" && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          This bill is for <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={documents.electricity_bill_proof_type || ""}
                          onChange={(e) =>
                            setDocuments((prev) => ({
                              ...prev,
                              electricity_bill_proof_type: e.target.value,
                            }))
                          }
                          disabled={ro}
                          required={!ro}
                          className="w-full max-w-sm px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                        >
                          <option value="">Select Current or Permanent</option>
                          <option value="current">Current address</option>
                          <option value="permanent">Permanent address</option>
                        </select>
                      </div>
                    )}
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
