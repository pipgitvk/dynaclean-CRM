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
      <div className="bg-gradient-to-br from-teal-400 via-cyan-400 to-sky-500 rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-4 md:p-6 text-white cursor-pointer hover:shadow-xl transition-all">
        <div className="flex flex-col h-full justify-between min-h-[160px]">
          <div>
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white leading-tight tracking-tight">
                <span className="block">Profile</span>
                <span className="block">Approvals</span>
              </h2>
            </div>
            <p className="text-2xl sm:text-3xl md:text-4xl font-bold">
              {loading ? "..." : pendingCount}
            </p>
            <p className="mt-1 text-sm sm:text-base font-semibold text-white/90">
              Pending approvals
            </p>
          </div>
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/20">
            <button className="px-4 py-2 bg-white text-teal-600 rounded-lg font-bold text-sm sm:text-base hover:bg-gray-100 transition-colors shadow-lg hover:scale-105 transform duration-200">
              Review Profiles →
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
