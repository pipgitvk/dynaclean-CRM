"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Link2 } from "lucide-react";
import SummaryStatCard from "@/components/sales/SummaryStatCard";

export default function DigitalMarketingQuickCards({ username }) {
  const [loading, setLoading] = useState(true);
  const [allowedModules, setAllowedModules] = useState(null);
  const [taskPendingCount, setTaskPendingCount] = useState(0);
  const [backlinksPendingCount, setBacklinksPendingCount] = useState(0);

  useEffect(() => {
    const init = async () => {
      if (!username) {
        setLoading(false);
        return;
      }

      try {
        const modulesRes = await fetch("/api/my-modules");
        let modules = null;
        if (modulesRes.ok) {
          const data = await modulesRes.json();
          modules = data?.allowedModules ?? null;
          setAllowedModules(modules);
        }

        const canViewBacklinks =
          modules === null ||
          modules.includes("backlinks-management") ||
          modules.includes("backlinks-excel-data");
        const canViewTasks = modules === null || modules.includes("task-manager");

        const requests = [];
        if (canViewBacklinks) {
          requests.push(
            fetch(
              `/api/backlinks?assigned_to=${encodeURIComponent(
                username
              )}&status=pending`
            ).then((res) => (res.ok ? res.json() : []))
          );
        } else {
          requests.push(Promise.resolve([]));
        }

        if (canViewTasks) {
          requests.push(
            fetch(`/api/tasks?username=${encodeURIComponent(username)}`).then(
              (res) => (res.ok ? res.json() : [])
            )
          );
        } else {
          requests.push(Promise.resolve([]));
        }

        const [backlinksRows, tasksRows] = await Promise.all(requests);
        setBacklinksPendingCount(
          Array.isArray(backlinksRows) ? backlinksRows.length : 0
        );
        setTaskPendingCount(Array.isArray(tasksRows) ? tasksRows.length : 0);
      } catch {
        setBacklinksPendingCount(0);
        setTaskPendingCount(0);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [username]);

  const canViewBacklinks = useMemo(() => {
    return (
      allowedModules === null ||
      allowedModules.includes("backlinks-management") ||
      allowedModules.includes("backlinks-excel-data")
    );
  }, [allowedModules]);

  const canViewTasks = useMemo(() => {
    return allowedModules === null || allowedModules.includes("task-manager");
  }, [allowedModules]);

  return (
    <>
      {canViewBacklinks && (
        <SummaryStatCard
          href="/digital-marketing-dashboard/backlinks"
          label="Backlinks Pending"
          count={backlinksPendingCount}
          suffix="Backlinks"
          icon={Link2}
          iconWrapClass="bg-sky-500"
          arrowClass="text-sky-500"
          loading={loading}
        />
      )}
      {canViewTasks && (
        <SummaryStatCard
          href="/digital-marketing-dashboard/task-manager?status=Pending"
          label="Task Pending"
          count={taskPendingCount}
          suffix="Tasks"
          icon={ClipboardList}
          iconWrapClass="bg-amber-500"
          arrowClass="text-amber-500"
          loading={loading}
        />
      )}
    </>
  );
}

