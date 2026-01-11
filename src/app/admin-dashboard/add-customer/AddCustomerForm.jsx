"use client";

import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function AddCustomerForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm();

  const onSubmit = async (data) => {
    const form = new FormData();
    Object.entries(data).forEach(([k, v]) => {
      if (v) form.append(k, v);
    });

    try {
      const res = await fetch("/api/new-customers", {
        method: "POST",
        body: form,
      });

      if (res.ok) {
        toast.success("Customer added successfully!");
        router.push("/admin-dashboard");
      } else {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          if (data.error) {
            toast.error(data.error);
            return;
          }
        } catch { }
        toast.error("Failed: " + text);
      }
    } catch {
      toast.error("Network error");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <div className="flex-1">
          <label className="block font-medium">First Name *</label>
          <input
            {...register("first_name", { required: true })}
            className="w-full p-2 border rounded-md"
          />
        </div>
        <div className="flex-1">
          <label className="block font-medium">Last Name </label>
          <input
            {...register("last_name", { required: false })}
            className="w-full p-2 border rounded-md"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block font-medium">Email</label>
          <input
            type="email"
            {...register("email")}
            className="w-full p-2 border rounded-md"
          />
        </div>
        <div>
          <label className="block font-medium">Phone *</label>
          <input
            type="tel"
            {...register("phone", { required: true, pattern: /^\s*\d{10}\s*$/ })}
            className="w-full p-2 border rounded-md"
          />
          {/* We should probably show errors too if we can, but let's stick to the requested behavior first */}
        </div>
      </div>

      <div>
        <label className="block font-medium">Company</label>
        <input
          {...register("company")}
          className="w-full p-2 border rounded-md"
        />
      </div>
      <div>
        <label className="block font-medium">GSTIN</label>
        <input
          {...register("gstin", { required: false })}
          className="w-full p-2 border rounded-md"
        />
      </div>

      <div>
        <label className="block font-medium">Address</label>
        <input
          {...register("address")}
          className="w-full p-2 border rounded-md"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block font-medium">Lead Campaign *</label>
          <select
            {...register("lead_campaign", { required: true })}
            className="w-full p-2 border rounded-md"
          >
            <option value="">Select</option>
            <option value="india_mart">India Mart</option>
            <option value="social_media">Social Media</option>
            <option value="google_ads">Google Ads</option>
            <option value="visit">Visit</option>
            <option value="website_visit">Website Visit</option>
            <option value="reference">Reference</option>
          </select>
        </div>
        <div>
          <label className="block font-medium">Interested Product *</label>
          <select
            {...register("products_interest", { required: true })}
            className="w-full p-2 border rounded-md"
          >
            <option value="">Select</option>
            <option value="Scrubber">Scrubber</option>
            <option value="Sweeper">Sweeper</option>
            <option value="Jet Pressure">Jet Pressure</option>
            <option value="Vacuum">Vacuum Cleaner</option>
            <option value="Escalator Cleaner">Escalator Cleaner</option>
            <option value="Sweeper Truck">Sweeper Truck</option>
            <option value="All Products">All Products</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block font-medium">Tags *</label>
        <select
          {...register("tags", { required: true })}
          className="w-full p-2 border rounded-md"
        >
          <option value="">Select</option>
          <option value="facility">Facilities Management Company</option>
          <option value="industry">Industrial Facilities</option>
          <option value="commercial">Commercial Buildings</option>
          <option value="healthcare">Healthcare Facilities</option>
          <option value="institute">Educational Institutions</option>
          <option value="govt">Government Facilities</option>
          <option value="property">Property Management Companies</option>
          <option value="construction">Construction Company</option>
          <option value="transport">Transportation Companies</option>
          <option value="society">Society</option>
          <option value="dealer">Dealer</option>
          <option value="Other">Others</option>
        </select>
      </div>

      <div>
        <label className="block font-medium">Communication Mode *</label>
        <select
          {...register("communication_mode", { required: true })}
          className="w-full p-2 border rounded-md"
        >
          <option value="">Select</option>
          <option value="Call">Call</option>
          <option value="WhatsApp">WhatsApp</option>
          <option value="SMS">SMS</option>
          <option value="Visit">Visit</option>
          <option value="Email">Email</option>
        </select>
      </div>

      <div>
        <label className="block font-medium">Next Follow-up Date *</label>
        <input
          type="datetime-local"
          {...register("next_followup_date", { required: true })}
          className="w-full p-2 border rounded-md"
        />
      </div>

      <div>
        <label className="block font-medium">Notes / Follow-up Info</label>
        <textarea
          {...register("notes")}
          className="w-full p-2 border rounded-md"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? "Submitting..." : "Add Customer"}
      </button>
    </form>
  );
}
