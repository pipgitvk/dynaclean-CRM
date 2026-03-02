"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProfileForm from "@/app/empcrm/admin-dashboard/profile/ProfileForm";
import { Check, X, Eye } from "lucide-react";
import toast from "react-hot-toast";

export default function SubmissionDetailsPage({ params }) {
    // Next.js 15+: params is a Promise, must use use() to unwrap
    const { id } = use(params);

    const router = useRouter();
    const [submission, setSubmission] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                const res = await fetch(`/api/empcrm/profile/submissions?id=${id}&status=pending`);
                const data = await res.json();
                if (data.success && data.submissions?.length > 0) {
                    setSubmission(data.submissions[0]);
                } else {
                    toast.error("Submission not found");
                    // setTimeout(() => router.push("/empcrm/admin-dashboard/profile/approvals"), 2000);
                }
            } catch (e) {
                toast.error("Error loading submission");
            } finally {
                setLoading(false);
            }
        })();
    }, [id, router]);

    const handleAction = async (action, reason = "") => {
        if (!confirm(`Are you sure you want to ${action} this profile?`)) return;
        try {
            const res = await fetch("/api/empcrm/profile/submissions", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ submissionId: id, action, rejection_reason: reason }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Profile ${action}ed successfully`);
                router.push("/empcrm/admin-dashboard/profile/approvals");
            } else {
                toast.error(data.error || `Failed to ${action}`);
            }
        } catch (e) {
            toast.error(`Error processing request`);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading submission details...</div>;
    if (!submission) return <div className="p-8 text-center text-red-500">Submission not found</div>;

    const payload = submission.payload ? JSON.parse(submission.payload) : {};

    // Parse uploaded files to map keys to URLs for the viewer
    const fileUrls = {};
    const uploadedFiles = submission.uploaded_files ? JSON.parse(submission.uploaded_files) : [];
    uploadedFiles.forEach(url => {
        // url format: /employee_profiles/username/filename
        const filename = url.split('/').pop();
        // Filename format: key_TIMESTAMP.ext or key_TIMESTAMP (no ext)
        // Regex: capture anything before the last underscore + digits + optional extension
        // We look for key_digits
        // Example: doc_pan_card_1234.png -> matches. 1=doc_pan_card
        const match = filename.match(/^(.*)_\d+(?:\.[^.]+)?$/);
        if (match) {
            fileUrls[match[1]] = url;
        } else {
            // Fallback: try removing just extension and then split by last _
            // This is risky if key has no digits, but let's just log it if needed.
            console.warn("Could not parse key from filename:", filename);
        }
    });

    // Photo and Signature are usually in payload.data or handled separately?
    // route.js lines 115, 125: data.profile_photo = url.
    // So payload.data.profile_photo IS the URL.
    // We don't need to put them in fileUrls map for DocumentsSection special logic,
    // but existingPhotoUrl prop handles them.

    const initialData = {
        ...payload.data,
        references: payload.references,
        education: payload.education,
        experience: payload.experience,
        documents_submitted: payload.data.documents_submitted ? JSON.parse(payload.data.documents_submitted) : {},
        fileUrls: fileUrls // Pass mapped URLs
    };

    return (
        <div className="p-6 max-w-7xl mx-auto pb-24">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10 py-4 border-b">
                <div>
                    <button onClick={() => router.push("/empcrm/admin-dashboard/profile/approvals")} className="text-gray-500 hover:text-gray-700 text-sm mb-1">
                        &larr; Back to List
                    </button>
                    <h1 className="text-2xl font-bold text-gray-800">Review Request: {submission.username}</h1>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={() => handleAction("reject", prompt("Rejection Reason:") || "")}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2 font-medium"
                    >
                        <X className="w-4 h-4" /> Reject
                    </button>
                    <button
                        onClick={() => handleAction("approve")}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2 font-medium"
                    >
                        <Check className="w-4 h-4" /> Approve
                    </button>
                </div>
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6 rounded-r">
                <p className="text-sm text-blue-700">
                    <strong>Review Note:</strong> Please verify all details and documents below. You can view uploaded documents by clicking the "View" buttons in the Documents section.
                </p>
                <p className="text-xs text-blue-500 mt-1">Submitted: {new Date(submission.submitted_at).toLocaleString()}</p>
            </div>

            <div className="opacity-100 mb-8">
                {/* pointer-events-none removed to allow clicking view button. 
                    ReviewMode hides Save button. We rely on readOnly props (to be implemented) or just reliance on no-save action. 
                */}
                <ProfileForm
                    username={submission.username}
                    empId={submission.empId}
                    onBack={() => { }} // No back button inside form needed as we have outer back
                    isPrivilegedEditor={true}
                    initialData={initialData}
                    reviewMode={true}
                />
            </div>

            {/* Debug Info */}
            <div className="mt-8 p-4 bg-gray-100 rounded border border-gray-300">
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Debug Info (Detected Documents)</h4>
                <p className="text-xs text-gray-600 mb-2">If documents are not showing above, please check if they are listed here:</p>
                <pre className="text-xs bg-white p-2 border rounded overflow-auto h-32">
                    {JSON.stringify(fileUrls, null, 2)}
                </pre>
                <p className="text-xs text-gray-600 mt-2">Raw Uploads: {submission.uploaded_files}</p>
                <h4 className="text-xs font-bold text-gray-500 uppercase mt-4 mb-2">Debug Info (References in Payload)</h4>
                <pre className="text-xs bg-white p-2 border rounded overflow-auto h-32">
                    {JSON.stringify(initialData.references || [], null, 2)}
                </pre>
            </div>
        </div>
    );
}