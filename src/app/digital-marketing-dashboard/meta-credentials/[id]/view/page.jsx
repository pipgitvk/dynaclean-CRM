"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useMetaCredentialsPaths } from "@/hooks/useMetaCredentialsPaths";
import MetaFormLeadsTable from "@/components/MetaFormLeadsTable";

export default function DigitalMarketerViewMetaCredentialPage() {
  const router = useRouter();
  const params = useParams();
  const paths = useMetaCredentialsPaths();
  const [loading, setLoading] = useState(true);
  const [credential, setCredential] = useState(null);

  useEffect(() => {
    const fetchCredential = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/meta-credentials/${params.id}`);
        if (response.data.success) {
          setCredential(response.data.data);
        }
      } catch (error) {
        toast.error("Failed to load form");
        console.error(error);
        router.push(paths.list);
      } finally {
        setLoading(false);
      }
    };
    fetchCredential();
  }, [params.id, paths.list, router]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-violet-600" />
      </div>
    );
  }

  if (!credential) {
    return (
      <div className="p-6 text-center text-slate-600">Form not found.</div>
    );
  }

  const formIds = Array.isArray(credential.formIds) ? credential.formIds : [];

  return (
    <div className="mx-auto w-full max-w-7xl px-2 py-4 sm:px-4 sm:py-6">
      <Link
        href={paths.list}
        className="mb-4 inline-flex items-center gap-2 text-violet-600 hover:text-violet-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Meta Leads Forms
      </Link>
      <h1 className="mb-1 text-xl font-bold text-slate-900 sm:text-2xl">Form leads</h1>
      <p className="mb-6 text-sm text-slate-600">
        Leads for this credential — counts by date range and full lead list below.
      </p>

      <MetaFormLeadsTable
        formIds={formIds}
        productInterestByFormId={credential.productInterestByFormId || {}}
        appearance="hub"
        hideAssignedTo
      />
    </div>
  );
}