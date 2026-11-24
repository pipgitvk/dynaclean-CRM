"use client";

import { useParams, useRouter } from "next/navigation";
import { Toaster } from "react-hot-toast";
import { WarrantyInstallRequestModal } from "@/components/warranty/WarrantyProductServiceModals";

export default function InstallationPage() {
  const params = useParams();
  const router = useRouter();
  const serialNumber = String(params?.serial_number || "").trim();

  return (
    <>
      <Toaster position="top-right" />
      <WarrantyInstallRequestModal
        serialNumber={serialNumber}
        onClose={() => router.back()}
        onSuccess={() => router.back()}
      />
    </>
  );
}