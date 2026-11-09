"use client";

import WarehouseInFormLegacy from "@/components/forms/WarehouseInFormLegacy";
import WarehouseInInchargeForm from "@/components/forms/WarehouseInInchargeForm";
import { isWarehouseInchargeRole } from "@/lib/warehouseInAccess";
import { useEffect, useState } from "react";

export default function WarehouseInForm() {
  const [role, setRole] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        if (!cancelled) {
          setRole(data?.userRole ?? data?.role ?? "");
        }
      })
      .catch(() => {
        if (!cancelled) setRole("");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (role === null) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
        Loading warehouse in…
      </div>
    );
  }

  if (isWarehouseInchargeRole(role)) {
    return <WarehouseInInchargeForm />;
  }

  return <WarehouseInFormLegacy />;
}
