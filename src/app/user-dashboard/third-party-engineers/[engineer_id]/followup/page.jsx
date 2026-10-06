"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import ThirdPartyEngineerFollowupPanel from "@/components/thirdParty/ThirdPartyEngineerFollowupPanel";
import { PhoneCall } from "lucide-react";
import { THIRD_PARTY_ENGINEERS_TABLE_HASH } from "@/lib/thirdPartyEngineersListReturn";

export default function ThirdPartyEngineerFollowupPage() {
  const params = useParams();
  const router = useRouter();
  const engineer_id = params.engineer_id;

  const [engineer, setEngineer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!engineer_id) return;
    (async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/third-party-engineers/${engineer_id}`);
        if (response.status === 403) {
          toast.error("Access denied");
          router.push("/user-dashboard");
          return;
        }
        if (!response.ok) {
          throw new Error("Failed to load engineer");
        }
        setEngineer(await response.json());
      } catch (e) {
        console.error(e);
        toast.error("Failed to load engineer");
      } finally {
        setLoading(false);
      }
    })();
  }, [engineer_id, router]);

  if (loading) {
    return (
      <div className="p-6 bg-gradient-to-b from-slate-50 to-slate-100 min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!engineer) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-slate-600">Engineer not found.</p>
        <Link href="/user-dashboard/third-party-engineers" className="text-blue-600 hover:underline">
          Back to list
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gradient-to-b from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href={`/user-dashboard/third-party-engineers#${THIRD_PARTY_ENGINEERS_TABLE_HASH}`}
            className="text-blue-600 hover:text-blue-700 text-xl"
            title="Back to engineers table"
          >
            ←
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              <PhoneCall className="text-purple-600" size={28} aria-hidden />
              Follow-up
            </h1>
            <p className="text-slate-600 mt-1">{engineer.name}</p>
          </div>
        </div>

        <ThirdPartyEngineerFollowupPanel engineerId={engineer_id} engineerName={engineer.name} />
      </div>
    </div>
  );
}
