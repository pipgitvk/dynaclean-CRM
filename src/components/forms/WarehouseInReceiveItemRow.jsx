"use client";

import { useRef, useEffect, useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { CategoryBadge, itemLineKey } from "@/components/forms/warehouseInUi";
import { warehouseInQtyFields } from "@/lib/warehouseInQuantities";

function ReceivedQtyCell({ item, line, set, inputClass, showHint }) {
  const { requested, received, remaining } = warehouseInQtyFields(item);
  return (
    <div>
      <input
        type="number"
        min={1}
        max={remaining > 0 ? remaining : undefined}
        className={inputClass}
        value={line.receivedQty ?? ""}
        onChange={(e) => set({ receivedQty: e.target.value })}
        required
      />
      {showHint ? (
        <p className="text-xs text-gray-500 mt-1">
          Requested: {requested} · Received: {received} · Remaining:{" "}
          {remaining}
        </p>
      ) : (
        <p className="text-[11px] text-gray-500 mt-0.5">
          Req {requested} · Recv {received} · Rem {remaining}
        </p>
      )}
    </div>
  );
}

function ImageCell({ line, set, prefix, showHint }) {
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (!line.receivedImage) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(line.receivedImage);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [line.receivedImage]);

  const onPick = (e) => {
    const file = e.target.files?.[0] ?? null;
    set({ receivedImage: file });
    e.target.value = "";
  };

  const btnClass = showHint
    ? "inline-flex items-center justify-center gap-2 flex-1 min-h-[44px] px-3 py-2.5 rounded-lg border text-sm font-medium"
    : "inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-medium";

  return (
    <div className="space-y-2">
      <input
        ref={cameraInputRef}
        id={`${prefix}-image-camera`}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={onPick}
      />
      <input
        ref={galleryInputRef}
        id={`${prefix}-image-gallery`}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={onPick}
      />
      <div className={`flex gap-2 ${showHint ? "flex-col sm:flex-row" : "flex-wrap"}`}>
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className={`${btnClass} bg-green-600 text-white border-green-700 hover:bg-green-700`}
        >
          <Camera className="w-4 h-4 shrink-0" aria-hidden />
          Open camera
        </button>
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          className={`${btnClass} bg-white text-gray-800 border-gray-300 hover:bg-gray-50`}
        >
          <ImagePlus className="w-4 h-4 shrink-0" aria-hidden />
          Choose image
        </button>
      </div>
      {line.receivedImage ? (
        <div className={`flex items-center gap-2 ${showHint ? "" : "mt-1"}`}>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt=""
              className="w-12 h-12 object-cover rounded border border-gray-200"
            />
          ) : null}
          <p
            className={`text-gray-700 truncate ${showHint ? "text-sm" : "text-xs"} ${inputClass ? "" : ""}`}
            title={line.receivedImage.name}
          >
            {line.receivedImage.name}
          </p>
        </div>
      ) : (
        <p className={`text-gray-500 ${showHint ? "text-xs" : "text-[11px]"}`}>
          {showHint
            ? "Tap Open camera to take a photo, or Choose image from gallery"
            : "Camera or gallery"}
        </p>
      )}
    </div>
  );
}

/** compact = modal mobile expand; table-row = desktop table; card = full labels */
export default function WarehouseInReceiveItemRow({
  item,
  line,
  onLineChange,
  inputIdPrefix,
  variant = "card",
}) {
  const isSpare = item.__source === "spare" || item.category === "Spare";
  const nameLabel = isSpare ? "Spare Name" : "Product Name";
  const displayName = item.spare_name ?? item.product_name;
  const { requested, received, remaining } = warehouseInQtyFields(item);
  const prefix = inputIdPrefix || `wi-${itemLineKey(item)}`;
  const set = (patch) => onLineChange({ ...line, ...patch });
  const inputClass = "w-full border border-gray-300 p-2 rounded bg-white text-sm";

  if (variant === "compact") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-800">
          <span className="font-semibold">{displayName}</span>
          <span className="text-gray-500">
            {" "}
            · Req {requested} · Recv {received} · Rem {remaining}
          </span>
        </p>
        <div className="grid grid-cols-2 gap-3 max-[380px]:grid-cols-1">
          <div>
            <label className="block text-sm font-medium mb-1">
              Received qty *
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={remaining > 0 ? remaining : undefined}
              className="w-full border p-3 rounded text-base"
              value={line.receivedQty ?? ""}
              onChange={(e) => set({ receivedQty: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Location *</label>
            <input
              type="text"
              className="w-full border p-3 rounded text-base"
              value={line.location ?? ""}
              onChange={(e) => set({ location: e.target.value })}
              placeholder="Gate / Dock"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Received image *
          </label>
          <ImageCell
            line={line}
            set={set}
            prefix={prefix}
            inputClass="w-full border p-3 rounded bg-white text-base min-h-[44px]"
            showHint
          />
        </div>
      </div>
    );
  }

  if (variant === "table-row") {
    return (
      <tr className="border-t border-gray-200 align-top">
        <td className="p-3 min-w-[10rem]">
          <span
            className="block text-sm font-medium text-gray-900 truncate"
            title={displayName ?? ""}
          >
            {displayName}
          </span>
          <span className="inline-flex items-center gap-1 mt-1 text-xs text-gray-500">
            <CategoryBadge category={item.category} /> #{item.id}
          </span>
        </td>
        <td className="p-3 w-20 text-center text-sm text-gray-800 tabular-nums">
          {requested}
        </td>
        <td className="p-3 w-20 text-center text-sm text-gray-600 tabular-nums">
          {received}
        </td>
        <td className="p-3 w-20 text-center text-sm font-medium text-amber-800 tabular-nums">
          {remaining}
        </td>
        <td className="p-3 w-32">
          <ReceivedQtyCell
            item={item}
            line={line}
            set={set}
            inputClass={inputClass}
            showHint={false}
          />
        </td>
        <td className="p-3 min-w-[11rem]">
          <input
            type="text"
            className={inputClass}
            value={line.location ?? ""}
            onChange={(e) => set({ location: e.target.value })}
            placeholder="Gate 1 / Dock A"
            required
          />
        </td>
        <td className="p-3 min-w-[12rem]">
          <ImageCell
            line={line}
            set={set}
            prefix={prefix}
            inputClass={inputClass}
            showHint={false}
          />
        </td>
      </tr>
    );
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <CategoryBadge category={item.category} />
        <span className="text-xs text-gray-500">Req #{item.id}</span>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{nameLabel}</label>
        <input
          value={displayName ?? ""}
          disabled
          readOnly
          className="w-full border p-2 rounded bg-gray-50"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">
          Requested Quantity
        </label>
        <input
          value={requested}
          disabled
          readOnly
          className="w-full border p-2 rounded bg-gray-50"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Received so far</label>
          <input
            value={received}
            disabled
            readOnly
            className="w-full border p-2 rounded bg-gray-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Remaining</label>
          <input
            value={remaining}
            disabled
            readOnly
            className="w-full border p-2 rounded bg-gray-50"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">
          This receive qty *
        </label>
        <ReceivedQtyCell
          item={item}
          line={line}
          set={set}
          inputClass="w-full border p-2 rounded"
          showHint
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Location *</label>
        <input
          type="text"
          className="w-full border p-2 rounded"
          value={line.location ?? ""}
          onChange={(e) => set({ location: e.target.value })}
          placeholder="e.g., Gate 1 / Dock A"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Received Image *</label>
        <ImageCell
          line={line}
          set={set}
          prefix={prefix}
          inputClass="w-full border p-2 rounded bg-white"
          showHint
        />
      </div>
    </div>
  );
}
