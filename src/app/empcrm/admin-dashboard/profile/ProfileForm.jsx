"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Upload, Loader2, Save } from "lucide-react";
import PersonalInfoSection from "./sections/PersonalInfoSection";
import BankingSection from "./sections/BankingSection";
import EducationSection from "./sections/EducationSection";
import ExperienceSection from "./sections/ExperienceSection";
import DocumentsSection from "./sections/DocumentsSection";
import ReferencesSection from "./sections/ReferencesSection";

export default function ProfileForm({ username, empId, entryMode, onBack, submitTo, isPrivilegedEditor = true, initialData = null, reviewMode = false }) {
  const [loading, setLoading] = useState(false);
  const [isExperienced, setIsExperienced] = useState(false);

  const [formData, setFormData] = useState({
    username,
    empId,
    employment_status: "probation",
    leave_policy: { sick_allowed: 0, paid_allowed: 0, sick_enabled: false, paid_enabled: false },
    full_name: "",
    contact_mobile: "",
    email: "",
    designation: "",
    date_of_joining: "",
    work_location: "",
    probation_period: "6 Months",
    marital_status: "Single",
    father_name: "",
    father_phone: "",
    mother_name: "",
    mother_phone: "",
    reporting_manager: "",
    department: "",
    correspondence_address: "",
    permanent_address: "",
    pan_number: "",
    aadhar_number: "",
    pf_uan: "",
    esic_number: "",
    emergency_contact_name: "",
    emergency_contact_number: "",
    ...(initialData || {})
  });

  const [references, setReferences] = useState((initialData?.references || []).map(ref => ({
    name: ref.name || ref.reference_name || "",
    contact: ref.contact || ref.reference_mobile || "",
    address: ref.address || ref.reference_address || "",
    relationship: ref.relationship || ""
  })));
  const [education, setEducation] = useState(initialData?.education || []);
  const [experience, setExperience] = useState(initialData?.experience || []);
  const [documents, setDocuments] = useState(initialData?.documents_submitted || {});
  const [files, setFiles] = useState({});

  useEffect(() => {
    // If initialData provided, we don't need to fetch. 
    // And we already initialized state with it.
    // Just ensure isExperienced is set.
    if (initialData) {
      if ((initialData.experience && initialData.experience.length > 0) || initialData.is_experienced) {
        setIsExperienced(true);
      }
    } else {
      setFormData(prev => ({
        ...prev,
        username,
        empId,
        employee_code: empId || prev.employee_code || "",
      }));
      fetchExistingProfile();
    }
  }, [username, empId, initialData]);

  const fetchExistingProfile = async () => {
    // Only fetch if no initial data
    if (initialData) return;
    try {
      const response = await fetch(`/api/empcrm/profile?username=${username}`);
      const data = await response.json();

      if (data.success && data.profile) {
        // Parse documents if string
        let joiningDocs = data.profile.joining_form_documents;
        if (typeof joiningDocs === 'string') {
          try { joiningDocs = JSON.parse(joiningDocs); } catch { joiningDocs = []; }
        }

        let docsSubmitted = data.profile.documents_submitted;
        if (typeof docsSubmitted === 'string') {
          try { docsSubmitted = JSON.parse(docsSubmitted); } catch { docsSubmitted = {}; }
        }

        // Construct fileUrls for existing documents
        const existingFileUrls = {};
        // Legacy key mapping
        const legacyMap = {
          document_pan_copy: "doc_pan_card",
          document_voter_id: "doc_voter_id", // assuming legacy matches
          document_aadhaar_card: "doc_aadhaar_card", // assuming legacy matches
          document_electricity_bill: "doc_electricity_bill", // assuming legacy matches
          document_rent_agreement: "doc_rent_agreement", // assuming legacy matches
          document_10th_certificate: "doc_10th_certificate",
          document_12th_certificate: "doc_12th_certificate",
          document_graduation_certificate: "doc_degree_diploma",
          document_professional_certificates: "doc_technical_cert",
          document_relieve_experience_letters: "doc_exp_letter",
          document_salary_slips: "doc_salary_slips",
          document_appointment_ack: "doc_loi_appointment",
        };

        if (Array.isArray(joiningDocs)) {
          joiningDocs.forEach(url => {
            const filename = url.split('/').pop();
            const decodedFilename = decodeURIComponent(filename);
            const match = decodedFilename.match(/^(.*)_\d+(?:\.[^.]+)?$/);
            if (match) {
              const extractedKey = match[1];
              // Add direct key
              existingFileUrls[extractedKey] = url;

              // Add mapped key if exists (so new UI finds old doc)
              if (legacyMap[extractedKey]) {
                existingFileUrls[legacyMap[extractedKey]] = url;
              }

              // Also handle reverse mapping if needed? No, purely legacy -> new.
            }
          });
        }


        setFormData(prev => ({
          ...prev,
          ...data.profile,
          joining_form_documents: joiningDocs, // Ensure array
          documents_submitted: docsSubmitted, // Ensure object
          fileUrls: existingFileUrls
        }));

        setReferences((data.profile.references || []).map(ref => ({
          name: ref.name || ref.reference_name || "",
          contact: ref.contact || ref.reference_mobile || "",
          address: ref.address || ref.reference_address || "",
          relationship: ref.relationship || ""
        })));

        // Initialize documents checklist
        // If documents_submitted is empty, infer from existing files
        if (Object.keys(docsSubmitted).length === 0 && Object.keys(existingFileUrls).length > 0) {
          Object.keys(existingFileUrls).forEach(key => {
            // If the file key exists, mark checklist as true
            docsSubmitted[key] = true;
          });
        }

        setEducation(data.profile.education || []);
        setExperience(data.profile.experience || []);
        setDocuments(docsSubmitted || {});

        // Infer experience level if not explicitly saved (naive check: has experience entries?)
        // Or if we save 'isExperienced' in formData/profile, use that.
        // For now, if experience array has items, set true.
        if (data.profile.is_experienced) {
          setIsExperienced(!!data.profile.is_experienced);
        } else if (data.profile.experience && data.profile.experience.length > 0) {
          setIsExperienced(true);
        }
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const validateForm = () => {
    // 1. Check References
    if (references.length < 3) {
      toast.error("Please provide at least 3 Reference Verification Details.");
      return false;
    }
    for (const ref of references) {
      if (!ref.name || !ref.contact || !ref.address || !ref.relationship) {
        toast.error("Please complete all details for references.");
        return false;
      }
    }

    // 2. Check Mandatory Documents
    const MANDATORY_KEYS = [
      "doc_pan_card",
      "doc_aadhaar_card",
      "doc_electricity_bill",
      "doc_10th_certificate",
      "doc_12th_certificate"
      // "doc_degree_diploma",
      // "doc_loi_appointment",
      // "doc_joining_form",
      // "doc_emp_verification",
      // "doc_code_conduct",
      // "doc_cancelled_cheque",
      // "doc_nda",
      // "doc_company_policy"
    ];

    if (isExperienced) {
      MANDATORY_KEYS.push(
        "doc_appt_letter_prev",
        "doc_exp_letter",
        "doc_relieving_letter",
        "doc_salary_slips"
      );
    }

    const missingDocs = MANDATORY_KEYS.filter(key => !documents[key]);
    if (missingDocs.length > 0) {
      toast.error(`Missing mandatory documents: ${missingDocs.length} required documents not selected.`);
      // Optionally list them: 
      // toast.error(`Missing: ${missingDocs.join(", ")}`);
      return false;
    }

    // 3. Check Files for Selected Docs (if selected but not uploaded AND not previously existing)
    // Since we don't track which doc is "previously existing" reliably by key (documents[key] = true/false),
    // we rely on documents[key] being true.
    // If documents[key] is TRUE, we assume it's fine. 
    // Ideally we should check if (documents[key] === true && !files[key] && !serverHasIt).
    // Taking a lenient approach: if checked, assume valid unless we want to force upload.
    // But we DO want to force upload for mandatory if they are not already there.
    // We will assume if it came from DB (fetchExistingProfile), it's verified.

    // 4. Check Photos/Signature
    // If no file and no URL from DB, error.
    const hasProtoPhoto = files.profile_photo || formData.profile_photo;
    const hasSignature = files.signature || formData.signature;

    if (!hasProtoPhoto) {
      toast.error("Passport size photograph is required.");
      return false;
    }
    if (!hasSignature) {
      toast.error("Signature is required.");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const submitData = new FormData();
      Object.keys(formData).forEach(key => {
        if (key === "leave_policy") {
          submitData.append("leave_policy", JSON.stringify(formData.leave_policy || {}));
        } else if (
          key === "references" ||
          key === "education" ||
          key === "experience" ||
          key === "documents_submitted" ||
          key === "joining_form_documents" ||
          key === "fileUrls" ||
          key === "is_experienced"
        ) {
          // Skip these as they are handled explicitly below
          return;
        } else {
          submitData.append(key, formData[key] ?? "");
        }
      });

      // Append existing documents explicitly
      const existingDocs = formData.joining_form_documents;
      if (Array.isArray(existingDocs)) {
        existingDocs.forEach(docUrl => {
          if (typeof docUrl === 'string') {
            submitData.append("joining_form_documents", docUrl);
          }
        });
      }

      // Append experienced flag?
      submitData.append("is_experienced", isExperienced);

      submitData.append("references", JSON.stringify(references));
      submitData.append("education", JSON.stringify(education));
      submitData.append("experience", JSON.stringify(experience));
      submitData.append("documents_submitted", JSON.stringify(documents));

      if (files.profile_photo) submitData.append("profile_photo", files.profile_photo);
      if (files.signature) submitData.append("signature", files.signature);

      // Append other files
      Object.keys(files).forEach((k) => {
        if (k !== 'profile_photo' && k !== 'signature') {
          submitData.append(k, files[k]);
        }
      });


      // If submitTo is provided (e.g. Submissions API), default to POST unless specified otherwise.
      // If direct profile save (no submitTo), infer PUT/PATCH based on ID.
      let method = "POST";
      const endpoint = submitTo || "/api/empcrm/profile?mode=manual";

      if (!submitTo) {
        const isUpdate = !!formData.id;
        method = isUpdate ? "PATCH" : "PUT";
      }

      console.log(`[ProfileForm] Submitting to ${endpoint} with method ${method} (ID: ${formData.id || 'N/A'})`);

      const response = await fetch(endpoint, {
        method: method,
        body: submitData,
      });

      const result = await response.json();

      if (result.success) {
        toast.success(result.message || "Profile saved");
        setTimeout(() => onBack(), 1500);
      } else {
        toast.error(result.error || "Failed to save profile");
      }
    } catch (error) {
      console.error(error);
      toast.error("Error saving profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <button onClick={onBack} className="text-blue-600 hover:text-blue-800 mb-4">
        ← Back
      </button>

      <form onSubmit={handleSubmit} className="space-y-6">
        <PersonalInfoSection
          formData={formData}
          setFormData={setFormData}
          isPrivilegedEditor={isPrivilegedEditor}
          isExperienced={isExperienced}
          setIsExperienced={setIsExperienced}
        />

        <BankingSection formData={formData} setFormData={setFormData} />

        <EducationSection education={education} setEducation={setEducation} />

        {isExperienced && (
          <ExperienceSection experience={experience} setExperience={setExperience} />
        )}

        <ReferencesSection references={references} setReferences={setReferences} />

        <DocumentsSection
          documents={documents}
          setDocuments={setDocuments}
          files={files}
          setFiles={setFiles}
          existingDocs={Array.isArray(formData.joining_form_documents) ? formData.joining_form_documents : []}
          existingPhotoUrl={formData.profile_photo || ""}
          existingSignatureUrl={formData.signature || ""}
          isExperienced={isExperienced}
          fileUrls={formData.fileUrls || {}}
        />

        <div className="flex gap-4 border-t pt-4">
          {!reviewMode && (
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold shadow-sm"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {loading ? "Saving..." : "Submit"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
