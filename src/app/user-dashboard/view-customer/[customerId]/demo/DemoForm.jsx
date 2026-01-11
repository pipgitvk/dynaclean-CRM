"use client";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function DemoForm({ customerId, customerName }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm();

  const onSubmit = async (data) => {
    try {
      const res = await fetch("/api/demo-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, ...data }),
      });
      if (res.ok) {
        toast.success("✅ Registration submitted");
        router.push(`/user-dashboard/view-customer/${customerId}`);
      } else {
        toast.error("❌ Submission failed");
      }
    } catch {
      toast.error("⚠️ Network error");
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6 text-gray-800 text-lg"
    >
      {/* Demo Address */}
      <div>
        <label className="block font-semibold mb-1 text-gray-700 text-lg">
          Demonstration Address
        </label>
        <textarea
          {...register("demo_address", { required: true })}
          className="w-full h-24 p-4 border border-gray-300 rounded-md text-base"
          placeholder="Enter full address for the demo"
        />
      </div>

      {/* Date & Time */}
      <div>
        <label className="block font-semibold mb-1 text-gray-700 text-lg">
          Demonstration Date & Time
        </label>
        <input
          type="datetime-local"
          {...register("demo_date_time", { required: true })}
          className="w-full p-4 border border-gray-300 rounded-md text-base"
        />
      </div>

      {/* Machine & Model Inputs */}
      {[1, 2, 3].map((n) => (
        <div key={n} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold mb-1 text-gray-700 text-lg">
              Machine Name {n}
            </label>
            <input
              {...register(`machine${n}`)}
              placeholder={`Enter machine name ${n}`}
              className="w-full p-4 border border-gray-300 rounded-md text-base"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1 text-gray-700 text-lg">
              Model {n}
            </label>
            <input
              {...register(`model${n}`)}
              placeholder={`Enter model ${n}`}
              className="w-full p-4 border border-gray-300 rounded-md text-base"
            />
          </div>
        </div>
      ))}

      {/* Submit Button */}
      <div className="pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 text-lg bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 disabled:opacity-50 cursor-pointer"
        >
          {isSubmitting ? "Submitting..." : "Save Registration"}
        </button>
      </div>
    </form>
  );
}
