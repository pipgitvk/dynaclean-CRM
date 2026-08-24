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
  const [historySerial, setHistorySerial] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  function ProductFollowupIcons({ product, className = "mb-1.5" }) {
    return (
      <FollowUpActionButtons
        variant="icon"
        className={className}
        onFollowUp={() => setFollowUpTarget(toFollowupTarget(product))}
        onHistory={() => setHistorySerial(product.serial_number)}
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
      {historySerial && (
        <HistoryModal
          serialNumber={historySerial}
          onClose={() => setHistorySerial(null)}
          onPreviewImage={(img) => setPreviewImage(img)}
        />
      )}
      <ImagePreviewModal image={previewImage} onClose={() => setPreviewImage(null)} />
    </>
  );

  return { ProductFollowupIcons, followupModals };
}
