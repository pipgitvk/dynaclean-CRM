"use client";

import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useState } from "react";

export default function AddExpenseForm() {
  const router = useRouter();
  const [isSubmitting, setSubmitting] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  const onSubmit = async (data) => {
    setSubmitting(true);

    const formData = new FormData();
    for (const key in data) {
      if (key === "attachments") {
        for (let i = 0; i < data.attachments.length; i++) {
          formData.append("attachments", data.attachments[i]);
        }
      } else {
        formData.append(key, data[key]);
      }
    }

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (res.ok) {
        toast.success("Expense added successfully!");
        router.push("/user-dashboard/expenses");
      } else {
        toast.error(result.error || "Failed to add expense");
      }
    } catch (err) {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    reset(); // Reset the form to initial state
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="max-w-7xl mx-auto p-6 space-y-6 bg-white rounded-xl shadow"
    >
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Add New Expense</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* All Input Fields */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Expense Date *
          </label>
          <input
            type="date"
            {...register("TravelDate", { required: true })}
            className="w-full border p-2 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            From Location *
          </label>
          <input
            {...register("FromLocation", { required: true })}
            className="w-full border p-2 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            To Location *
          </label>
          <input
            {...register("Tolocation", { required: true })}
            className="w-full border p-2 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Distance (km) *
          </label>
          <input
            type="number"
            {...register("distance", { required: true })}
            className="w-full border p-2 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Meeting Person Name *
          </label>
          <input
            {...register("person_name", { required: true })}
            className="w-full border p-2 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Person Contact *
          </label>
          <input
            {...register("person_contact", { required: true })}
            className="w-full border p-2 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Conveyance Mode *
          </label>
          <input
            {...register("ConveyanceMode", { required: true })}
            className="w-full border p-2 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Ticket Cost *
          </label>
          <input
            type="number"
            {...register("TicketCost", { required: true })}
            className="w-full border p-2 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Hotel Cost *</label>
          <input
            type="number"
            defaultValue={0}
            {...register("HotelCost", { required: true })}
            className="w-full border p-2 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Meals Cost *</label>
          <input
            type="number"
            defaultValue={0}
            {...register("MealsCost", { required: true })}
            className="w-full border p-2 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Other Expenses *
          </label>
          <input
            type="number"
            defaultValue={0}
            {...register("OtherExpenses", { required: true })}
            className="w-full border p-2 rounded-md"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-1">Description *</label>
        <textarea
          {...register("description", { required: true })}
          className="w-full border p-3 rounded-md"
          rows={4}
        ></textarea>
      </div>

      {/* File Upload */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Attachments (Multiple files allowed)
        </label>
        <input
          type="file"
          {...register("attachments")}
          multiple
          className="w-full border p-2 rounded-md"
        />
      </div>

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <button
          type="button"
          onClick={handleReset}
          className="w-full sm:w-auto px-6 py-3 bg-gray-500 text-gray-100 rounded-lg hover:bg-gray-600 cursor-pointer"
        >
          Reset
        </button>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
        >
          {isSubmitting ? "Submitting..." : "Add Expense"}
        </button>
      </div>
    </form>
  );
}
