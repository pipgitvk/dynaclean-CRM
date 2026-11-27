"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList, ExternalLink, Eye, FilePlus, History, UserPlus } from "lucide-react";
import ServiceCompletionDateCell from "@/components/services/ServiceCompletionDateCell";
import ServiceRecordStatusInlineCell from "@/components/services/ServiceRecordStatusInlineCell";
import MachineRegistrationModal from "@/components/warranty/MachineRegistrationModal";
import ServiceRecordAssignEngineerModal from "@/components/services/ServiceRecordAssignEngineerModal";
import {
  FollowUpActionButtons,
  toFollowupTarget,
} from "@/components/service/MachineFollowupModals";
import { displayComplaintDateForServiceRecord } from "@/lib/serviceRecordComplaintDisplay";
import { formatFollowedAtDisplay } from "@/lib/enrichSbiLastFollowup";

const TH =
  "px-3 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-slate-500 bg-slate-50/95";

const STEP_VIDEOS = [
  { key: "video_360", label: "360°" },
  { key: "video_problem", label: "Problem" },
  { key: "video_damaged", label: "Damaged" },
  { key: "video_completion", label: "Completion" },
];

function actionBtn(colorClass) {
  return `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white shadow-sm transition ${colorClass}`;
}

export function formatOpenCompletionsStatusLabel(status) {
  const s = String(status || "").trim().toUpperCase();
  if (s === "PENDING FOR SPARES") return "Pending by Us";
  return status || "—";
}

function OpenCompletionsCompanyCell({ row }) {
  const company = String(row.customer_name || "").trim() || "—";
  const sitePerson = String(row.site_person || row.contact_person || "").trim();
  const contact = String(row.contact || "").trim();
  return (
    <div className="min-w-[9rem] max-w-[14rem] space-y-1 text-sm">
      <div className="font-semibold text-slate-900 break-words">{company}</div>
      {sitePerson ? (
        <div className="text-xs text-slate-600 break-words">
          <span className="font-semibold text-slate-500">Site:</span> {sitePerson}
        </div>
      ) : null}
      {contact ? (
        <div className="text-xs text-slate-600">
          <span className="font-semibold text-slate-500">Contact:</span> {contact}
        </div>
      ) : null}
    </div>
  );
}

function openCompletionsCompletedBy(row) {
  const assignedTo = String(row.assigned_to || "").trim();
  if (!assignedTo || ["NOT ASSIGNED", "UNASSIGNED"].includes(assignedTo.toUpperCase())) {
    return "";
  }
  return assignedTo;
}

function OpenCompletionsAssignCell({ row }) {
  const assignedBy = String(row.registered_by || "").trim();
  const assignedTo = String(row.assigned_to || "").trim();
  const completedBy = openCompletionsCompletedBy(row);
  if (!assignedBy && !assignedTo && !completedBy) {
    return <span className="text-slate-400">—</span>;
  }
  return (
    <div className="min-w-[8.5rem] max-w-[12rem] space-y-1 text-xs">
      <div>
        <span className="font-bold text-violet-700">Assign by</span>
        <span className="ml-1 font-bold text-violet-700">{assignedBy || "—"}</span>
      </div>
      <div>
        <span className="font-semibold text-slate-500">Assign to</span>
        <span className="ml-1 text-slate-800">{assignedTo || "—"}</span>
      </div>
      <div>
        <span className="font-bold text-emerald-600">Completed by</span>
        <span className="ml-1 font-bold text-emerald-600">{completedBy || "—"}</span>
      </div>
    </div>
  );
}

function OpenCompletionsStepVideos({ row }) {
  const type = String(row.service_type || "").trim().toUpperCase();
  if (type !== "COMPLAINT") return <span className="text-slate-400">—</span>;
  const videos = STEP_VIDEOS.filter((step) => row[step.key]);
  if (!videos.length) return <span className="text-slate-400 text-xs">No videos</span>;
  return (
    <div className="flex min-w-[5.5rem] flex-col gap-0.5 text-xs">
      {videos.map((step) => (
        <a
          key={step.key}
          href={row[step.key]}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-violet-700 hover:underline"
        >
          {step.label}
        </a>
      ))}
    </div>
  );
}

