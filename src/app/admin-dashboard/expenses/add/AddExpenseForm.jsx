"use client";

import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useState } from "react";
import {
  getSbiFoodAmountError,
  getSbiHotelAmountError,
  SBI_FOOD_MAX_AMOUNT,
  SBI_HOTEL_MAX_AMOUNT,
} from "@/lib/sbiFoodExpenseRules";
import {
  isSbiTrainTravelMode,
  SBI_TRAIN_CLASS_OPTIONS,
} from "@/lib/sbiTravelOptions";

const SBI_TRAVEL_MODE_OPTIONS = [
  { value: "Train booked by company", label: "Train booked by company" },
  { value: "Train booked by self", label: "Train booked by self" },
  { value: "By bus-company", label: "By bus-company" },
  { value: "By bus-self", label: "By bus-self" },
  { value: "Auto, rickshaw, cab", label: "Auto, rickshaw, cab" },
  { value: "Bike", label: "Bike" },
];

const SBI_EXPENSE_STATUS_OPTIONS = [
  { value: "travel", label: "Travel" },
  { value: "food", label: "Food" },
  { value: "hotel", label: "Hotel" },
  { value: "other", label: "Other" },
];

export default function AddExpenseForm({
  successRedirect = "/admin-dashboard/expenses",
  uiVariant = "default",
}) {
  const isSbiUi = uiVariant === "sbi";
  const router = useRouter();
  const [isSubmitting, setSubmitting] = useState(false);
  const { register, handleSubmit, reset, watch } = useForm({
    defaultValues: {
      expense_status: "",
      train_class: "",
      HotelCost: 0,
      MealsCost: 0,
      OtherExpenses: 0,
    },
  });
  const expenseStatus = watch("expense_status");
  const travelMode = watch("travel_mode");
  const isTravelExpense = !isSbiUi || expenseStatus === "travel";
  const showTrainClass = isSbiUi && expenseStatus === "travel" && isSbiTrainTravelMode(travelMode);

  const onSubmit = async (data) => {
    if (isSbiUi && !data.expense_status) {
      toast.error("Please select expense mode");
      return;
    }

    if (isSbiUi && String(data.expense_status || "").toLowerCase() === "food") {
      const foodError = getSbiFoodAmountError(data.MealsCost);
      if (foodError) {
        toast.error(foodError);
        return;
      }
    }

    if (isSbiUi && String(data.expense_status || "").toLowerCase() === "hotel") {
      const hotelError = getSbiHotelAmountError(data.HotelCost);
      if (hotelError) {
        toast.error(hotelError);
        return;
      }
    }

    if (
      isSbiUi &&
      String(data.expense_status || "").toLowerCase() === "travel" &&
      isSbiTrainTravelMode(data.travel_mode) &&
      !String(data.train_class || "").trim()
    ) {
      toast.error("Please select train class (Sleeper / AC).");
      return;
    }

    setSubmitting(true);

    const formData = new FormData();
    const payload = { ...data };

    if (isSbiUi) {
      const status = String(data.expense_status || "").toLowerCase();
      payload.TicketCost = status === "travel" ? data.TicketCost ?? 0 : 0;
      payload.MealsCost = status === "food" ? data.MealsCost ?? 0 : 0;
      payload.HotelCost = status === "hotel" ? data.HotelCost ?? 0 : 0;
      payload.OtherExpenses = status === "other" ? data.OtherExpenses ?? 0 : 0;

      if (status !== "travel") {
        payload.FromLocation = data.FromLocation || "-";
        payload.Tolocation = data.Tolocation || "-";
        payload.distance = data.distance || 0;
        payload.travel_mode = "";
        payload.train_class = "";
        payload.ConveyanceMode = "-";
      } else if (data.travel_mode) {
        payload.ConveyanceMode = data.travel_mode;
        payload.train_class = isSbiTrainTravelMode(data.travel_mode)
          ? String(data.train_class || "").trim()
          : "";
      }
    }

    for (const key in payload) {
      if (key === "attachments") {
        for (let i = 0; i < data.attachments.length; i++) {
          formData.append("attachments", data.attachments[i]);
        }
      } else if (payload[key] !== undefined && payload[key] !== null) {
        formData.append(key, payload[key]);
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
        router.push(successRedirect);
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
    reset();
  };

  const fieldClass = isSbiUi
    ? "w-full rounded-xl border border-slate-200/90 bg-white p-2.5 text-sm shadow-sm focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/15"
    : "w-full border p-2 rounded-md";

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={
        isSbiUi
          ? "mx-auto w-full max-w-5xl space-y-6"
          : "max-w-7xl mx-auto p-6 space-y-6 bg-white rounded-xl shadow"
      }
    >
      {!isSbiUi ? (
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Add New Expense</h2>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium mb-1">
            {isSbiUi ? "Date of Completion Task *" : "Expense Date *"}
          </label>
          <input
            type="date"
            {...register("TravelDate", { required: true })}
            className={fieldClass}
          />
        </div>

        {isSbiUi ? (
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Expense Mode *</label>
            <select
              {...register("expense_status", { required: true })}
              className={fieldClass}
              defaultValue=""
            >
              <option value="" disabled>
                Select expense type
              </option>
              {SBI_EXPENSE_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {isTravelExpense ? (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">
                {isSbiUi ? "Travel From *" : "From Location *"}
              </label>
              <input
                {...register("FromLocation", { required: isTravelExpense })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {isSbiUi ? "Travel To *" : "To Location *"}
              </label>
              <input
                {...register("Tolocation", { required: isTravelExpense })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Distance (km) *</label>
              <input
                type="number"
                {...register("distance", { required: isTravelExpense })}
                className={fieldClass}
              />
            </div>
          </>
        ) : null}

        <div>
          <label className="block text-sm font-medium mb-1">Meeting Person Name *</label>
          <input
            {...register("person_name", { required: true })}
            className={fieldClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Person Contact *</label>
          <input
            {...register("person_contact", { required: true })}
            className={fieldClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Designation</label>
          <input
            {...register("designation")}
            className={fieldClass}
            placeholder="e.g. Manager"
          />
        </div>

        {isSbiUi && expenseStatus === "travel" ? (
          <div>
            <label className="block text-sm font-medium mb-1">Travel Mode *</label>
            <select
              {...register("travel_mode", { required: true })}
              className={fieldClass}
              defaultValue=""
            >
              <option value="" disabled>
                Select travel mode
              </option>
              {SBI_TRAVEL_MODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {showTrainClass ? (
          <div>
            <label className="block text-sm font-medium mb-1">Train Class *</label>
            <select
              {...register("train_class", { required: true })}
              className={fieldClass}
              defaultValue=""
            >
              <option value="" disabled>
                Select Sleeper / AC class
              </option>
              {SBI_TRAIN_CLASS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {!isSbiUi ? (
          <div>
            <label className="block text-sm font-medium mb-1">Conveyance Mode *</label>
            <input
              {...register("ConveyanceMode", { required: true })}
              className={fieldClass}
            />
          </div>
        ) : null}

        {!isSbiUi ? (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Ticket Cost *</label>
              <input
                type="number"
                {...register("TicketCost", { required: true })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Hotel Cost *</label>
              <input
                type="number"
                defaultValue={0}
                {...register("HotelCost", { required: true })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Meals Cost *</label>
              <input
                type="number"
                defaultValue={0}
                {...register("MealsCost", { required: true })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Other Expenses *</label>
              <input
                type="number"
                defaultValue={0}
                {...register("OtherExpenses", { required: true })}
                className={fieldClass}
              />
            </div>
          </>
        ) : null}

        {isSbiUi && expenseStatus === "travel" ? (
          <div>
            <label className="block text-sm font-medium mb-1">Travel Cost *</label>
            <input
              type="number"
              {...register("TicketCost", { required: true })}
              className={fieldClass}
            />
          </div>
        ) : null}
        {isSbiUi && expenseStatus === "food" ? (
          <div>
            <label className="block text-sm font-medium mb-1">Food Cost *</label>
            <input
              type="number"
              min={0}
              max={SBI_FOOD_MAX_AMOUNT}
              step="0.01"
              {...register("MealsCost", {
                required: true,
                max: {
                  value: SBI_FOOD_MAX_AMOUNT,
                  message: `Maximum ₹${SBI_FOOD_MAX_AMOUNT}`,
                },
              })}
              className={fieldClass}
            />
            <p className="mt-1 text-xs text-slate-500">
              Food allowance is ₹{SBI_FOOD_MAX_AMOUNT} per 24 hours.
            </p>
          </div>
        ) : null}
        {isSbiUi && expenseStatus === "hotel" ? (
          <div>
            <label className="block text-sm font-medium mb-1">Hotel Cost *</label>
            <input
              type="number"
              min={0}
              max={SBI_HOTEL_MAX_AMOUNT}
              step="0.01"
              {...register("HotelCost", {
                required: true,
                max: {
                  value: SBI_HOTEL_MAX_AMOUNT,
                  message: `Maximum ₹${SBI_HOTEL_MAX_AMOUNT}`,
                },
              })}
              className={fieldClass}
            />
            <p className="mt-1 text-xs text-slate-500">
              Hotel allowance is ₹{SBI_HOTEL_MAX_AMOUNT} per 24 hours.
            </p>
          </div>
        ) : null}
        {isSbiUi && expenseStatus === "other" ? (
          <div>
            <label className="block text-sm font-medium mb-1">Other Expenses *</label>
            <input
              type="number"
              {...register("OtherExpenses", { required: true })}
              className={fieldClass}
            />
          </div>
        ) : null}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description *</label>
        <textarea
          {...register("description", { required: true })}
          className={fieldClass}
          rows={4}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Attachments (Multiple files allowed)
        </label>
        <input
          type="file"
          {...register("attachments")}
          multiple
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <button
          type="button"
          onClick={handleReset}
          className={
            isSbiUi
              ? "w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-white sm:w-auto"
              : "w-full sm:w-auto px-6 py-3 bg-gray-500 text-gray-100 rounded-lg hover:bg-gray-600 cursor-pointer"
          }
        >
          Reset
        </button>

        <button
          type="submit"
          disabled={isSubmitting}
          className={
            isSbiUi
              ? "w-full cursor-pointer rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50 sm:w-auto"
              : "w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          }
        >
          {isSubmitting ? "Submitting..." : "Add Expense"}
        </button>
      </div>
    </form>
  );
}