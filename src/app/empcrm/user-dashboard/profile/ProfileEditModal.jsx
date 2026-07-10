"use client";

import { useState } from "react";
import { X } from "lucide-react";
import ProfileForm from "@/app/empcrm/admin-dashboard/profile/ProfileForm";
import { buildProfileSubmissionInitialData } from "@/lib/buildProfileSubmissionInitialData";
import { parseReassignKeys } from "@/lib/reassignFieldVisibility";

export default function ProfileEditModal({ 
  isOpen, 
  onClose, 
  profile, 
  username, 
  empId,
  onAfterSubmit,
  latestSubmission = null
}) {
  if (!isOpen) return null;

  const handleBack = () => {
    onClose();
  };

  const handleAfterSubmit = () => {
    onAfterSubmit?.();
    onClose();
  };

  // Build initial data from latest submission if it's a revision request
  const isRevision = latestSubmission?.status === "reassign" || latestSubmission?.status === "revision_requested";
  const revisionInitial = isRevision
    ? buildProfileSubmissionInitialData(latestSubmission)
    : { initialData: null };
  const initialData = revisionInitial.initialData;

  const reassignFieldKeys = parseReassignKeys(latestSubmission?.reassigned_fields);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Edit Profile</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form Content */}
        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4">
            Your changes will be sent to HR for approval.
          </p>
          
          <ProfileForm
            username={username}
            empId={empId}
            entryMode="manual"
            onBack={handleBack}
            submitTo="/api/empcrm/profile/submissions"
            isPrivilegedEditor={false}
            initialData={initialData || profile}
            reviewMode={false}
            resubmitSubmissionId={isRevision && latestSubmission?.id ? latestSubmission.id : null}
            reassignFieldKeys={reassignFieldKeys}
            submissionReviewContext={null}
            onAfterHrForwardToAdmin={handleAfterSubmit}
          />
        </div>
      </div>
    </div>
  );
}
