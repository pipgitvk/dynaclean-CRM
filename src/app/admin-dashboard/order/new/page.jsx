"use client";
import { useState } from "react";
import QuotationLookupForm from "./QuotationLookupForm";
import OrderForm from "./OrderForm";

export default function NewOrderPage() {
  const [quotation, setQuotation] = useState(null);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6 flex justify-between items-center">
        Create New Order
      </h1>

      {!quotation ? (
        <QuotationLookupForm onLoad={setQuotation} />
      ) : (
        <OrderForm quotation={quotation} reset={() => setQuotation(null)} />
      )}
    </div>
  );
}
