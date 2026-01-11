"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function EmpCrmRootPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to appropriate dashboard based on user role
    // This will be handled by middleware or we can fetch user role here
    // For now, redirect to admin dashboard
    router.push("/empcrm/admin-dashboard");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">Redirecting to Employee CRM...</p>
      </div>
    </div>
  );
}
