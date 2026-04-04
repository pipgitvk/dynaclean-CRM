import DocumentsSection from "./DocumentsSection";

/**
 * Employment & HR + Confidentiality & company policy uploads — intended for HR only
 * (employees use isPrivilegedEditor=false and do not see this card).
 */
export default function HrDetailsSection({
  reviewMode = false,
  /** True while submission is in pending_hr_docs — HR may edit uploads. */
  pendingEmployeeSectionsApproved = false,
  /** Submission still pending first HR approval — uploads locked until employee sections are approved. */
  awaitingEmployeeSectionApprove = false,
  documentsSectionProps,
}) {
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/85 p-5 md:p-6 shadow-sm space-y-4">
      <div className="pb-2 border-b border-indigo-200/80">
        <h3 className="text-lg font-semibold text-gray-800">HR Details</h3>
        <p className="text-sm text-indigo-900/80 mt-1">
          {awaitingEmployeeSectionApprove
            ? "Approve employee sections (green button at the top) first. Then you can upload Employment & HR and policy documents here and send the request to Super Admin."
            : pendingEmployeeSectionsApproved
              ? "Upload Employment & HR and confidentiality / policy documents, then use Send to Super Admin below."
              : reviewMode
                ? "Employment & HR and confidentiality / policy documents for this profile."
                : "Only HR completes this section — employment & HR documents and confidentiality / company policy."}
        </p>
      </div>
      {awaitingEmployeeSectionApprove && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
          Uploads are locked until employee sections are approved.
        </div>
      )}
      <DocumentsSection
        {...documentsSectionProps}
        categoryMode="hr_details_only"
        embedded
        embeddedAccent="indigo"
        htmlIdPrefix="hr_"
      />
    </div>
  );
}
