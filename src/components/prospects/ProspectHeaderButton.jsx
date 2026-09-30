"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import toast from "react-hot-toast";
import ProspectSubmissionModal from "./ProspectSubmissionModal";
import { canSubmitProspect } from "@/lib/prospectSubmissionAccess";

export default function ProspectHeaderButton({ userRole, username }) {
  const [open, setOpen] = useState(false);
  const [reportingManager, setReportingManager] = useState("");

  const allowed = canSubmitProspect(userRole);

  useEffect(() => {
    if (!allowed || !username) return;

    const load = async () => {
      try {
        const res = await fetch("/api/user/reporting-manager", {
          credentials: "include",
        });
        const data = res.ok ? await res.json() : {};
        let manager =
          data?.reportingManager?.name ||
          data?.reportingManager?.username ||
          "";

        if (!manager) {
          const fallbackRes = await fetch(
            `/api/empcrm/manager-email?username=${encodeURIComponent(username)}`,
            { credentials: "include" },
          );
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            manager =
              fallbackData?.manager_name || fallbackData?.manager_username || "";
          }
        }
        setReportingManager(manager);
      } catch {
        setReportingManager("");
      }
    };

    load();
  }, [username, allowed]);

  if (!allowed) return null;

  const handleClick = () => {
    if (!reportingManager) {
      toast.error("Reporting manager is not assigned.");
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="grid h-10 w-10 min-h-[44px] min-w-[44px] place-items-center rounded-xl bg-indigo-500 text-white transition hover:bg-indigo-600 min-[1100px]:min-h-0 min-[1100px]:min-w-0 shadow-md hover:shadow-lg"
        aria-label="Add Prospect"
        title="Add Prospect"
      >
        <FileText size={18} />
      </button>

      <ProspectSubmissionModal
        open={open}
        onClose={() => setOpen(false)}
        reportingManager={reportingManager}
      />
    </>
  );
}
