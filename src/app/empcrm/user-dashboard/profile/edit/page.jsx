"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProfileForm from "@/app/empcrm/admin-dashboard/profile/ProfileForm";
import { Loader2 } from "lucide-react";

export default function EditMyProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/me');
        const data = await res.json();
        // Accept both shapes: { success, user } or raw user object
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

  if (loading) {
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

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Complete / Update My Profile</h1>
      <p className="text-sm text-gray-600 mb-6">Your changes will be sent to HR for approval.</p>
      <ProfileForm
        username={user.username}
        empId={user.empId}
        entryMode={"manual"}
        submitTo="/api/empcrm/profile/submissions"
        onBack={() => router.push("/empcrm/user-dashboard/profile")}
        isPrivilegedEditor={false}
      />
    </div>
  );
}
