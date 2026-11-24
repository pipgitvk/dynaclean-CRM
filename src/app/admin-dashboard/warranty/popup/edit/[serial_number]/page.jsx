"use client";

import EditWarrantyPage from "@/app/admin-dashboard/warranty/edit/[serial_number]/page";
import { EmbedHeightReporter } from "@/components/embed/EmbedHeightReporter";

/** Popup / iframe — minimal dashboard chrome (see `dashboardEmbedMiddleware`). */
export default function WarrantyPopupEditPage() {
  return (
    <>
      <EmbedHeightReporter />
      <EditWarrantyPage />
    </>
  );
}