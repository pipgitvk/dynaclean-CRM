"use client";
import EstimateDelivery from "@/components/EstimateDelivery";
import { Truck } from "lucide-react";

export default function EstimateDeliveryPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Truck className="w-8 h-8 text-blue-600" />
        <h2 className="text-2xl font-bold">Estimate Delivery</h2>
      </div>
      <EstimateDelivery />
    </div>
  );
}
