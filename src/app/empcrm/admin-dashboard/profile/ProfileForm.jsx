"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Loader2, Save } from "lucide-react";
import PersonalInfoSection from "./sections/PersonalInfoSection";
import BankingDetailsSection from "./sections/BankingDetailsSection";
import EducationSection from "./sections/EducationSection";
import DocumentsSection from "./sections/DocumentsSection";
import HrDetailsSection from "./sections/HrDetailsSection";
import ReferencesSection from "./sections/ReferencesSection";
import {
  isReassignFieldMode,
  shouldShowPersonalBlock,
  shouldShowBankingDetailsCard,
  shouldShowEducationSection,
  shouldShowReferencesSection,
  shouldShowDocumentsSection,
} from "@/lib/reassignFieldVisibility";
import {
  EMPLOYEE_MANDATORY_DOCS_REASSIGN_KEYS,
  EXPERIENCE_COLUMN_KEYS,
  FORM_TOP_LEVEL_REASSIGN_KEYS,
  labelForReassignKey,
  QUALIFICATION_COLUMN_KEYS,
  REFERENCE_COLUMN_KEYS,
} from "@/lib/profileReassignFields";
import { deriveIsExperiencedForForm } from "@/lib/profileExperiencedUi";

function normalizeSubmissionStatus(status) {
  if (status == null || status === undefined) return "";
  return String(status).trim().toLowerCase();
}

