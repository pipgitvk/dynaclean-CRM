"use client";
import { useState, useEffect } from "react";
import AssetFormModal from "./AssetFormModal";

export default function AssetTypeCard({ type }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className="p-4 border rounded-lg hover:shadow-md cursor-pointer bg-white"
      >
        <h2 className="font-semibold text-lg">Asset Type: {type}</h2>
      </div>
      {open && <AssetFormModal type={type} onClose={() => setOpen(false)} />}
    </>
  );
}
