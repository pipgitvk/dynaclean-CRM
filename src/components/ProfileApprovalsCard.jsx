"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shield } from "lucide-react";

export default function ProfileApprovalsCard() {
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingApprovalsCount();
  }, []);

  const fetchPendingApprovalsCount = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        "/api/empcrm/profile/submissions?status=pending_admin",
        {
          credentials: "include",
          cache: "no-store",
        }
      );
      const data = await res.json();
      if (data.success) {
        setPendingCount(data.submissions?.length || 0);
      } else {
        setPendingCount(0);
      }
    } catch (e) {
      console.error("Error fetching pending approvals count:", e);
      setPendingCount(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Link href="/empcrm/admin-dashboard/profile/approvals-admin">
      <div className="bg-white rounded-lg shadow-md p-4 text-black cursor-pointer hover:shadow-lg transition-shadow h-full border-l-4 border-teal-500 min-h-[140px]">
        <div className="flex flex-col h-full justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-teal-500 shrink-0" />
              <h2 className="text-sm font-bold text-black leading-tight">
                Profile Approvals
              </h2>
            </div>
            <p className={`text-2xl font-bold mt-1 ${pendingCount === 0 ? 'text-green-600' : 'text-red-600'}`}>
              {loading ? "..." : pendingCount}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              Pending approvals
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
