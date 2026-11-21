"use client";

import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import LeadsManageMetaCredentialCards from "@/components/Leads/LeadsManageMetaCredentialCards";

export default function LeadsManageMetaLeadsClient({
  dashboardBase = "admin-dashboard",
}) {
  const hubHref = `/${dashboardBase}/leads-manage`;

  return (
    <div className="min-h-screen w-full max-w-none bg-gradient-to-b from-violet-50/80 via-slate-50 to-white pb-8 pt-3 sm:pt-4 -mx-2 w-[calc(100%+1rem)] sm:-mx-3 sm:w-[calc(100%+1.5rem)] md:-mx-4 md:w-[calc(100%+2rem)] px-1 sm:px-2">
      <div className="w-full space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3.5 sm:gap-4">
            <Link
              href={hubHref}
              className="shrink-0 rounded-[14px] border border-violet-200/80 bg-white p-3 text-violet-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50"
              aria-label="Back to Leads Manage"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2.25} />
            </Link>
            <div className="min-w-0 pt-0.5">
              <motionWithIcon />
              <h1 className="text-2xl font-bold tracking-tight text-indigo-950 sm:text-3xl">
                Meta lead forms
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-snug text-slate-500 sm:text-base">
                Total, distributed, and duplicate counts per active Meta credential — open a
                card to view leads for that form set.
              </p>
            </div>
          </div>
        </header>

        <div className="rounded-2xl border border-slate-200/90 bg-white/95 p-5 sm:p-6 shadow-sm backdrop-blur-sm">
          <LeadsManageMetaCredentialCards dashboardBase={dashboardBase} variant="page" />
        </div>
      </div>
    </div>
  );
}

function motionWithIcon() {
  return (
    <div className="mb-2 hidden sm:flex">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-800">
        <FileText className="h-3.5 w-3.5" aria-hidden />
        meta_leads
      </span>
    </div>
  );
}