/** File field keys in HR Details (Employment & HR + Confidentiality) — used when sending to Super Admin. */
const HR_DETAILS_DOC_KEYS = [
  "doc_loi_appointment",
  "doc_joining_form",
  "doc_emp_verification",
  "doc_code_conduct",
  "doc_nda",
  "doc_company_policy",
];

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
  /** When reviewing a submission: `{ id, status }` drives HR-only document workflow. */
  submissionReviewContext = null,
  onAfterHrForwardToAdmin = null,
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
    near_police_station: "",
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

    const needFullRefs = keys.includes("section_references");
    const needAnyRefCol = keys.some((k) => REFERENCE_COLUMN_KEYS.has(k));

    if (needFullRefs) {
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
    } else if (needAnyRefCol) {
      if (references.length < 3) {
        toast.error("Please provide at least 3 Reference Verification Details.");
        return false;
      }
      for (const ref of references) {
        if (keys.includes("reference_name") && !ref.name?.trim()) {
          toast.error("Reference Name is required.");
          return false;
        }
        if (keys.includes("reference_contact") && !ref.contact?.trim()) {
          toast.error("Contact Number is required for each reference.");
          return false;
        }
        if (keys.includes("reference_address") && !ref.address?.trim()) {
          toast.error("Address is required for each reference.");
          return false;
        }
        if (
          keys.includes("reference_relationship") &&
          ref.relationship !== "neighbours" &&
          ref.relationship !== "relation"
        ) {
          toast.error("Select Relationship (Neighbours or Relation) for each reference.");
          return false;
        }
      }
    }

    if (keys.includes("section_documents")) {
      if (!validateMandatoryDocumentsAndPhotos()) return false;
    } else {
      const docKeys = keys.filter((k) => EMPLOYEE_MANDATORY_DOCS_REASSIGN_KEYS.has(k));
      for (const dk of docKeys) {
        if (dk === "profile_photo") {
          if (!(files.profile_photo || formData.profile_photo)) {
            toast.error("Passport size photograph is required.");
            return false;
          }
          continue;
        }
        if (dk === "signature") {
          if (!(files.signature || formData.signature)) {
            toast.error("Signature is required.");
            return false;
          }
          continue;
        }
        const hasDoc = documents[dk] || files[dk] || formData.fileUrls?.[dk];
        if (!hasDoc) {
          toast.error(`${labelForReassignKey(dk)} is required.`);
          return false;
        }
        if (dk === "doc_electricity_bill") {
          const ebType = documents.electricity_bill_proof_type;
          if (ebType !== "current" && ebType !== "permanent") {
            toast.error("Select whether the electricity bill is for Current or Permanent address.");
            return false;
          }
        }
      }
    }

    const needEducationRows = keys.includes("section_education") || keys.some((k) => QUALIFICATION_COLUMN_KEYS.has(k));
    const needQualValidation = needEducationRows;
    if (needQualValidation) {
      if (!education?.length) {
        toast.error("Add at least one education qualification.");
        return false;
      }
      const want = (col) => keys.includes("section_education") || keys.includes(col);
      for (const edu of education) {
        if (want("qualification_exam_name") && !edu.exam_name?.trim()) {
          toast.error("Exam/Degree is required in each education row.");
          return false;
        }
        if (want("qualification_board_university") && !edu.board_university?.trim()) {
          toast.error("Board/University is required in each education row.");
          return false;
        }
        if (want("qualification_year_of_passing") && !edu.year_of_passing?.trim()) {
          toast.error("Year of Passing is required in each education row.");
          return false;
        }
        if (want("qualification_grade_percentage") && !edu.grade_percentage?.trim()) {
          toast.error("Grade/Percentage is required in each education row.");
          return false;
        }
      }
    }

    const needExperienceRows =
      isExperienced && (keys.includes("section_experience") || keys.some((k) => EXPERIENCE_COLUMN_KEYS.has(k)));
    if (needExperienceRows) {
      if (!experience?.length) {
        toast.error("Add at least one work experience entry.");
        return false;
      }
      const expColRequired = (col) => {
        if (keys.includes(col)) return true;
        if (keys.includes("section_experience")) {
          return col !== "experience_gross_salary_ctc";
        }
        return false;
      };
      for (const exp of experience) {
        if (expColRequired("experience_company_name") && !exp.company_name?.trim()) {
          toast.error("Company Name is required in each experience row.");
          return false;
        }
        if (expColRequired("experience_designation") && !exp.designation?.trim()) {
          toast.error("Designation is required in each experience row.");
          return false;
        }
        if (expColRequired("experience_gross_salary_ctc") && (exp.gross_salary_ctc == null || String(exp.gross_salary_ctc).trim() === "")) {
          toast.error("Gross Salary (CTC) is required in each experience row.");
          return false;
        }
        if (expColRequired("experience_period_from") && !exp.period_from) {
          toast.error("Period From is required in each experience row.");
          return false;
        }
        if (expColRequired("experience_period_to") && !exp.period_to) {
          toast.error("Period To is required in each experience row.");
          return false;
        }
        if (expColRequired("experience_reason_for_leaving") && !exp.reason_for_leaving?.trim()) {
          toast.error("Reason for Leaving is required in each experience row.");
          return false;
        }
      }
    }

    const granularFlat = keys.filter((k) => FORM_TOP_LEVEL_REASSIGN_KEYS.has(k));
    for (const k of granularFlat) {
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

    if (!formData.permanent_address?.trim()) {
      toast.error("Permanent address is required.");
      return false;
    }
    if (!formData.near_police_station?.trim()) {
      toast.error("Near police station is required.");
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

  const handleHrForwardToAdmin = async () => {
    const subId = submissionReviewContext?.id;
    if (subId == null || String(subId).trim() === "") {
      toast.error("Missing submission");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("submissionId", String(subId));
      fd.append("documents_submitted", JSON.stringify(documents));
      for (const k of HR_DETAILS_DOC_KEYS) {
        if (files[k]) fd.append(k, files[k]);
      }
      const res = await fetch("/api/empcrm/profile/submissions/hr-supplement", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || "Failed to save HR documents");
        return;
      }
      const res2 = await fetch("/api/empcrm/profile/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ submissionId: subId, action: "forward_to_admin" }),
      });
      const data2 = await res2.json();
      if (!data2.success) {
        toast.error(data2.error || "Failed to send to Super Admin");
        return;
      }
      toast.success(data2.message || "Sent to Super Admin for final approval.");
      onAfterHrForwardToAdmin?.();
    } catch (err) {
      console.error(err);
      toast.error("Error sending to Super Admin");
    } finally {
      setLoading(false);
    }
  };

  /** HR review always shows the full profile; reassign-only hiding is for the employee edit screen only. */
  const fieldVisibilityKeys = reviewMode ? null : reassignFieldKeys;
  const reassignMode = !reviewMode && isReassignFieldMode(reassignFieldKeys);

  const educationVisible = shouldShowEducationSection(fieldVisibilityKeys);
  const documentsVisible = shouldShowDocumentsSection(fieldVisibilityKeys);
  const bankingCardVisible = shouldShowBankingDetailsCard(fieldVisibilityKeys, isExperienced);

  let mainDocumentsCategoryMode = "all";
  if (educationVisible && bankingCardVisible) {
    mainDocumentsCategoryMode = "excluding_education_banking_experience";
  } else if (educationVisible) {
    mainDocumentsCategoryMode = "excluding_education";
  } else if (bankingCardVisible) {
    mainDocumentsCategoryMode = "excluding_banking_experience";
  }

  const submissionStatus = normalizeSubmissionStatus(submissionReviewContext?.status);
  const hrDetailsEditable =
    reviewMode && submissionStatus === "pending_hr_docs" && isPrivilegedEditor;
  const hrDocumentsReadOnly = reviewMode && !hrDetailsEditable;
  const hrSectionAwaitingEmployeeApprove = reviewMode && submissionStatus === "pending";

  const documentsSectionProps = {
    documents,
    setDocuments,
    files,
    setFiles,
    existingDocs: Array.isArray(formData.joining_form_documents) ? formData.joining_form_documents : [],
    existingPhotoUrl: formData.profile_photo || "",
    existingSignatureUrl: formData.signature || "",
    isExperienced,
    fileUrls: formData.fileUrls || {},
    reviewMode,
    reassignFieldKeys: fieldVisibilityKeys,
  };

  const hrDocumentsSectionProps = {
    ...documentsSectionProps,
    reviewMode: hrDocumentsReadOnly,
  };

  // In submission review, always show HR card when we have workflow context (status may vary by DB casing).
  const showHrDetailsCard =
    isPrivilegedEditor &&
    documentsVisible &&
    (!reviewMode || submissionReviewContext != null);

  const documentsSectionEl =
    documentsVisible ? (
      <DocumentsSection
        {...documentsSectionProps}
        categoryMode={mainDocumentsCategoryMode}
        embedded={shouldShowPersonalBlock(fieldVisibilityKeys)}
        htmlIdPrefix=""
      />
    ) : null;

  const bankingDocumentsSlot =
    documentsVisible && bankingCardVisible ? (
      <DocumentsSection
        {...documentsSectionProps}
        categoryMode="banking_and_experience_docs_only"
        embedded
        embeddedAccent="amber"
        htmlIdPrefix="bank_"
      />
    ) : null;

  const qualificationDocumentsSlot =
    documentsVisible && educationVisible ? (
      <DocumentsSection
        {...documentsSectionProps}
        categoryMode="education_only"
        embedded
        htmlIdPrefix="qual_"
      />
    ) : null;

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
            documentsSlot={documentsSectionEl}
          />
        )}

        {!shouldShowPersonalBlock(fieldVisibilityKeys) && documentsSectionEl}

        {shouldShowEducationSection(fieldVisibilityKeys) && (
          <EducationSection
            education={education}
            setEducation={setEducation}
            reviewMode={reviewMode}
            reassignFieldKeys={fieldVisibilityKeys}
            qualificationDocumentsSlot={qualificationDocumentsSlot}
          />
        )}

        {shouldShowBankingDetailsCard(fieldVisibilityKeys, isExperienced) && (
          <BankingDetailsSection
            formData={formData}
            setFormData={setFormData}
            experience={experience}
            setExperience={setExperience}
            isExperienced={isExperienced}
            reviewMode={reviewMode}
            reassignFieldKeys={fieldVisibilityKeys}
            bankingDocumentsSlot={bankingDocumentsSlot}
          />
        )}

        {shouldShowReferencesSection(fieldVisibilityKeys) && (
          <ReferencesSection
            references={references}
            setReferences={setReferences}
            reviewMode={reviewMode}
            reassignFieldKeys={fieldVisibilityKeys}
          />
        )}

        {showHrDetailsCard && (
          <HrDetailsSection
            reviewMode={hrDocumentsReadOnly}
            pendingEmployeeSectionsApproved={hrDetailsEditable}
            awaitingEmployeeSectionApprove={hrSectionAwaitingEmployeeApprove}
            documentsSectionProps={hrDocumentsSectionProps}
          />
        )}

        {hrDetailsEditable && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/90 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-indigo-950">
              After uploading Employment & HR and policy documents above, send this request to Super Admin for final
              approval.
            </p>
            <button
              type="button"
              disabled={loading}
              onClick={handleHrForwardToAdmin}
              className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-semibold shadow-sm"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {loading ? "Sending…" : "Send to Super Admin"}
            </button>
          </div>
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
