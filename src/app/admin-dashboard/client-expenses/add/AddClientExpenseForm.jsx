"use client";

import { useForm, useWatch, Controller } from "react-hook-form";
import TransactionIdSuggestInput from "../TransactionIdSuggestInput";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useState, useEffect } from "react";
export default function AddClientExpenseForm() {
  const router = useRouter();
  const [isSubmitting, setSubmitting] = useState(false);
  const [headOptions, setHeadOptions] = useState([]);
  const [subHeadOptions, setSubHeadOptions] = useState([]);
  const { register, handleSubmit, reset, control, setValue } = useForm({
    defaultValues: {
      main_head: "Direct",
      supply: "goods",
      head: "",
      sub_head: "",
      transaction_id: "",
      tax_rate: "",
      tax_applicable: "No",
      tax_type: "",
      cgst: "",
      sgst: "",
      igst: "",
    },
  });

  const mainHead = useWatch({ control, name: "main_head", defaultValue: "Direct" });
  const taxApplicable = useWatch({ control, name: "tax_applicable", defaultValue: "No" }) === "Yes";
  const taxType = useWatch({ control, name: "tax_type", defaultValue: "" });
  const taxRate = useWatch({ control, name: "tax_rate", defaultValue: "" });
  const amount = useWatch({ control, name: "amount", defaultValue: "" });
  const showSubHead = mainHead === "Direct" || mainHead === "Indirect";

  useEffect(() => {
    if (!taxApplicable || !taxType) return;
    const amt = parseFloat(amount);
    const rate = parseFloat(taxRate);
    if (isNaN(amt) || amt <= 0 || isNaN(rate) || rate < 0) return;
    if (taxType === "CGST+SGST") {
      const half = (amt * rate) / 200;
      setValue("cgst", half.toFixed(2));
      setValue("sgst", half.toFixed(2));
      setValue("igst", "");
    } else if (taxType === "IGST") {
      setValue("igst", ((amt * rate) / 100).toFixed(2));
      setValue("cgst", "");
      setValue("sgst", "");
    }
  }, [taxApplicable, taxType, taxRate, amount, setValue]);

  useEffect(() => {
    Promise.all([
      fetch("/api/expense-categories", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/expense-sub-categories", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([catRes, subCatRes]) => {
        setHeadOptions(catRes?.categories?.map((c) => c.name) || []);
        setSubHeadOptions(subCatRes?.subCategories?.map((c) => c.name) || []);
      })
      .catch(() => {});
  }, []);

  const onSubmit = async (data) => {
    setSubmitting(true);

    try {
      const res = await fetch("/api/client-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expense_name: data.expense_name,
          client_name: data.client_name,
          group_name: data.group_name || null,
          gst_rate: data.tax_applicable === "Yes" && data.tax_rate != null && data.tax_rate !== "" ? Number(data.tax_rate) : null,
          tax_applicable: data.tax_applicable === "Yes",
          tax_type: data.tax_applicable === "Yes" ? (data.tax_type || null) : null,
          cgst: data.tax_type === "CGST+SGST" && data.cgst != null && data.cgst !== "" ? Number(data.cgst) : null,
          sgst: data.tax_type === "CGST+SGST" && data.sgst != null && data.sgst !== "" ? Number(data.sgst) : null,
          igst: data.tax_type === "IGST" && data.igst != null && data.igst !== "" ? Number(data.igst) : null,
          main_head: data.main_head,
          head: data.head || null,
          supply: data.supply || null,
          type_of_ledger: data.type_of_ledger || null,
          hsn: data.hsn || null,
          transaction_id: String(data.transaction_id).trim(),
          sub_heads: data.sub_head ? [data.sub_head] : [],
          amount: data.amount != null && data.amount !== "" ? Number(data.amount) : null,
        }),
      });

      const result = await res.json();

      if (res.ok) {
        toast.success("Client expense added successfully!");
        router.push("/admin-dashboard/client-expenses/cards");
      } else {
        toast.error(result.error || "Failed to add client expense");
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

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="max-w-7xl mx-auto p-6 space-y-6 bg-white rounded-xl shadow"
    >
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Add Client Expense</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium mb-1">Main Head *</label>
          <select
            {...register("main_head", { required: true })}
            className="w-full border p-2 rounded-md"
          >
            <option value="Direct">Direct</option>
            <option value="Indirect">Indirect</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Head</label>
          <select
            {...register("head")}
            className="w-full border p-2 rounded-md"
          >
            <option value="">Select head</option>
            {headOptions.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>
        {showSubHead && (
          <div>
            <label className="block text-sm font-medium mb-1">Sub-head</label>
            <select
              {...register("sub_head")}
              className="w-full border p-2 rounded-md"
            >
              <option value="">Select sub-head</option>
              {subHeadOptions.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Transaction ID *</label>
          <Controller
            name="transaction_id"
            control={control}
            rules={{
              required: "Transaction ID is required",
              validate: (v) => (v != null && String(v).trim() !== "") || "Transaction ID is required",
            }}
            render={({ field, fieldState }) => (
              <TransactionIdSuggestInput
                value={field.value}
                onChange={(v) =>
                  field.onChange({ target: { value: v, name: field.name } })
                }
                onBlur={field.onBlur}
                name={field.name}
                inputRef={field.ref}
                className="w-full border p-2 rounded-md"
                placeholder="Type or pick from statement Trans IDs"
                error={fieldState.error}
              />
            )}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Expense Name *</label>
          <input
            {...register("expense_name", { required: true })}
            className="w-full border p-2 rounded-md"
            placeholder="Expense name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Client Name *</label>
          <input
            {...register("client_name", { required: true })}
            className="w-full border p-2 rounded-md"
            placeholder="Client name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Group Name</label>
          <input
            {...register("group_name")}
            className="w-full border p-2 rounded-md"
            placeholder="Group name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tax applicable</label>
          <select
            {...register("tax_applicable")}
            className="w-full border p-2 rounded-md"
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Amount</label>
          <input
            type="number"
            step="0.01"
            {...register("amount")}
            className="w-full border p-2 rounded-md"
            placeholder="0"
          />
        </div>
        {taxApplicable && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Tax Rate (%)</label>
              <input
                type="number"
                step="0.01"
                {...register("tax_rate")}
                className="w-full border p-2 rounded-md"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tax type</label>
              <select
                {...register("tax_type")}
                className="w-full border p-2 rounded-md"
              >
                <option value="">Select tax type</option>
                <option value="CGST+SGST">CGST+SGST</option>
                <option value="IGST">IGST</option>
              </select>
            </div>
            {taxType === "CGST+SGST" && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">CGST</label>
                  <input
                    type="number"
                    step="0.01"
                    {...register("cgst")}
                    readOnly
                    className="w-full border p-2 rounded-md bg-gray-50"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">SGST</label>
                  <input
                    type="number"
                    step="0.01"
                    {...register("sgst")}
                    readOnly
                    className="w-full border p-2 rounded-md bg-gray-50"
                    placeholder="0"
                  />
                </div>
              </>
            )}
            {taxType === "IGST" && (
              <div>
                <label className="block text-sm font-medium mb-1">IGST</label>
                <input
                  type="number"
                  step="0.01"
                  {...register("igst")}
                  readOnly
                  className="w-full border p-2 rounded-md bg-gray-50"
                  placeholder="0"
                />
              </div>
            )}
          </>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Supply</label>
          <select
            {...register("supply")}
            className="w-full border p-2 rounded-md"
          >
            <option value="goods">Goods</option>
            <option value="services">Services</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Type of Ledger</label>
          <input
            {...register("type_of_ledger")}
            className="w-full border p-2 rounded-md"
            placeholder="Type of ledger"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">HSN</label>
          <input
            {...register("hsn")}
            className="w-full border p-2 rounded-md"
            placeholder="HSN"
          />
        </div>
      </div>

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
          {isSubmitting ? "Submitting..." : "Add Client Expense"}
        </button>
      </div>
    </form>
  );
}
