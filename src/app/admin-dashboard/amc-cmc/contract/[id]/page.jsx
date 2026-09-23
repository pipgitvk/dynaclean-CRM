"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import AmcCmcContractViewer from "@/components/amc-cmc/AmcCmcContractViewer";

export default function AdminAmcCmcContractPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/amc-cmc/${id}`);
        if (!res.ok) throw new Error("Failed to fetch record");
        setRecord(await res.json());
      } catch {
        toast.error("Failed to load contract");
        router.push("/admin-dashboard/amc-cmc");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  if (loading) return <div className="p-6">Loading contract...</div>;
  if (!record) return <div className="p-6">Contract not found</div>;

  return (
    <AmcCmcContractViewer
      record={record}
      backHref="/admin-dashboard/amc-cmc"
    />
  );
}