function OpenCompletionsActionsCell({
  row,
  dashboardBase,
  ProductFollowupIcons,
  onMachineFollowUp,
  onMachineHistory,
  onOpenMachine,
  onAssignEngineer,
}) {
  const reportHref = `/${dashboardBase}/view-service-report/${encodeURIComponent(row.service_id)}`;
  const makeReportHref = `/${dashboardBase}/service-report-steps/${encodeURIComponent(row.service_id)}`;
  const product = {
    machine_id: row.machine_id,
    service_id: row.service_id,
    serial_number: row.serial_number,
    model: row.model,
    contact: row.contact,
    email: row.email,
    includeCustomerFollowups: false,
  };
  const followTarget = toFollowupTarget(product);
  const hasSerial = Boolean(String(row.serial_number || "").trim());

  return (
    <div className="inline-grid grid-cols-3 gap-x-2.5 gap-y-2 py-0.5">
      <button
        type="button"
        title="Follow up"
        className={actionBtn("bg-green-600 hover:bg-green-700")}
        onClick={() => onMachineFollowUp?.(followTarget)}
      >
        <ClipboardList className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Follow-up history"
        className={actionBtn("bg-purple-600 hover:bg-purple-700")}
        onClick={() => onMachineHistory?.(product)}
      >
        <History className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Assign engineer"
        className={actionBtn("bg-indigo-500 hover:bg-indigo-600")}
        onClick={() => onAssignEngineer?.(row)}
      >
        <UserPlus className="h-4 w-4" />
      </button>
      <Link
        href={makeReportHref}
        title="Make report"
        className={actionBtn("bg-violet-500 hover:bg-violet-600")}
      >
        <FilePlus className="h-4 w-4" />
      </Link>
      <Link
        href={reportHref}
        title="View service details"
        className={actionBtn("bg-slate-600 hover:bg-slate-700")}
      >
        <Eye className="h-4 w-4" />
      </Link>
      <button
        type="button"
        title={hasSerial ? "View machine registration" : "No serial on record"}
        disabled={!hasSerial}
        className={actionBtn(
          hasSerial
            ? "bg-emerald-600 hover:bg-emerald-700"
            : "cursor-not-allowed bg-slate-300",
        )}
        onClick={() => hasSerial && onOpenMachine?.(row.serial_number)}
      >
        <ExternalLink className="h-4 w-4" />
      </button>
    </div>
  );
}

export function OpenCompletionsComplaintTableHead() {
  return (
    <tr>
      <th className={TH}>#</th>
      <th className={TH}>Complaint Date</th>
      <th className={TH}>Service ID · Serial</th>
      <th className={TH}>Company</th>
      <th className={TH}>Model</th>
      <th className={TH}>Installation Address</th>
      <th className={TH}>State</th>
      <th className={TH}>Assign by / to</th>
      <th className={`${TH} min-w-[8rem]`}>Status</th>
      <th className={TH}>Completed Date</th>
      <th className={TH}>Complaint Summary</th>
      <th className={TH}>Step Video</th>
      <th className={TH}>Last Followed</th>
      <th className={`${TH} min-w-[19rem]`}>Actions</th>
    </tr>
  );
}

