"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProductsNewContent from "./ProductsNewContent";
import SparesNewContent from "../spares-new/SparesNewContent";

function InventoryTabBar({ activeTab }) {
  const router = useRouter();

  const tabClass = (tab) =>
    `px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
      activeTab === tab
        ? "bg-blue-600 text-white shadow-sm"
        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
    }`;

  return (
    <div className="shrink-0 flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-3">
      <h1 className="text-lg font-bold text-gray-900 mr-2">Products &amp; Inventory</h1>
      <button
        type="button"
        className={tabClass("products")}
        onClick={() => router.push("/admin-dashboard/products-new")}
      >
        Products
      </button>
      <button
        type="button"
        className={tabClass("spares")}
        onClick={() => router.push("/admin-dashboard/products-new?tab=spares")}
      >
        Spares
      </button>
    </div>
  );
}

function ProductsNewPageInner() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") === "spares" ? "spares" : "products";

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <InventoryTabBar activeTab={activeTab} />
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === "spares" ? <SparesNewContent /> : <ProductsNewContent />}
      </div>
    </div>
  );
}

export default function ProductsNewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-gray-500">
          Loading…
        </div>
      }
    >
      <ProductsNewPageInner />
    </Suspense>
  );
}
