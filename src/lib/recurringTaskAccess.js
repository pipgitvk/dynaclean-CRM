import { resolveGemCrmEmployeeId } from "@/lib/gemCrmAuth";

export function isRecurringTaskPrivileged(role) {
  return ["SUPERADMIN", "ADMIN", "DIRECTOR"].includes(
    String(role || "").trim().toUpperCase()
  );
}

export async function getRecurringTaskActor(payload) {
  const privileged = isRecurringTaskPrivileged(payload?.role);
  const empId = await resolveGemCrmEmployeeId({
    username: payload?.username,
    empId: payload?.empId,
    id: payload?.id,
  });
  return { privileged, empId, username: payload?.username };
}

export function canViewRecurringTask(actor, task) {
  if (actor?.privileged) return true;
  if (!actor?.empId || !task) return false;
  return (
    Number(task.created_by) === Number(actor.empId) ||
    Number(task.assigned_user_id) === Number(actor.empId)
  );
}

export function canModifyRecurringTask(actor, task) {
  if (actor?.privileged) return true;
  if (!actor?.empId || !task) return false;
  return Number(task.created_by) === Number(actor.empId);
}