export function OpenCompletionsComplaintRows({
  rows,
  dashboardBase,
  page,
  pageSize,
  userRole,
  formatDate,
  ProductFollowupIcons,
  onMachineFollowUp,
  onMachineHistory,
  onRowUpdated,
}) {
  const [machineSerial, setMachineSerial] = useState("");
  const [assignRecord, setAssignRecord] = useState(null);

  return (
    <>
      {rows.map((row, idx) => {
        const rowNum = page * pageSize + idx + 1;
        const zebra = idx % 2 === 0 ? "bg-white" : "bg-violet-50/35";
        const reportHref = `/${dashboardBase}/view-service-report/${encodeURIComponent(row.service_id)}`;
        return (
          <tr key={row.service_id} className={`${zebra} hover:bg-violet-50/55`}>
            <td className="px-3 py-3.5 text-sm text-slate-500">{rowNum}</td>
            <td className="whitespace-nowrap px-3 py-3.5 text-sm text-slate-800">
              {displayComplaintDateForServiceRecord(row)}
            </td>
            <td className="px-3 py-3.5">
              <Link
                href={reportHref}
                className="font-mono text-sm font-semibold text-violet-700 hover:underline"
              >
                {row.service_id}
              </Link>
              {row.serial_number ? (
                <button
                  type="button"
                  onClick={() => setMachineSerial(row.serial_number)}
                  className="mt-0.5 block max-w-[11rem] break-all text-left text-xs font-medium text-emerald-700 underline decoration-dotted hover:text-emerald-900"
                >
                  {row.serial_number}
                </button>
              ) : (
                <span className="mt-0.5 block text-xs text-slate-400">—</span>
              )}
            </td>
            <td className="px-3 py-3.5 align-top">
              <OpenCompletionsCompanyCell row={row} />
            </td>
            <td className="px-3 py-3.5 font-mono text-xs text-slate-800">{row.model || "—"}</td>
            <td className="max-w-[11rem] px-3 py-3.5 text-xs leading-snug text-slate-700">
              <span className="line-clamp-4 whitespace-pre-wrap break-words" title={row.installed_address || ""}>
                {row.installed_address?.trim() || "—"}
              </span>
            </td>
            <td className="px-3 py-3.5 text-sm text-slate-800">{row.state?.trim() || "—"}</td>
            <td className="px-3 py-3.5 align-top">
              <OpenCompletionsAssignCell row={row} />
            </td>
            <td className="px-3 py-3.5 align-top">
              <ServiceRecordStatusInlineCell
                record={row}
                role={userRole}
                onRecordUpdated={(patch) => onRowUpdated?.(row.service_id, patch)}
              />
            </td>
            <td className="px-3 py-3.5 align-top">
              <ServiceCompletionDateCell
                completedDate={row.completed_date}
                preCompletion={row.pre_completion}
                afterCompletion={row.after_completion}
                formatDate={formatDate}
              />
            </td>
            <td className="max-w-[14rem] px-3 py-3.5 text-xs leading-snug text-slate-700">
              <span className="line-clamp-4 whitespace-pre-wrap break-words">
                {row.complaint_summary?.trim() || "—"}
              </span>
            </td>
            <td className="px-3 py-3.5 align-top">
              <OpenCompletionsStepVideos row={row} />
            </td>
            <td className="min-w-[10.5rem] max-w-[14rem] px-3 py-3.5 text-sm align-top">
              {(() => {
                const at = formatFollowedAtDisplay(row.last_followup_at);
                const remark = String(row.last_followup_notes ?? "").trim();
                if (!at && !remark) return <span className="text-slate-400">—</span>;
                return (
                  <>
                    {at ? (
                      <div className="whitespace-nowrap">
                        <span className="text-slate-500">Last Followed:</span>{" "}
                        <span className="font-medium tabular-nums text-slate-800">{at}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                    {remark ? (
                      <div
                        className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-xs text-slate-500"
                        title={remark}
                      >
                        {remark}
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </td>
            <td className="px-3 py-3.5 align-top">
              <OpenCompletionsActionsCell
                row={row}
                dashboardBase={dashboardBase}
                ProductFollowupIcons={ProductFollowupIcons}
                onMachineFollowUp={onMachineFollowUp}
                onMachineHistory={onMachineHistory}
                onOpenMachine={setMachineSerial}
                onAssignEngineer={setAssignRecord}
              />
            </td>
          </tr>
        );
      })}
      <MachineRegistrationModal
        isOpen={Boolean(machineSerial)}
        serialNumber={machineSerial}
        dashboardPath={dashboardBase}
        onClose={() => setMachineSerial("")}
      />
      <ServiceRecordAssignEngineerModal
        open={Boolean(assignRecord)}
        record={assignRecord}
        onClose={() => setAssignRecord(null)}
        onAssigned={(patch) => {
          if (assignRecord?.service_id) {
            onRowUpdated?.(assignRecord.service_id, patch);
          }
        }}
      />
    </>
  );
}