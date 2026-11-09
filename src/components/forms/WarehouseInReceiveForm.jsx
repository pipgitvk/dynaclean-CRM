"use client";

import { buildWarehouseInDisplayGroups } from "@/lib/warehouseInGrouping";
import { fetchPendingWarehouseInRequests } from "@/lib/warehouseInPendingLoad";
import WarehouseInReceivePanel from "@/components/forms/WarehouseInReceivePanel";
import { itemLineKey } from "@/components/forms/warehouseInUi";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isWarehouseInchargeRole } from "@/lib/warehouseInAccess";
import { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

function WarehouseInReceiveContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const groupKey = searchParams.get("g");
  const itemKey = searchParams.get("item");
  const listPath =
    pathname?.replace(/\/receive\/?$/, "") ||
    "/user-dashboard/purchase/warehouse-in";

  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);

  const displayGroups = useMemo(
    () => buildWarehouseInDisplayGroups(pendingRequests),
    [pendingRequests],
  );

  const selectedGroup = useMemo(() => {
    if (!groupKey) return null;
    return displayGroups.find((g) => g.groupKey === groupKey) ?? null;
  }, [displayGroups, groupKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [meRes, combined] = await Promise.all([
          fetch("/api/me", { credentials: "include" }),
          fetchPendingWarehouseInRequests(),
        ]);
        const me = meRes.ok ? await meRes.json() : {};
        if (!cancelled) {
          setUserRole(me?.userRole ?? me?.role ?? "");
          setPendingRequests(combined);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) toast.error("Failed to load pending requests");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmitSuccess = () => {
    router.push(listPath);
  };

  const selectedItem = selectedGroup?.items?.find(
    (i) => itemLineKey(i) === itemKey,
  );

  if (loading || userRole === null) {
    return <p className="text-sm text-gray-600">Loading…</p>;
  }

  if (!isWarehouseInchargeRole(userRole)) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">
          Full receive page is only for Warehouse Incharge. Use the main
          warehouse-in list.
        </p>
        <Link
          href={listPath}
          className="inline-block px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
        >
          ← Back to warehouse in
        </Link>
      </div>
    );
  }

  if (!groupKey) {
    return (
      <p className="text-sm text-red-600">
        Invalid link.{" "}
        <Link href={listPath} className="text-blue-600 underline">
          Back to list
        </Link>
      </p>
    );
  }

  if (!selectedGroup) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">
          This invoice or request is no longer pending.
        </p>
        <Link
          href={listPath}
          className="inline-block px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
        >
          ← Back to invoice list
        </Link>
      </div>
    );
  }

  if (selectedGroup.items.length > 1 && !itemKey) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">
          Pehle list se item select karein — invoice popup se &quot;Receive
          stock&quot; use karein.
        </p>
        <Link
          href={listPath}
          className="inline-block px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
        >
          ← Back to invoice list
        </Link>
      </div>
    );
  }

  if (itemKey && !selectedItem) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">
          Selected item not found or already received.
        </p>
        <Link
          href={listPath}
          className="inline-block px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
        >
          ← Back to invoice list
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <Link
        href={listPath}
        className="inline-block mb-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
      >
        ← Back to invoice list
      </Link>
      <WarehouseInReceivePanel
        key={`${selectedGroup.groupKey}-${itemKey || selectedGroup.items[0]?.id}`}
        group={selectedGroup}
        initialItemKey={itemKey || undefined}
        lockItemSelection={Boolean(itemKey) || selectedGroup.items.length === 1}
        onSuccess={onSubmitSuccess}
        showHeader
      />
    </div>
  );
}

export default function WarehouseInReceiveForm() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-600">Loading…</p>}>
      <WarehouseInReceiveContent />
    </Suspense>
  );
}
