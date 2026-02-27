"use client";
import EstimateDelivery from "@/components/EstimateDelivery";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function EstimateDeliveryPage() {
  return (
    <div className="mx-auto p-6 max-w-3xl">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin-dashboard/order"
          className="p-2 hover:bg-gray-100 rounded-full transition"
        >
          <ArrowLeft size={24} />
        </Link>
        <h2 className="text-2xl font-bold">Estimate Delivery</h2>
      </div>
      <EstimateDelivery />
    </div>
  );
}
