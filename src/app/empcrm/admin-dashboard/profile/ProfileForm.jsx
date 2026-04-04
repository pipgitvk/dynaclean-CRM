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
import {
  isReassignFieldMode,
  shouldShowPersonalBlock,
  shouldShowBankingBlock,
  shouldShowEducationSection,
  shouldShowExperienceSection,
  shouldShowReferencesSection,
  shouldShowDocumentsSection,
} from "@/lib/reassignFieldVisibility";
import { labelForReassignKey } from "@/lib/profileReassignFields";
import { deriveIsExperiencedForForm } from "@/lib/profileExperiencedUi";

export default function ProfileForm({
  username,
  empId,
  entryMode,
  onBack,
  submitTo,
  isPrivilegedEditor = true,
  initialData = null,
  reviewMode = false,
  resubmitSubmissionId = null,
  reassignFieldKeys = null,
}) {
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
      setIsExperienced(deriveIsExperiencedForForm(initialData));
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

        setIsExperienced(deriveIsExperiencedForForm(data.profile));
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const validateMandatoryDocumentsAndPhotos = () => {
    const MANDATORY_KEYS = [
      "doc_pan_card",
      "doc_aadhaar_card",
      "doc_electricity_bill",
      "doc_10th_certificate",
      "doc_12th_certificate",
    ];

    if (isExperienced) {
      MANDATORY_KEYS.push(
        "doc_appt_letter_prev",
        "doc_exp_letter",
        "doc_relieving_letter",
        "doc_salary_slips"
      );
    }

    const missingDocs = MANDATORY_KEYS.filter((key) => !documents[key]);
    if (missingDocs.length > 0) {
      toast.error(`Missing mandatory documents: ${missingDocs.length} required documents not selected.`);
      return false;
    }

    const ebType = documents.electricity_bill_proof_type;
    if (ebType !== "current" && ebType !== "permanent") {
      toast.error("Select whether the electricity bill is for Current or Permanent address.");
      return false;
    }

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

  const validateReassignForm = () => {
    const keys = reassignFieldKeys;
    if (!keys?.length) return true;

    for (const key of keys) {
      if (key === "section_references") {
        if (references.length < 3) {
          toast.error("Please provide at least 3 Reference Verification Details.");
          return false;
        }
        for (const ref of references) {
          if (
            !ref.name?.trim() ||
            !ref.contact?.trim() ||
            !ref.address?.trim() ||
            (ref.relationship !== "neighbours" && ref.relationship !== "relation")
          ) {
            toast.error("Please complete all details for references, including Relationship (Neighbours or Relation).");
            return false;
          }
        }
      } else if (key === "section_documents") {
        if (!validateMandatoryDocumentsAndPhotos()) return false;
      } else if (key === "section_education") {
        if (!education?.length) {
          toast.error("Add at least one education qualification.");
          return false;
        }
        for (const edu of education) {
          if (
            !edu.exam_name?.trim() ||
            !edu.board_university?.trim() ||
            !edu.year_of_passing?.trim() ||
            !edu.grade_percentage?.trim()
          ) {
            toast.error("Please complete all fields in each education row.");
            return false;
          }
        }
      } else if (key === "section_experience") {
        if (!isExperienced) continue;
        if (!experience?.length) {
          toast.error("Add at least one work experience entry.");
          return false;
        }
        for (const exp of experience) {
          if (
            !exp.company_name?.trim() ||
            !exp.designation?.trim() ||
            !exp.period_from ||
            !exp.period_to ||
            !exp.reason_for_leaving?.trim()
          ) {
            toast.error("Please complete all fields in each experience row.");
            return false;
          }
        }
      }
    }

    const granular = keys.filter((k) => !k.startsWith("section_"));
    for (const k of granular) {
      if (k === "is_experienced") continue;
      const v = formData[k];
      if (v == null || String(v).trim() === "") {
        toast.error(`${labelForReassignKey(k)} is required.`);
        return false;
      }
    }

    return true;
  };

  const validateForm = () => {
    if (isReassignFieldMode(reassignFieldKeys)) {
      return validateReassignForm();
    }

    if (references.length < 3) {
      toast.error("Please provide at least 3 Reference Verification Details.");
      return false;
    }
    for (const ref of references) {
      if (
        !ref.name?.trim() ||
        !ref.contact?.trim() ||
        !ref.address?.trim() ||
        (ref.relationship !== "neighbours" && ref.relationship !== "relation")
      ) {
        toast.error("Please complete all details for references, including Relationship (Neighbours or Relation).");
        return false;
      }
    }

    if (!education?.length) {
      toast.error("Add at least one education qualification.");
      return false;
    }
    for (const edu of education) {
      if (
        !edu.exam_name?.trim() ||
        !edu.board_university?.trim() ||
        !edu.year_of_passing?.trim() ||
        !edu.grade_percentage?.trim()
      ) {
        toast.error("Please complete all fields in each education row.");
        return false;
      }
    }

    if (!validateMandatoryDocumentsAndPhotos()) {
      return false;
    }

    if (isExperienced) {
      if (!experience?.length) {
        toast.error("Add at least one work experience entry.");
        return false;
      }
      for (const exp of experience) {
        if (
          !exp.company_name?.trim() ||
          !exp.designation?.trim() ||
          !exp.period_from ||
          !exp.period_to ||
          !exp.reason_for_leaving?.trim()
        ) {
          toast.error("Please complete each work experience row, including Reason for Leaving.");
          return false;
        }
      }
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

      if (resubmitSubmissionId) {
        submitData.append("resubmitSubmissionId", String(resubmitSubmissionId));
      }

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

  const handleFormSubmit = (e) => {
    if (reviewMode) {
      e.preventDefault();
      return;
    }
    handleSubmit(e);
  };

  /** HR review always shows the full profile; reassign-only hiding is for the employee edit screen only. */
  const fieldVisibilityKeys = reviewMode ? null : reassignFieldKeys;
  const reassignMode = !reviewMode && isReassignFieldMode(reassignFieldKeys);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {!reviewMode && (
        <button type="button" onClick={onBack} className="text-blue-600 hover:text-blue-800 mb-4">
          ← Back
        </button>
      )}

      {reassignMode && (
        <p className="text-sm text-gray-600 mb-4">
          Account: <span className="font-medium">{formData.username || username}</span>
          {(formData.employee_code || formData.empId || empId) && (
            <>
              {" "}
              · Employee ID:{" "}
              <span className="font-medium">{formData.employee_code || formData.empId || empId}</span>
            </>
          )}
        </p>
      )}

      <form onSubmit={handleFormSubmit} className="space-y-6">
        {shouldShowPersonalBlock(fieldVisibilityKeys) && (
          <PersonalInfoSection
            formData={formData}
            setFormData={setFormData}
            isPrivilegedEditor={isPrivilegedEditor}
            isExperienced={isExperienced}
            setIsExperienced={setIsExperienced}
            reviewMode={reviewMode}
            reassignFieldKeys={fieldVisibilityKeys}
          />
        )}

        {shouldShowBankingBlock(fieldVisibilityKeys) && (
          <BankingSection
            formData={formData}
            setFormData={setFormData}
            reviewMode={reviewMode}
            reassignFieldKeys={fieldVisibilityKeys}
          />
        )}

        {shouldShowEducationSection(fieldVisibilityKeys) && (
          <EducationSection education={education} setEducation={setEducation} reviewMode={reviewMode} />
        )}

        {isExperienced && shouldShowExperienceSection(fieldVisibilityKeys) && (
          <ExperienceSection experience={experience} setExperience={setExperience} reviewMode={reviewMode} />
        )}

        {shouldShowReferencesSection(fieldVisibilityKeys) && (
          <ReferencesSection references={references} setReferences={setReferences} reviewMode={reviewMode} />
        )}

        {shouldShowDocumentsSection(fieldVisibilityKeys) && (
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
          reviewMode={reviewMode}
        />
        )}

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
