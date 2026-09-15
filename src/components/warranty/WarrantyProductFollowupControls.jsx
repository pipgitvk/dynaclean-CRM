"use client";
import { useState } from "react";
import {
  FollowUpModal,
  HistoryModal,
  ImagePreviewModal,
  FollowUpActionButtons,
  toFollowupTarget,
} from "@/components/service/MachineFollowupModals";

export function useWarrantyProductFollowup(onSaved) {
  const [followUpTarget, setFollowUpTarget] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  function ProductFollowupIcons({ product, className = "mb-1.5" }) {
    return (
      <FollowUpActionButtons
        variant="icon"
        className={className}
        onFollowUp={() => setFollowUpTarget(toFollowupTarget(product))}
        onHistory={() => setHistoryTarget(product)}
      />
    );
  }

  const followupModals = (
    <>
      {followUpTarget && (
        <FollowUpModal
          fu={followUpTarget}
          onClose={() => setFollowUpTarget(null)}
          onSaved={onSaved}
        />
      )}
      {historyTarget && (
        <HistoryModal
          serialNumber={historyTarget.serial_number}
          contact={historyTarget.contact}
          email={historyTarget.email}
          includeCustomerFollowups={!!historyTarget.includeCustomerFollowups}
          onClose={() => setHistoryTarget(null)}
          onPreviewImage={(img) => setPreviewImage(img)}
        />
      )}
      <ImagePreviewModal image={previewImage} onClose={() => setPreviewImage(null)} />
    </>
  );

  return { ProductFollowupIcons, followupModals };
}
