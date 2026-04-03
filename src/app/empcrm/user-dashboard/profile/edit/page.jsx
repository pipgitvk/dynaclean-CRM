"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProfileForm from "@/app/empcrm/admin-dashboard/profile/ProfileForm";
import { Loader2, AlertCircle } from "lucide-react";
import { buildProfileSubmissionInitialData } from "@/lib/buildProfileSubmissionInitialData";
import { labelForReassignKey } from "@/lib/profileReassignFields";
import { parseReassignKeys } from "@/lib/reassignFieldVisibility";

export default function EditMyProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [revisionSubmission, setRevisionSubmission] = useState(null);
  const [revisionLoading, setRevisionLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { credentials: "include", cache: "no-store" });
        const data = await res.json();
        if (data?.success && data.user) {
          setUser(data.user);
        } else if (data && data.username) {
          setUser(data);
        }
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!user) {
      setRevisionLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/empcrm/profile/submissions?mine=latest", {
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json();
        if (data.success && data.submissions?.length > 0) {
          const sub = data.submissions[0];
          setRevisionSubmission(sub.status === "reassign" || sub.status === "revision_requested" ? sub : null);
        } else {
          setRevisionSubmission(null);
        }
      } catch (e) {
        // ignore
      } finally {
        setRevisionLoading(false);
      }
    })();
  }, [user]);

  if (loading || revisionLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center text-red-700">
          Unable to load user session. Please login again.
        </div>
      </div>
    );
  }

  const revisionInitial = revisionSubmission
    ? buildProfileSubmissionInitialData(revisionSubmission)
    : { initialData: null };
  const initialData = revisionInitial.initialData;

  const reassignFieldKeys = parseReassignKeys(revisionSubmission?.reassigned_fields);

  let reassignedLabels = [];
  if (reassignFieldKeys?.length) {
    reassignedLabels = reassignFieldKeys.map((k) => labelForReassignKey(k));
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Complete / Update My Profile</h1>
      {revisionSubmission ? (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <div className="flex gap-2 font-semibold">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>HR has requested corrections on your profile submission</span>
          </div>
          {reassignedLabels.length > 0 && (
            <ul className="mt-2 list-disc pl-8 text-sm">
              {reassignedLabels.map((label, idx) => (
                <li key={`${label}-${idx}`}>{label}</li>
              ))}
            </ul>
          )}
          {revisionSubmission.reassignment_note && (
            <p className="mt-2 text-sm border-t border-amber-200 pt-2">
              <span className="font-medium">Note from HR: </span>
              {revisionSubmission.reassignment_note}
            </p>
          )}
          <p className="mt-2 text-sm">Update the required sections below and submit again for approval.</p>
        </div>
      ) : (
        <p className="text-sm text-gray-600 mb-6">Your changes will be sent to HR for approval.</p>
      )}
      <ProfileForm
        username={user.username}
        empId={user.empId}
        entryMode={"manual"}
        submitTo="/api/empcrm/profile/submissions"
        onBack={() => router.push("/empcrm/user-dashboard/profile")}
        isPrivilegedEditor={false}
        initialData={initialData || undefined}
        resubmitSubmissionId={initialData && revisionSubmission?.id ? revisionSubmission.id : null}
        reassignFieldKeys={reassignFieldKeys}
      />
    </div>
  );
}
