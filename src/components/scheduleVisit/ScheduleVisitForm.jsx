"use client";

import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

export default function ScheduleVisitForm({
  customerId,
  customerName,
  contact,
  address,
  onSuccess,
  prefillVisitAddress = true,
}) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm({
    defaultValues: {
      visitAddress: prefillVisitAddress ? address || "" : "",
    },
  });

  const onSubmit = async (data) => {
    try {
      const res = await fetch("/api/schedule-visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          customerName,
          contact,
          visitAddress: data.visitAddress,
          purpose: data.purpose,
          scheduledDate: data.scheduledDate,
        }),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        toast.success("Visit schedule submitted for approval");
        onSuccess?.();
      } else {
        toast.error(result.error || "Submission failed");
      }
    } catch {
      toast.error("Network error");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-gray-800">
      <div>
        <label className="block font-semibold mb-1 text-gray-700 text-sm">Visit Address</label>
        <textarea
          {...register("visitAddress", { required: true })}
          className="w-full h-20 p-3 border border-gray-300 rounded-md text-sm"
          placeholder="Enter visit address"
        />
      </div>

      <div>
        <label className="block font-semibold mb-1 text-gray-700 text-sm">Purpose</label>
        <textarea
          {...register("purpose", { required: true })}
          className="w-full h-16 p-3 border border-gray-300 rounded-md text-sm"
          placeholder="Purpose of visit"
        />
      </div>

      <div>
        <label className="block font-semibold mb-1 text-gray-700 text-sm">Scheduled Date & Time</label>
        <input
          type="datetime-local"
          {...register("scheduledDate", { required: true })}
          className="w-full p-3 border border-gray-300 rounded-md text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-2.5 bg-violet-600 text-white font-semibold rounded-md hover:bg-violet-700 disabled:opacity-50 text-sm"
      >
        {isSubmitting ? "Submitting..." : "Submit for Approval"}
      </button>
    </form>
  );
}
