"use client";

import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProfileForm from "@/app/empcrm/admin-dashboard/profile/ProfileForm";
import ReassignFieldsModal from "@/app/empcrm/admin-dashboard/profile/approvals/ReassignFieldsModal";
import { Check, X, ListChecks } from "lucide-react";
import toast from "react-hot-toast";
import { buildProfileSubmissionInitialData, mergeSubmissionInitialWithLiveProfile } from "@/lib/buildProfileSubmissionInitialData";
import { labelForReassignKey } from "@/lib/profileReassignFields";
import { parseReassignKeys } from "@/lib/reassignFieldVisibility";

export default function SubmissionDetailsPage({ params }) {
    const { id } = use(params);
    const searchParams = useSearchParams();
    const fromAdminQueue = searchParams.get("from") === "admin";

    const router = useRouter();
    const [sessionRole, setSessionRole] = useState("");
    const [sessionUsername, setSessionUsername] = useState("");
    const [submission, setSubmission] = useState(null);
    const [reviewInitialData, setReviewInitialData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [reassignOpen, setReassignOpen] = useState(false);
    const [reassignSubmitting, setReassignSubmitting] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const me = await fetch("/api/me", { credentials: "include", cache: "no-store" });
                const meJson = await me.json();
                const r = meJson?.user?.role ?? meJson?.role ?? "";
                setSessionRole(typeof r === "string" ? r : "");
                const u = meJson?.user?.username ?? meJson?.username;
                setSessionUsername(typeof u === "string" ? u : "");
            } catch {
                setSessionRole("");
            }
        })();
    }, []);

    useEffect(() => {
        if (!id) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
        (async () => {
            try {
                const res = await fetch(`/api/empcrm/profile/submissions?id=${id}`, {
                    signal: controller.signal,
                    credentials: "include",
                    cache: "no-store",
                });
                if (cancelled) return;
                const data = await res.json();
                if (res.status === 403) {
                    toast.error(data.error || "Access denied");
                    setSubmission(null);
                    setReviewInitialData(null);
                    return;
                }
                if (!data.success || !data.submissions?.length) {
                    toast.error("Submission not found");
                    setSubmission(null);
                    setReviewInitialData(null);
                    return;
                }
                const sub = data.submissions[0];
                const built = buildProfileSubmissionInitialData(sub);
                if (!built.initialData) {
                    toast.error("Invalid submission data");
                    setSubmission(sub);
                    setReviewInitialData(null);
                    return;
                }
                let liveJson = null;
                try {
                    const pr = await fetch(
                        `/api/empcrm/profile?username=${encodeURIComponent(sub.username)}`,
                        { credentials: "include", cache: "no-store", signal: controller.signal }
                    );
                    liveJson = await pr.json();
                } catch {
                    liveJson = null;
                }
                const merged = mergeSubmissionInitialWithLiveProfile(built.initialData, liveJson);
                if (!cancelled) {
                    setSubmission(sub);
                    setReviewInitialData(merged);
                }
            } catch (e) {
                if (!cancelled) {
                    toast.error(e.name === "AbortError" ? "Request timed out" : "Error loading submission");
                    setSubmission(null);
                    setReviewInitialData(null);
                }
            } finally {
                clearTimeout(timeoutId);
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; controller.abort(); };
    }, [id]);

    const refreshSubmissionFromServer = async () => {
        const res = await fetch(`/api/empcrm/profile/submissions?id=${encodeURIComponent(id)}`, {
            credentials: "include",
            cache: "no-store",
        });
        const data = await res.json();
        if (!data.success || !data.submissions?.length) return false;
        const sub = data.submissions[0];
        const built = buildProfileSubmissionInitialData(sub);
        if (!built.initialData) return false;
        let liveJson = null;
        try {
            const pr = await fetch(
                `/api/empcrm/profile?username=${encodeURIComponent(sub.username)}`,
                { credentials: "include", cache: "no-store" }
            );
            liveJson = await pr.json();
        } catch {
            liveJson = null;
        }
        const merged = mergeSubmissionInitialWithLiveProfile(built.initialData, liveJson);
        setSubmission(sub);
        setReviewInitialData(merged);
        return true;
    };

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
                toast.success(data.message || `Profile ${action}ed successfully`);
                if (action === "approve") {
                    const st = String(submission?.status ?? "").trim().toLowerCase();
                    const stayOnPageForHrDocs =
                        st === "pending" ||
                        (st === "" && submission?.reviewed_at);
                    if (stayOnPageForHrDocs) {
                        const ok = await refreshSubmissionFromServer();
                        if (!ok) toast.error("Could not refresh; reload the page to continue with HR documents.");
                        return;
                    }
                }
                const back =
                    fromAdminQueue || submission?.status === "pending_admin"
                        ? "/empcrm/admin-dashboard/profile/approvals-admin"
                        : "/empcrm/admin-dashboard/profile/approvals";
                router.push(back);
            } else {
                toast.error(data.error || `Failed to ${action}`);
            }
        } catch (e) {
            toast.error(`Error processing request`);
        }
    };

    const handleReassignConfirm = async (payload) => {
        setReassignSubmitting(true);
        try {
            const res = await fetch("/api/empcrm/profile/submissions", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    submissionId: id,
                    action: "reassign",
                    fields: payload.fields,
                    reassignment_note: payload.reassignment_note,
                    reassign_target: payload.reassign_target,
                    assignee_username: payload.assignee_username,
                }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message || "Updated");
                setReassignOpen(false);
                router.push(
                    fromAdminQueue
                        ? "/empcrm/admin-dashboard/profile/approvals-admin"
                        : "/empcrm/admin-dashboard/profile/approvals"
                );
            } else {
                toast.error(data.error || "Failed to reassign");
            }
        } catch (e) {
            toast.error("Error sending reassignment");
        } finally {
            setReassignSubmitting(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading submission details...</div>;
    if (!submission) {
        return (
            <div className="p-8 text-center text-red-500">
                Submission not found, or you do not have access to this request.
            </div>
        );
    }

    if (!reviewInitialData) {
        return <div className="p-8 text-center text-red-500">Invalid submission data</div>;
    }

    const initialData = reviewInitialData;

    let stNorm = String(submission.status ?? "").trim().toLowerCase();
    const statusWasCorruptBlank =
        !stNorm &&
        submission.reviewed_at &&
        (submission.rejection_reason == null || String(submission.rejection_reason).trim() === "");
    if (statusWasCorruptBlank) {
        stNorm = "pending_hr_docs";
    }
    const isPending = stNorm === "pending";
    const isPendingHrDocs = stNorm === "pending_hr_docs";
    const isPendingAdmin = stNorm === "pending_admin";
    const isReassign = stNorm === "reassign" || stNorm === "revision_requested";
    const isSuperAdmin = String(sessionRole || "").trim().toUpperCase() === "SUPERADMIN";
    const assignedTo =
        typeof submission.pending_assignee_username === "string" ? submission.pending_assignee_username.trim() : "";
    const roleLower = String(sessionRole || "").trim().toLowerCase();
    const isHrHeadOrSuper = roleLower === "superadmin" || roleLower === "hr head";
    const canActPending =
        !isPending ||
        !assignedTo ||
        isHrHeadOrSuper ||
        (sessionUsername && assignedTo.toLowerCase() === sessionUsername.trim().toLowerCase());
    const showHrActions = isPending && canActPending;
    const showHrRejectOnly = isPendingHrDocs && canActPending;
    const showAdminActions = isPendingAdmin && isSuperAdmin;

    const reassignKeys = parseReassignKeys(submission.reassigned_fields);
    const reassignNote =
        typeof submission.reassignment_note === "string" ? submission.reassignment_note.trim() : "";
    const showReassignSummary = (reassignKeys?.length ?? 0) > 0 || reassignNote.length > 0;

    return (
        <div className="p-6 max-w-7xl mx-auto pb-24">
            <ReassignFieldsModal
                open={reassignOpen}
                onClose={() => !reassignSubmitting && setReassignOpen(false)}
                onConfirm={handleReassignConfirm}
                submitting={reassignSubmitting}
            />
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10 py-4 border-b">
                <div>
                    <button
                        type="button"
                        onClick={() =>
                            router.push(
                                fromAdminQueue
                                    ? "/empcrm/admin-dashboard/profile/approvals-admin"
                                    : "/empcrm/admin-dashboard/profile/approvals"
                            )
                        }
                        className="text-gray-500 hover:text-gray-700 text-sm mb-1"
                    >
                        &larr; Back to List
                    </button>
                    <h1 className="text-2xl font-bold text-gray-800">Review Request: {submission.username}</h1>
                    <p className="text-sm mt-1">
                        <span className="font-medium text-gray-600">Status: </span>
                        <span
                            className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                                stNorm === "approved"
                                    ? "bg-green-100 text-green-800"
                                    : stNorm === "rejected"
                                      ? "bg-red-100 text-red-800"
                                        : isPendingAdmin
                                        ? "bg-violet-100 text-violet-900"
                                        : isPendingHrDocs
                                          ? "bg-indigo-100 text-indigo-900"
                                        : isReassign
                                          ? "bg-amber-100 text-amber-900"
                                          : "bg-blue-100 text-blue-800"
                            }`}
                        >
                            {stNorm === "revision_requested"
                                ? "reassign"
                                : stNorm === "pending_admin"
                                  ? "awaiting super admin"
                                  : stNorm === "pending_hr_docs"
                                    ? "HR documents"
                                    : stNorm === "pending"
                                      ? "pending"
                                      : stNorm || "—"}
                        </span>
                    </p>
                    {isPending && assignedTo ? (
                        <p className="text-sm text-amber-800 mt-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
                            {canActPending
                                ? isHrHeadOrSuper
                                    ? `Delegated to HR: @${assignedTo} — you can act as HR Head / Super Admin.`
                                    : `Assigned to you (@${assignedTo}) for review.`
                                : `Assigned to @${assignedTo}. You can view only.`}
                        </p>
                    ) : null}
                </div>
                {showHrActions && (
                    <div className="flex flex-wrap gap-2 justify-end">
                        <button
                            type="button"
                            onClick={() => setReassignOpen(true)}
                            className="px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 flex items-center gap-2 font-medium"
                        >
                            Reassign fields
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAction("reject", prompt("Rejection Reason:") || "")}
                            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2 font-medium"
                        >
                            <X className="w-4 h-4" /> Reject
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAction("approve")}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2 font-medium"
                        >
                            <Check className="w-4 h-4" /> Approve employee sections
                        </button>
                    </div>
                )}
                {showHrRejectOnly && (
                    <div className="flex flex-wrap gap-2 justify-end">
                        <button
                            type="button"
                            onClick={() => handleAction("reject", prompt("Rejection Reason:") || "")}
                            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2 font-medium"
                        >
                            <X className="w-4 h-4" /> Reject
                        </button>
                    </div>
                )}
                {showAdminActions && (
                    <div className="flex flex-wrap gap-2 justify-end">
                        <button
                            type="button"
                            onClick={() => handleAction("reject", prompt("Rejection Reason:") || "")}
                            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2 font-medium"
                        >
                            <X className="w-4 h-4" /> Reject
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAction("approve")}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2 font-medium"
                        >
                            <Check className="w-4 h-4" /> Publish profile
                        </button>
                    </div>
                )}
            </div>

            {statusWasCorruptBlank && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-950 text-sm shadow-sm">
                    <p className="font-semibold">Database status was empty</p>
                    <p className="mt-1">
                        The UI is treating this request as the <strong>HR documents</strong> step. If uploads or Send to
                        Super Admin fail, run{" "}
                        <code className="text-xs bg-red-100 px-1 rounded">
                            migration_submissions_status_varchar.sql
                        </code>{" "}
                        then{" "}
                        <code className="text-xs bg-red-100 px-1 rounded">
                            migration_repair_blank_submission_status.sql
                        </code>{" "}
                        (or reload this page after the API auto-repair runs).
                    </p>
                </div>
            )}

            {showReassignSummary && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm">
                    <div className="flex gap-2 font-semibold text-sm text-amber-900">
                        <ListChecks className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
                        <span>Fields you sent back for correction</span>
                    </div>
                    {reassignKeys && reassignKeys.length > 0 && (
                        <ul className="mt-2 list-disc pl-8 text-sm text-amber-900/90 space-y-0.5">
                            {reassignKeys.map((k) => (
                                <li key={k}>{labelForReassignKey(k)}</li>
                            ))}
                        </ul>
                    )}
                    {reassignNote.length > 0 && (
                        <p className="mt-3 text-sm border-t border-amber-200/80 pt-3 text-amber-900/90">
                            <span className="font-medium">Note to employee: </span>
                            {reassignNote}
                        </p>
                    )}
                </div>
            )}

            <div
                className={`border-l-4 p-4 mb-6 rounded-r ${
                    stNorm === "approved"
                        ? "bg-green-50 border-green-500"
                        : stNorm === "rejected"
                          ? "bg-red-50 border-red-400"
                          : isPendingAdmin
                            ? "bg-violet-50 border-violet-400"
                            : isPendingHrDocs
                              ? "bg-indigo-50 border-indigo-400"
                            : "bg-blue-50 border-blue-400"
                }`}
            >
                {stNorm === "approved" && (
                    <>
                        <p className="text-sm text-green-900 font-medium">This profile submission was approved.</p>
                        {submission.reviewed_at && (
                            <p className="text-xs text-green-800 mt-1">
                                Reviewed: {new Date(submission.reviewed_at).toLocaleString()}
                                {submission.reviewed_by ? ` · by ${submission.reviewed_by}` : ""}
                            </p>
                        )}
                    </>
                )}
                {stNorm === "rejected" && (
                    <>
                        <p className="text-sm text-red-900 font-medium">This submission was rejected.</p>
                        {submission.rejection_reason && (
                            <p className="text-xs text-red-800 mt-1">Reason: {submission.rejection_reason}</p>
                        )}
                    </>
                )}
                {isPendingAdmin && !isSuperAdmin && (
                    <p className="text-sm text-violet-900 font-medium">
                        HR has approved this submission. Final publish is pending Super Admin.
                    </p>
                )}
                {isPendingAdmin && isSuperAdmin && (
                    <p className="text-sm text-violet-900">
                        <strong>Super Admin:</strong> Verify details and documents below, then publish to merge into the employee profile.
                    </p>
                )}
                {isPendingHrDocs && (
                    <p className="text-sm text-indigo-900 font-medium">
                        <strong>HR step:</strong> Employee sections are approved. Complete <strong>HR Details</strong> below,
                        then click <strong>Send to Super Admin</strong>.
                    </p>
                )}
                {(isPending || isReassign) && !isPendingAdmin && !isPendingHrDocs && (
                    <p className="text-sm text-blue-700">
                        <strong>Review Note:</strong> Please verify all details and documents below. HR-only documents
                        appear after you approve employee sections.
                    </p>
                )}
                <p className="text-xs text-gray-600 mt-1">Submitted: {new Date(submission.submitted_at).toLocaleString()}</p>
            </div>

            <div className="opacity-100 mb-8">
                <ProfileForm
                    key={`review-${submission.id}-${stNorm}`}
                    username={submission.username}
                    empId={submission.empId}
                    onBack={() => { }}
                    isPrivilegedEditor={true}
                    initialData={initialData}
                    reviewMode={true}
                    submissionReviewContext={{ id: submission.id, status: stNorm }}
                    onAfterHrForwardToAdmin={() => {
                        const back = fromAdminQueue
                            ? "/empcrm/admin-dashboard/profile/approvals-admin"
                            : "/empcrm/admin-dashboard/profile/approvals";
                        router.push(back);
                    }}
                />
            </div>

            {/* Debug Info */}
            <div className="mt-8 p-4 bg-gray-100 rounded border border-gray-300">
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Debug Info (Detected Documents)</h4>
                <p className="text-xs text-gray-600 mb-2">If documents are not showing above, please check if they are listed here:</p>
                <pre className="text-xs bg-white p-2 border rounded overflow-auto h-32">
                    {JSON.stringify(initialData.fileUrls || {}, null, 2)}
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
