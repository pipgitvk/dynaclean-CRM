"use client";
import { useState } from "react";
import { Dialog } from "@headlessui/react";
import { Plus } from "lucide-react";

export default function CreateAssetTypeModal() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("");

  const handleSubmit = async () => {
    if (!type) return;
    const res = await fetch("/api/assets", {
      method: "POST",
      body: JSON.stringify({ type }),
    });
    const data = await res.json();
    if (data.success) {
      setOpen(false);
      window.location.reload();
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2"
      >
        <Plus size={18} />
        New Asset Type
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md space-y-4">
            <Dialog.Title className="text-lg font-semibold">
              Create Asset Type
            </Dialog.Title>
            <input
              className="border w-full p-2 rounded"
              placeholder="e.g. Mobile"
              value={type}
              onChange={(e) => setType(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 border rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="bg-blue-600 text-white px-4 py-2 rounded"
              >
                Save
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
}
