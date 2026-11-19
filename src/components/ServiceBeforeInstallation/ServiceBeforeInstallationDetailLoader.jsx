"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const ServiceBeforeInstallationDetailClient = dynamic(
  () => import("@/components/ServiceBeforeInstallation/ServiceBeforeInstallationDetailClient"),
  {
    ssr: true,
    loading: () => (
      <div className="flex min-h-[40vh] items-center justify-center text-violet-600">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
        <span className="sr-only">Loading…</span>
      </div>
    ),
  },
);

export default function ServiceBeforeInstallationDetailLoader(props) {
  return <ServiceBeforeInstallationDetailClient {...props} />;
}