"use client";

import { useCallback, useEffect, useState } from "react";
import { BASE_EMPLOYEE_ROLES, mergeEmployeeRoleLists } from "@/lib/employeeRoles";

/**
 * Loads merged built-in + custom roles for employee forms (falls back to built-in list).
 */
export function useEmployeeRoleOptions() {
  const [roles, setRoles] = useState(BASE_EMPLOYEE_ROLES);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/employee-roles?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setRoles(BASE_EMPLOYEE_ROLES);
        return;
      }
      const data = await res.json();
      const list = Array.isArray(data?.roles) ? data.roles : [];
      setRoles(mergeEmployeeRoleLists(BASE_EMPLOYEE_ROLES, list));
    } catch {
      setRoles(BASE_EMPLOYEE_ROLES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { roles, loading, reload };
}
