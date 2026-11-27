/** Latest installation_reports row for a service (any status casing). */
export async function fetchLatestInstallationReport(conn, serviceId) {
  const id = Number(serviceId);
  if (!Number.isFinite(id)) return null;
  const [rows] = await conn.execute(
    `SELECT * FROM installation_reports WHERE service_id = ? ORDER BY id DESC LIMIT 1`,
    [id],
  );
  return rows?.[0] || null;
}

export async function fetchInstallationReportById(conn, serviceId, reportId) {
  const sid = Number(serviceId);
  const rid = Number(reportId);
  if (!Number.isFinite(sid) || !Number.isFinite(rid) || rid <= 0) return null;
  const [rows] = await conn.execute(
    `SELECT * FROM installation_reports WHERE service_id = ? AND id = ? LIMIT 1`,
    [sid, rid],
  );
  return rows?.[0] || null;
}

export function parseTraineesFromInstallationReport(install) {
  if (!install) {
    return [{ id: 1, name: "", designation: "", contact: "" }];
  }
  const names = String(install.trainee_names || "")
    .split(",")
    .map((s) => s.trim());
  const departments = String(install.trainee_departments || "")
    .split(",")
    .map((s) => s.trim());
  const contacts = String(install.trainee_contacts || "")
    .split(",")
    .map((s) => s.trim());
  const max = Math.max(names.length, departments.length, contacts.length, 0);
  const trainees = [];
  for (let i = 0; i < max; i += 1) {
    const name = names[i] || "";
    const designation = departments[i] || "";
    const contact = contacts[i] || "";
    if (!name && !designation && !contact) continue;
    trainees.push({ id: i + 1, name, designation, contact });
  }
  return trainees.length
    ? trainees
    : [{ id: 1, name: "", designation: "", contact: "" }];
}

/**
 * Prefill complete-service ServiceForm from installation_reports.
 */
function normalizeCompletedStatus(status) {
  const s = String(status || "").trim().toUpperCase();
  if (s === "COMPLETED" || s === "COMPLETE") return "COMPLETED";
  return String(status || "").trim() || "COMPLETED";
}

export function mergeInstallationReportIntoService(service, install) {
  if (!service) return null;
  if (!install) {
    const st = String(service.status || "").trim().toUpperCase();
    return {
      ...service,
      isNewReport: st !== "COMPLETED" && st !== "COMPLETE",
    };
  }

  const trainees = parseTraineesFromInstallationReport(install);
  const authName = String(install.authorized_person_name || "").trim();
  const custName = String(install.customer_name || install.customer_name1 || "").trim();

  return {
    ...service,
    isNewReport: false,
    status: normalizeCompletedStatus(service.status || install.status),
    completed_date:
      install.installation_date || service.completed_date || "",
    defects_found: install.defects_on_inspection || "",
    engineers_remark: install.engineer_remarks || "",
    service_rating: install.service_rating || "",
    customer_feedback: install.customer_feedback || "",
    authorized_person_name: authName,
    authorized_person_designation: install.authorized_person_designation || "",
    authorized_person_mobile: install.authorized_person_mobile || "",
    authorised_person_sign: install.authorized_person_sign || "",
    customer_name: custName,
    customer_designation: install.customer_designation || "",
    customer_mobile: install.customer_mobile || "",
    customer_sign: install.customer_sign || "",
    completion_engineer_name: authName,
    completion_engineer_designation: install.authorized_person_designation || "",
    completion_engineer_mobile: install.authorized_person_mobile || "",
    completion_customer_name: custName,
    completion_customer_designation: install.customer_designation || "",
    completion_customer_mobile: install.customer_mobile || "",
    initialTrainees: trainees,
    installationReportId: install.id,
  };
}