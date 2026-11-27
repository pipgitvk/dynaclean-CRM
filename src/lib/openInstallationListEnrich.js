/** Merge dispatch + service enrich results (same row order). */
export function mergeOpenInstallationParallelEnrichment(dispatchRows, serviceRows) {
  return (dispatchRows || []).map((row, i) => {
    const svc = serviceRows?.[i] || row;
    return {
      ...row,
      service_id: svc.service_id ?? row.service_id,
      service_details: svc.service_details ?? row.service_details,
      service_engineer:
        svc.service_engineer != null && String(svc.service_engineer).trim() !== ""
          ? svc.service_engineer
          : row.service_engineer,
      third_party_engineer:
        svc.third_party_engineer != null && String(svc.third_party_engineer).trim() !== ""
          ? svc.third_party_engineer
          : row.third_party_engineer,
      assigned_by:
        svc.assigned_by != null && String(svc.assigned_by).trim() !== ""
          ? svc.assigned_by
          : row.assigned_by,
      completed_by_service_engineer: svc.completed_by_service_engineer ?? row.completed_by_service_engineer,
      installation_report_engineer:
        svc.installation_report_engineer ?? row.installation_report_engineer,
      google_feedback_collected: svc.google_feedback_collected ?? row.google_feedback_collected,
      google_feedback_collection: svc.google_feedback_collection ?? row.google_feedback_collection,
      google_feedback_proof: svc.google_feedback_proof ?? row.google_feedback_proof,
      installation_report: svc.installation_report ?? row.installation_report,
      final_report_path: svc.final_report_path ?? row.final_report_path,
      service_report_ids: svc.service_report_ids ?? row.service_report_ids,
    };
  });
}